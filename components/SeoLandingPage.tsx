import React from "react";
import Link from "next/link";

interface SeoSection {
  heading: string;
  body: string;
}

interface SeoFaq {
  question: string;
  answer: string;
}

interface SeoLandingPageProps {
  title: string;
  subtitle: string;
  description: string;
  sections: SeoSection[];
  faqs: SeoFaq[];
  ctaLabel: string;
  ctaHref: string;
  schema?: Record<string, any>;
}

export function SeoLandingPage({
  title,
  subtitle,
  description,
  sections,
  faqs,
  ctaLabel,
  ctaHref,
  schema,
}: SeoLandingPageProps) {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Schema.org JSON-LD */}
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}

      {/* Header */}
      <header className="bg-[#0F172A] border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB]">
              <span className="text-xs font-black text-white">ER</span>
            </div>
            <span className="text-white font-semibold">Denial Appeal Pro</span>
          </Link>
          <Link 
            href="/pricing"
            className="rounded-full bg-[#2563EB] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8] transition"
          >
            Start Review
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#0F172A] to-[#1e293b] text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">{title}</h1>
          <p className="text-xl md:text-2xl mb-6 text-slate-200">{subtitle}</p>
          <p className="text-lg mb-10 text-slate-300 max-w-3xl mx-auto">{description}</p>
          <Link
            href={ctaHref}
            className="inline-block bg-[#2563EB] text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-[#1E40AF] transition"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* Content Sections */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        {sections.map((section, index) => (
          <div key={index} className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {section.heading}
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-line">
              {section.body}
            </p>
          </div>
        ))}
      </section>

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section className="bg-white py-12">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-gray-200 pb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {faq.question}
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-[#0F172A] to-[#1e293b] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Analyze Your Estimate?</h2>
          <p className="text-xl mb-8 text-slate-300">
            Structured analysis in under 2 minutes. No credit card required for preview.
          </p>
          <Link
            href={ctaHref}
            className="inline-block bg-[#2563EB] text-white px-10 py-4 rounded-lg font-semibold text-lg hover:bg-[#1E40AF] transition"
          >
            {ctaLabel}
          </Link>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="bg-slate-100 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <p className="text-sm text-slate-600 text-center">
            This tool generates structured findings only. No coverage, pricing, or entitlement determinations are made.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] text-white py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-400">
            © {new Date().getFullYear()} Denial Appeal Pro. All rights reserved.
          </p>
          <div className="mt-4 space-x-6">
            <Link href="/pricing" className="text-slate-400 hover:text-white transition">
              Pricing
            </Link>
            <Link href="/" className="text-slate-400 hover:text-white transition">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

