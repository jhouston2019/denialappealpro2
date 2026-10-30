import type { Metadata } from "next";
import { absoluteCanonical } from "@/lib/seo/site";
import { createSupabaseServerComponentClient } from "@/lib/supabaseServer";
import PricingPageClient from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing | Denial Appeal Pro",
  description: "Plans and pricing for Denial Appeal Pro denial appeal reports.",
  alternates: { canonical: absoluteCanonical("/pricing") },
};

export default async function PricingPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <PricingPageClient userEmail={user?.email ?? null} />;
}
