import { createSupabaseServerComponentClient } from "@/lib/supabaseServer";
import PricingPageClient from "./PricingPageClient";

export default async function PricingPage() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <PricingPageClient userEmail={user?.email ?? null} />;
}
