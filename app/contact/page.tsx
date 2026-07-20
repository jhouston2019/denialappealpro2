import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./contact-form";

const OWNER_EMAIL = "info@axis-strategic-labs.com";

export const metadata: Metadata = {
  title: "Contact | Denial Appeal Pro",
  description:
    "Get help with Denial Appeal Pro. Contact Axis Strategic Labs for support and technical issues.",
};

export default function ContactPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <header className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e3a8a]">
              <span className="text-xs font-black text-white">ER</span>
            </div>
            <span className="text-sm font-semibold text-slate-50">
              Denial Appeal Pro
            </span>
          </Link>
          <nav className="flex gap-3 text-xs font-medium text-slate-200">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-slate-50">Contact</h1>
        <p className="mt-2 text-sm text-slate-400">
          If you run into problems, account issues, or bugs, write to us here or
          email{" "}
          <a
            className="font-medium text-blue-300 hover:underline"
            href={`mailto:${OWNER_EMAIL}`}
          >
            {OWNER_EMAIL}
          </a>{" "}
          directly.
        </p>
        <ContactForm />
        <p className="mt-8 text-xs text-slate-500">
          Axis Strategic Labs is the team behind Denial Appeal Pro. We aim to
          respond to support requests as soon as we can.
        </p>
      </main>
    </div>
  );
}
