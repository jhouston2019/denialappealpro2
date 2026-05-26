import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import UploadWizardClient from "./UploadWizardClient";

export default async function UploadRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  await requireUserAndPaywall();
  const sp = await searchParams;
  const parsed = parseInt(sp.step ?? "1", 10);
  const initialStep = Number.isFinite(parsed)
    ? Math.min(6, Math.max(1, parsed))
    : 1;
  return <UploadWizardClient initialStep={initialStep} />;
}
