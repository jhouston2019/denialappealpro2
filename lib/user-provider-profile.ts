import type { SupabaseClient } from "@supabase/supabase-js";
import type { DenialIntake } from "@/lib/wizard/denialIntakeEngine";

export type UserProviderProfile = {
  provider_name: string | null;
  provider_npi: string | null;
  provider_address: string | null;
  provider_phone: string | null;
  provider_fax: string | null;
  signer_name: string | null;
  signer_title: string | null;
  signer_credentials: string | null;
  signer_phone: string | null;
};

/** NPI must be exactly 10 digits (ignoring formatting characters). */
export function normalizeNpiDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidNpi(value: string | null | undefined): boolean {
  return normalizeNpiDigits(value).length === 10;
}

export function mergeProviderProfileIntoIntake(
  intake: DenialIntake,
  profile: UserProviderProfile | null | undefined
): DenialIntake {
  if (!profile) return intake;
  return {
    ...intake,
    providerName: intake.providerName || profile.provider_name || "",
    providerNpi: intake.providerNpi || profile.provider_npi || "",
    providerAddress: intake.providerAddress || profile.provider_address || "",
    providerPhone: intake.providerPhone || profile.provider_phone || "",
    providerFax: intake.providerFax || profile.provider_fax || "",
    signerName: intake.signerName || profile.signer_name || "",
    signerTitle: intake.signerTitle || profile.signer_title || "",
    signerCredentials:
      intake.signerCredentials || profile.signer_credentials || "",
    signerPhone: intake.signerPhone || profile.signer_phone || "",
  };
}

/** Patch only intake fields that are still empty (extraction wins). */
export function providerProfilePatch(
  intake: DenialIntake,
  profile: UserProviderProfile | null | undefined
): Partial<DenialIntake> {
  if (!profile) return {};
  const merged = mergeProviderProfileIntoIntake(intake, profile);
  const patch: Partial<DenialIntake> = {};
  if (!intake.providerName?.trim() && merged.providerName) {
    patch.providerName = merged.providerName;
  }
  if (!intake.providerNpi?.trim() && merged.providerNpi) {
    patch.providerNpi = merged.providerNpi;
  }
  if (!intake.providerAddress?.trim() && merged.providerAddress) {
    patch.providerAddress = merged.providerAddress;
  }
  if (!intake.providerPhone?.trim() && merged.providerPhone) {
    patch.providerPhone = merged.providerPhone;
  }
  if (!intake.providerFax?.trim() && merged.providerFax) {
    patch.providerFax = merged.providerFax;
  }
  if (!intake.signerName?.trim() && merged.signerName) {
    patch.signerName = merged.signerName;
  }
  if (!intake.signerTitle?.trim() && merged.signerTitle) {
    patch.signerTitle = merged.signerTitle;
  }
  if (!intake.signerCredentials?.trim() && merged.signerCredentials) {
    patch.signerCredentials = merged.signerCredentials;
  }
  if (!intake.signerPhone?.trim() && merged.signerPhone) {
    patch.signerPhone = merged.signerPhone;
  }
  return patch;
}

export async function loadUserProviderProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<UserProviderProfile | null> {
  const { data } = await supabase
    .from("users")
    .select(
      "provider_name, provider_npi, provider_address, provider_phone, provider_fax, signer_name, signer_title, signer_credentials, signer_phone"
    )
    .eq("id", userId)
    .maybeSingle();
  return (data as UserProviderProfile | null) ?? null;
}

export async function saveUserProviderProfile(
  supabase: SupabaseClient,
  userId: string,
  intake: DenialIntake
): Promise<void> {
  await supabase
    .from("users")
    .update({
      provider_name: intake.providerName || null,
      provider_npi: intake.providerNpi || null,
      provider_address: intake.providerAddress || null,
      provider_phone: intake.providerPhone || null,
      provider_fax: intake.providerFax || null,
      signer_name: intake.signerName || null,
      signer_title: intake.signerTitle || null,
      signer_credentials: intake.signerCredentials || null,
      signer_phone: intake.signerPhone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}
