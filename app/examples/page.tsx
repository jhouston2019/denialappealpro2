import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { Report } from "@/lib/report-types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export default async function ExamplesPage() {
  const { data } = await supabase
    .from("reports")
    .select("*")
    .in('id', [
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000007',
    ])
    .order("created_at", { ascending: false });

  const reports = (data as Report[] | null) ?? [];

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function formatCurrencyRange(low: number, high: number) {
    return `${formatCurrency(low)} - ${formatCurrency(high)}`;
  }

  function getRiskColor(risk: string) {
    switch (risk) {
      case 'high': return 'text-red-400 bg-red-500/10 border-red-500/40';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40';
      case 'low': return 'text-green-400 bg-green-500/10 border-green-500/40';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/40';
    }
  }

  function getRiskEmoji(risk: string) {
    switch (risk) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  function getDamageTypeLabel(damageType: string) {
    const labels: Record<string, string> = {
      'water_damage': 'Water Damage',
      'fire_damage': 'Fire Damage',
      'storm_damage': 'Storm Damage',
      'hurricane_damage': 'Hurricane Damage',
      'hail_wind_damage': 'Hail & Wind',
      'mold_damage': 'Mold Remediation',
    };
    return labels[damageType] || damageType;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1e3a8a] shadow-lg shadow-[#1e3a8a]/30">
              <span className="text-xs font-black text-white">ER</span>
            </div>
            <span className="text-sm font-semibold text-slate-50">
              Denial Appeal Pro
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-xs font-medium text-slate-200">
            <Link
              href="/"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500 hover:text-slate-50"
            >
              Home
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500 hover:text-slate-50"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500 hover:text-slate-50"
            >
              Log in
            </Link>
            <Link
              href="/pricing"
              className="rounded-full bg-[#2563EB] px-4 py-1.5 font-semibold text-white hover:bg-[#1E40AF]"
            >
              Start Review
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-12">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            Example Reports
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-50 md:text-5xl">
            See What Our Analysis Finds
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
            Explore 7 comprehensive example reports covering different damage types, property types, and scope completeness levels. 
            Each report demonstrates our AI-powered gap identification and cost impact analysis.
          </p>
        </section>

        <section className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-8">
          <div className="flex items-start gap-4">
            <span className="text-4xl">💡</span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-blue-300">What You'll See</h2>
              <p className="mt-2 text-base leading-relaxed text-slate-300">
                These are real, comprehensive analysis reports generated by our system. Each report includes: 
                estimate classification, detected trades, missing items with cost impacts, quantity issues, 
                structural gaps, pricing observations, compliance notes, and actionable recommendations. 
                Total value analyzed: <span className="font-semibold text-white">$962,877</span> with 
                <span className="font-semibold text-white"> $85K-$179K</span> in gaps identified.
              </p>
            </div>
          </div>
        </section>

        {!reports || reports.length === 0 ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-12 text-center shadow-lg">
            <p className="text-sm text-slate-400">
              Example reports are being loaded. Please refresh the page in a moment.
            </p>
            <p className="mt-4 text-xs text-slate-500">
              If reports don't appear, run: <code className="rounded bg-slate-900 px-2 py-1">supabase db reset</code>
            </p>
          </section>
        ) : (
          <>
            <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {reports.map((report: any) => {
                const analysis = report.result_json;
                const propertyDetails = analysis.property_details || {};
                const classification = analysis.classification || {};
                const missingValue = analysis.total_missing_value_estimate || { low: 0, high: 0 };
                const riskLevel = analysis.risk_level || 'unknown';
                const missingItems = analysis.missing_items || [];
                const estimateValue = propertyDetails.total_estimate_value || 0;
                
                const gapPercentageLow = estimateValue > 0 
                  ? Math.round((missingValue.low / estimateValue) * 100) 
                  : 0;
                const gapPercentageHigh = estimateValue > 0 
                  ? Math.round((missingValue.high / estimateValue) * 100) 
                  : 0;

                const criticalCount = missingItems.filter((i: any) => i.severity === 'error').length;
                const warningCount = missingItems.filter((i: any) => i.severity === 'warning').length;
                const infoCount = missingItems.filter((i: any) => i.severity === 'info').length;

                return (
                  <Link
                    key={report.id}
                    href={`/examples/${report.id}`}
                    className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg transition-all hover:border-slate-700 hover:shadow-xl hover:scale-[1.02]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-2 inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-400">
                          {getDamageTypeLabel(report.damage_type || '')}
                        </div>
                        <h3 className="text-base font-semibold leading-snug text-slate-50 group-hover:text-blue-300">
                          {report.estimate_name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {propertyDetails.claim_number || 'No claim number'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${getRiskColor(riskLevel)}`}>
                        {getRiskEmoji(riskLevel)} {riskLevel.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3 border-t border-slate-800 pt-5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Estimate Value</span>
                        <span className="font-semibold text-slate-200">
                          {estimateValue > 0 ? formatCurrency(estimateValue) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Missing Scope</span>
                        <span className="font-semibold text-red-400">
                          {missingValue.low > 0 || missingValue.high > 0
                            ? formatCurrencyRange(missingValue.low, missingValue.high)
                            : '$0'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Gap Percentage</span>
                        <span className={`font-semibold ${gapPercentageHigh > 30 ? 'text-red-400' : gapPercentageHigh > 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {gapPercentageLow > 0 || gapPercentageHigh > 0
                            ? `${gapPercentageLow}% - ${gapPercentageHigh}%`
                            : '0%'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-red-400">🔴 {criticalCount}</span>
                        <span className="text-yellow-400">🟡 {warningCount}</span>
                        <span className="text-blue-400">🔵 {infoCount}</span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {classification.confidence || 0}% confidence
                      </div>
                    </div>

                    <div className="mt-4 text-right">
                      <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300">
                        View Full Report →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
              <h2 className="text-lg font-semibold text-slate-50">
                Ready to Analyze Your Own Estimates?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">
                Get the same comprehensive analysis for your insurance estimates. 
                Identify missing scope, quantity issues, and structural gaps in under 2 minutes.
              </p>
              <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-lg bg-[#2563EB] px-8 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF] transition"
                >
                  Start Your Review
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-8 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition"
                >
                  View Pricing
                </Link>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
              <h2 className="text-sm font-semibold text-slate-50">About These Examples</h2>
              <div className="mt-4 grid gap-6 text-xs md:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-blue-300">Coverage</h3>
                  <ul className="mt-2 space-y-1 text-slate-300">
                    <li>• 7 different damage types</li>
                    <li>• Residential and commercial properties</li>
                    <li>• $3K to $388K estimate range</li>
                    <li>• Xactimate and manual estimates</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-300">Analysis Includes</h3>
                  <ul className="mt-2 space-y-1 text-slate-300">
                    <li>• Missing items with cost impacts</li>
                    <li>• Quantity validation</li>
                    <li>• Structural gap identification</li>
                    <li>• Compliance checking (IICRC, IBC, NEC)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-300">Key Findings</h3>
                  <ul className="mt-2 space-y-1 text-slate-300">
                    <li>• Average gap: 20-43% in under-scoped estimates</li>
                    <li>• $85K-$179K total gaps identified</li>
                    <li>• 92% average confidence score</li>
                    <li>• Industry standards validated</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-blue-300">Report Types</h3>
                  <ul className="mt-2 space-y-1 text-slate-300">
                    <li>• Minimal scope (114% gap)</li>
                    <li>• Typical claims (17-43% gaps)</li>
                    <li>• Large commercial ($60K gaps)</li>
                    <li>• Complete scope (0% gap - gold standard)</li>
                  </ul>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/90 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-xs text-slate-400">
            Example reports use fictional data for demonstration purposes.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            © 2024 Denial Appeal Pro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
