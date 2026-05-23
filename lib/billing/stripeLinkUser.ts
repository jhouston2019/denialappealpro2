/**
 * Resolve Supabase user id for a paid Stripe Checkout session.
 * Links by stripe_customer_id when known; otherwise resolves via Stripe customer email.
 */
import { randomBytes } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { applyAdminAppMetadataForUserId } from "@/lib/auth/adminAppMetadata";
import { findAuthUserIdByEmail } from "@/lib/auth/findAuthUserByEmail";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function stripeCustomerIdFromSession(
  session: Stripe.Checkout.Session
): string | null {
  const c = session.customer;
  if (typeof c === "string" && c.startsWith("cus_")) return c;
  if (c && typeof c === "object" && "id" in c) {
    const id = (c as Stripe.Customer).id;
    if (typeof id === "string" && id.startsWith("cus_")) return id;
  }
  return null;
}

async function upsertPublicUserRow(id: string, email: string): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .upsert({ id, email }, { onConflict: "id" });
  if (error) {
    console.error("[stripeLinkUser] upsertPublicUserRow failed:", error);
    return false;
  }
  return true;
}

/**
 * After checkout, ensure the Stripe customer has metadata linking Supabase user when known.
 */
async function stripeMetadataHasUserId(
  customerId: string,
  userId: string
): Promise<void> {
  try {
    await stripe.customers.update(customerId, {
      metadata: { supabase_user_id: userId },
    });
  } catch (e) {
    console.warn("[stripeLinkUser] customer metadata update:", e);
  }
}

function randomTempPassword(): string {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

function isStripeCustomer(
  c: Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): c is Stripe.Customer {
  return !!c && typeof c === "object" && !("deleted" in c && c.deleted);
}

function getCustomerEmail(
  customer: Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | undefined {
  if (isStripeCustomer(customer) && customer.email) {
    return customer.email;
  }
  return undefined;
}

function checkoutSessionEmail(session: Stripe.Checkout.Session): string | null {
  const direct = session.customer_email?.trim() ?? "";
  if (direct) return direct;
  const details = session.customer_details?.email?.trim() ?? "";
  if (details) return details;
  const c = session.customer;
  if (c && typeof c !== "string") {
    const em = getCustomerEmail(c)?.trim() ?? "";
    if (em) return em;
  }
  return null;
}

export async function ensureUserForPaidCheckout(
  session: Stripe.Checkout.Session,
  trustedUserId?: string
): Promise<string | null> {
  const cid = stripeCustomerIdFromSession(session);
  const metaUid = session.metadata?.user_id?.trim() ?? "";

  if (trustedUserId) {
    if (metaUid && metaUid !== trustedUserId) {
      console.warn("[stripeLinkUser] metadata user_id mismatch trusted user");
      return null;
    }
    const { data: urow } = await supabase
      .from("users")
      .select("id, stripe_customer_id")
      .eq("id", trustedUserId)
      .maybeSingle();
    if (!urow?.id) {
      const { data: authData } = await supabase.auth.admin.getUserById(
        trustedUserId
      );
      const em = authData.user?.email;
      if (!em) return null;
      await upsertPublicUserRow(trustedUserId, em);
    }
    if (cid) {
      await supabase
        .from("users")
        .update({ stripe_customer_id: cid })
        .eq("id", trustedUserId);
      await stripeMetadataHasUserId(cid, trustedUserId);
    }
    await applyAdminAppMetadataForUserId(supabase, trustedUserId);
    return trustedUserId;
  }

  if (cid) {
    const { data: byCust } = await supabase
      .from("users")
      .select("id")
      .eq("stripe_customer_id", cid)
      .maybeSingle();
    if (byCust?.id) {
      await stripeMetadataHasUserId(cid, byCust.id);
      await applyAdminAppMetadataForUserId(supabase, byCust.id);
      return byCust.id;
    }
  }

  let email = checkoutSessionEmail(session);
  if (!email && cid) {
    const customer = await stripe.customers.retrieve(cid);
    if (!customer.deleted && "email" in customer && customer.email) {
      email = customer.email.trim();
    }
  }
  if (!email) {
    console.error("[stripeLinkUser] could not resolve email for checkout session");
    return null;
  }
  if (!cid) {
    console.warn(
      "[stripeLinkUser] missing Stripe customer id on session; provisioning user by email only"
    );
  }

  const { data: existingRow } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingRow?.id) {
    if (cid) {
      await supabase
        .from("users")
        .update({ stripe_customer_id: cid })
        .eq("id", existingRow.id);
      await stripeMetadataHasUserId(cid, existingRow.id);
    }
    await applyAdminAppMetadataForUserId(supabase, existingRow.id);
    return existingRow.id;
  }

  const tempPassword = randomTempPassword();
  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

  if (createErr) {
    const msg = String(createErr.message || "");
    const likelyDup =
      /already|registered|exists/i.test(msg) ||
      (createErr as { code?: string }).code === "user_already_exists";
    if (likelyDup) {
      const { data: row } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (row?.id) {
        if (cid) {
          await supabase
            .from("users")
            .update({ stripe_customer_id: cid })
            .eq("id", row.id);
          await stripeMetadataHasUserId(cid, row.id);
        }
        await applyAdminAppMetadataForUserId(supabase, row.id);
        return row.id;
      }
      const authUserId = await findAuthUserIdByEmail(email);
      if (authUserId) {
        const upserted = await upsertPublicUserRow(authUserId, email);
        if (!upserted) return null;
        if (cid) {
          await supabase
            .from("users")
            .update({ stripe_customer_id: cid })
            .eq("id", authUserId);
          await stripeMetadataHasUserId(cid, authUserId);
        }
        await applyAdminAppMetadataForUserId(supabase, authUserId);
        return authUserId;
      }
    }
    console.error("[stripeLinkUser] createUser:", createErr);
    return null;
  }

  if (!created.user) return null;
  const upserted = await upsertPublicUserRow(created.user.id, email);
  if (!upserted) return null;
  if (cid) {
    await supabase
      .from("users")
      .update({ stripe_customer_id: cid })
      .eq("id", created.user.id);
    await stripeMetadataHasUserId(cid, created.user.id);
  }
  await applyAdminAppMetadataForUserId(supabase, created.user.id);
  return created.user.id;
}

export async function checkoutSessionBelongsToUser(args: {
  session: Stripe.Checkout.Session;
  userId: string;
}): Promise<boolean> {
  const { session, userId } = args;
  const meta = session.metadata?.user_id?.trim();
  if (meta && meta.length > 0 && meta === userId) return true;

  const cid = stripeCustomerIdFromSession(session);
  if (cid) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("stripe_customer_id", cid)
      .eq("id", userId)
      .maybeSingle();
    if (data?.id) return true;
    try {
      const cust = await stripe.customers.retrieve(cid);
      if (!cust.deleted && cust.metadata?.supabase_user_id === userId)
        return true;
    } catch {
      /* ignore */
    }
  }

  return false;
}

function stripeCustomerIdFromString(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (typeof customer === "string" && customer.startsWith("cus_")) return customer;
  if (
    customer &&
    typeof customer === "object" &&
    "id" in customer &&
    !(customer as Stripe.DeletedCustomer).deleted
  ) {
    const id = (customer as Stripe.Customer).id;
    if (typeof id === "string" && id.startsWith("cus_")) return id;
  }
  return null;
}

/**
 * Resolve user from subscription + customer metadata (webhooks).
 */
export async function ensureUserForStripeSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const cid = stripeCustomerIdFromString(subscription.customer);
  const metaUid = subscription.metadata?.user_id?.trim() ?? "";

  if (cid) {
    const { data: byCust } = await supabase
      .from("users")
      .select("id")
      .eq("stripe_customer_id", cid)
      .maybeSingle();
    if (byCust?.id) {
      await stripeMetadataHasUserId(cid, byCust.id);
      await applyAdminAppMetadataForUserId(supabase, byCust.id);
      return byCust.id;
    }
  }

  if (metaUid.length > 0) {
    const { data: byMeta } = await supabase
      .from("users")
      .select("id")
      .eq("id", metaUid)
      .maybeSingle();
    if (byMeta?.id) {
      if (cid) {
        await supabase
          .from("users")
          .update({ stripe_customer_id: cid })
          .eq("id", byMeta.id);
        await stripeMetadataHasUserId(cid, byMeta.id);
      }
      await applyAdminAppMetadataForUserId(supabase, byMeta.id);
      return byMeta.id;
    }
    const { data: authByMeta } = await supabase.auth.admin.getUserById(metaUid);
    if (authByMeta.user?.email) {
      await upsertPublicUserRow(metaUid, authByMeta.user.email);
      if (cid) {
        await supabase
          .from("users")
          .update({ stripe_customer_id: cid })
          .eq("id", metaUid);
        await stripeMetadataHasUserId(cid, metaUid);
      }
      await applyAdminAppMetadataForUserId(supabase, metaUid);
      return metaUid;
    }
  }

  if (!cid) return null;

  const customer = await stripe.customers.retrieve(cid);
  if (customer.deleted || !("email" in customer) || !customer.email) return null;

  const email = customer.email.trim();

  const { data: created, error: createErr } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });

  if (createErr) {
    const likelyDup =
      /already|registered|exists/i.test(String(createErr.message || "")) ||
      (createErr as { code?: string }).code === "user_already_exists";
    if (likelyDup) {
      const { data: row } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (row?.id) {
        await supabase
          .from("users")
          .update({ stripe_customer_id: cid })
          .eq("id", row.id);
        await stripeMetadataHasUserId(cid, row.id);
        await applyAdminAppMetadataForUserId(supabase, row.id);
        return row.id;
      }
    }
    console.error("[stripeLinkUser] subscription createUser:", createErr);
    return null;
  }
  if (!created.user) return null;

  await upsertPublicUserRow(created.user.id, email);
  await supabase
    .from("users")
    .update({ stripe_customer_id: cid })
    .eq("id", created.user.id);
  await stripeMetadataHasUserId(cid, created.user.id);
  await applyAdminAppMetadataForUserId(supabase, created.user.id);
  return created.user.id;
}
