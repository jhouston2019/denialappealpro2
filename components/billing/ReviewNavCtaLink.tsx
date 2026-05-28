import Link from "next/link";
import {
  reviewNavCtaFromSnapshot,
  type ReviewNavBillingInput,
} from "@/lib/billing/reviewNavCta";

type Props = {
  billing: ReviewNavBillingInput;
  /** Dashboard/account (slate) vs wizard/deliverables (blue CTA). */
  variant?: "slate" | "wizard" | "ghost-cta" | "dashboard-header" | "dashboard-hero";
  className?: string;
};

export function ReviewNavCtaLink({
  billing,
  variant = "slate",
  className,
}: Props) {
  const cta = reviewNavCtaFromSnapshot(billing);

  const defaultClass =
    variant === "dashboard-hero"
      ? "mt-6 inline-flex items-center justify-center rounded-full bg-[#2563EB] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#2563EB]/50 transition hover:bg-[#1E40AF] sm:px-10 sm:py-4 sm:text-lg"
      : variant === "dashboard-header"
        ? "inline-flex shrink-0 items-center justify-center rounded-full bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#2563EB]/50 transition hover:bg-[#1E40AF] sm:px-6 sm:py-3 sm:text-base"
        : variant === "wizard"
        ? "shrink-0 rounded-full bg-[#2563EB] px-2.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-[#2563EB]/40 transition hover:bg-[#1E40AF] sm:px-4 sm:py-2 sm:text-sm"
        : variant === "ghost-cta"
          ? "erp-btn-cta"
          : "rounded-full bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-[#2563EB]/40 transition hover:bg-[#1E40AF] sm:px-4 sm:py-2 sm:text-sm";

  return (
    <Link href={cta.href} className={className ?? defaultClass}>
      {cta.label}
    </Link>
  );
}
