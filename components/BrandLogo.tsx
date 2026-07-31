import Link from "next/link";

type BrandLogoProps = {
  size?: "sm" | "md";
  href?: string;
  className?: string;
};

export function BrandLogo({
  size = "sm",
  href = "/",
  className = "",
}: BrandLogoProps) {
  const box =
    size === "md"
      ? "h-9 w-9 text-sm"
      : "h-8 w-8 text-xs";
  const label = size === "md" ? "text-sm" : "text-xs";

  return (
    <Link href={href} className={`flex min-w-0 items-center gap-2 ${className}`}>
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg bg-[#2563EB] font-black text-white ${box}`}
      >
        DAP
      </div>
      <span className={`truncate font-semibold text-white ${label}`}>
        Denial Appeal Pro
      </span>
    </Link>
  );
}
