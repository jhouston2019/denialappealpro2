import UploadWizardClient from "../upload/UploadWizardClient";

export const metadata = {
  title: "Free estimate preview | Estimate Review Pro",
  description:
    "Upload your carrier estimate for a free preview. Full analysis unlocks after payment.",
};

/** Public funnel — always preview mode, even for logged-in users with prior purchases. */
export default function AnalysisPreviewPage() {
  return <UploadWizardClient isPreviewMode />;
}
