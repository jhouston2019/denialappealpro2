import UploadWizardClient from "../upload/UploadWizardClient";

export const metadata = {
  title: "Free denial appeal preview | Denial Appeal Pro",
  description:
    "Upload your denial letter for a free preview. Full appeal letter unlocks after payment.",
};

/** Public funnel — always preview mode, even for logged-in users with prior purchases. */
export default function AnalysisPreviewPage() {
  return <UploadWizardClient isPreviewMode />;
}
