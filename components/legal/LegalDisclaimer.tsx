export const LEGAL_DISCLAIMER =
  "Denial Appeal Pro is not a law firm and does not provide legal advice. Generated letters are for administrative use only.";

type LegalDisclaimerProps = {
  className?: string;
  variant?: "footer" | "banner";
};

export function LegalDisclaimer({
  className = "",
  variant = "footer",
}: LegalDisclaimerProps) {
  if (variant === "banner") {
    return (
      <p
        className={`rounded-lg border border-amber-200/30 bg-amber-950/40 px-4 py-3 text-xs leading-relaxed text-amber-100/90 ${className}`}
        role="note"
      >
        {LEGAL_DISCLAIMER}
      </p>
    );
  }

  return (
    <p className={`text-[10px] leading-relaxed text-slate-500 ${className}`}>
      {LEGAL_DISCLAIMER}
    </p>
  );
}
