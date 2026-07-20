"use client";

import { useState, type FormEvent } from "react";

const OWNER_EMAIL = "info@axis-strategic-labs.com";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  /** Honeypot: leave empty (bots may fill it). */
  const [hpCompany, setHpCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errText, setErrText] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrText(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          company: "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setErrText(
          data.error ||
            (res.status === 503
              ? "The contact form is not available right now. Please email us using the address below."
              : "Could not send. Please try email below.")
        );
        setStatus("err");
        return;
      }
      setStatus("ok");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setErrText("Network error. Please email us at the address below.");
      setStatus("err");
    }
  };

  if (status === "ok") {
    return (
      <div
        className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
        role="status"
      >
        Thanks — your message was sent. We will get back to you as soon as we can.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {/* Honeypot: hidden from users, bots often fill it */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="contact-company">Company</label>
        <input
          id="contact-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hpCompany}
          onChange={(e) => setHpCompany(e.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="contact-name"
          className="text-[11px] font-medium text-slate-500"
        >
          Name
        </label>
        <input
          id="contact-name"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={200}
          autoComplete="name"
        />
      </div>
      <div>
        <label
          htmlFor="contact-email"
          className="text-[11px] font-medium text-slate-500"
        >
          Your email
        </label>
        <input
          id="contact-email"
          type="email"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={320}
          autoComplete="email"
        />
      </div>
      <div>
        <label
          htmlFor="contact-message"
          className="text-[11px] font-medium text-slate-500"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          className="mt-1 min-h-[160px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          minLength={10}
          maxLength={10000}
          placeholder="Describe the issue, including any error messages you saw."
        />
      </div>
      {errText ? (
        <p className="text-sm text-amber-300" role="alert">
          {errText}{" "}
          <a
            className="font-medium text-blue-300 underline hover:text-blue-200"
            href={`mailto:${OWNER_EMAIL}?subject=${encodeURIComponent("Denial Appeal Pro — support")}`}
          >
            Email {OWNER_EMAIL}
          </a>
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-500 disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
