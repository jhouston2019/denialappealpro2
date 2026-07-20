import Link from "next/link";

const CONTACT_EMAIL = "info@axis-strategic-labs.com";

export function SiteFooter() {
  return (
    <footer
      className="mt-auto border-t border-slate-800/80 bg-slate-950/90 py-5 text-center text-[11px] text-slate-500"
      role="contentinfo"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 px-4 sm:flex-row sm:gap-6">
        <span className="text-slate-600">
          © {new Date().getFullYear()} Denial Appeal Pro
        </span>
        <span className="hidden text-slate-700 sm:inline" aria-hidden>
          |
        </span>
        <Link
          href="/contact"
          className="font-medium text-blue-300/90 hover:text-blue-200 hover:underline"
        >
          Contact
        </Link>
        <span className="hidden text-slate-700 sm:inline" aria-hidden>
          |
        </span>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-slate-500 hover:text-slate-300"
        >
          {CONTACT_EMAIL}
        </a>
      </div>
    </footer>
  );
}
