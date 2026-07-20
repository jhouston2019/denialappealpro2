import Link from "next/link";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import type { Report } from "@/lib/report-types";

export default async function ReportsPage() {
  const { supabase } = await requireUserAndPaywall();

  const { data } = await supabase
    .from("reports")
    .select("*")
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

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
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
              href="/dashboard"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500 hover:text-slate-50"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/reports"
              className="rounded-full bg-slate-900 px-3 py-1.5 text-blue-300"
            >
              Reports
            </Link>
            <Link
              href="/account"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500 hover:text-slate-50"
            >
              Account
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8">
        <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-300">
              Analysis Reports
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">
              Estimate Analysis Reports
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Comprehensive analysis of insurance estimates with gap identification and cost impact assessment.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 text-xs text-slate-200 md:items-end">
            <Link
              href="/upload?new=1"
              className="inline-flex items-center justify-center rounded-full bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#2563EB]/40 hover:bg-[#1E40AF]"
            >
              New Analysis
            </Link>
          </div>
        </section>

        {!reports || reports.length === 0 ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-8 text-center shadow-lg">
            <p className="text-sm text-slate-400">
              No reports yet. Upload an estimate to generate your first analysis report.
            </p>
            <Link
              href="/upload?new=1"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[#2563EB] px-6 py-2 text-xs font-semibold text-white shadow-md hover:bg-[#1E40AF]"
            >
              Upload Estimate
            </Link>
          </section>
        ) : (
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

              return (
                <div
                  key={report.id}
                  className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg transition-all hover:border-slate-700 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Link href={`/dashboard/reports/${report.id}`}>
                        <h3 className="text-sm font-semibold text-slate-50 hover:text-blue-300 cursor-pointer">
                          {report.estimate_name}
                        </h3>
                      </Link>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {propertyDetails.claim_number || 'No claim number'}
                      </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getRiskColor(riskLevel)}`}>
                      {riskLevel.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Estimate Value</span>
                      <span className="font-semibold text-slate-200">
                        {estimateValue > 0 ? formatCurrency(estimateValue) : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Missing Scope</span>
                      <span className="font-semibold text-red-400">
                        {missingValue.low > 0 || missingValue.high > 0
                          ? formatCurrencyRange(missingValue.low, missingValue.high)
                          : '$0'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Gap Percentage</span>
                      <span className="font-semibold text-yellow-400">
                        {gapPercentageLow > 0 || gapPercentageHigh > 0
                          ? `${gapPercentageLow}% - ${gapPercentageHigh}%`
                          : '0%'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 border-t border-slate-800 pt-4">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-red-400">🔴 {criticalCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-yellow-400">🟡 {warningCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-blue-400">🔵 {missingItems.length - criticalCount - warningCount}</span>
                    </div>
                    <div className="ml-auto text-[11px] text-slate-400">
                      {classification.confidence || 0}% confidence
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
                    <div className="text-[11px] text-slate-400">
                      {new Date(report.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/reports/${report.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-[10px] font-medium text-slate-200 hover:border-blue-500 hover:text-blue-300 transition-colors"
                      >
                        View
                      </Link>
                      <a
                        href={`/api/reports/${report.id}/export?format=pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-[10px] font-medium text-slate-200 hover:border-green-500 hover:text-green-300 transition-colors"
                        title="Download PDF"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDF
                      </a>
                      <a
                        href={`/api/reports/${report.id}/export?format=excel`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/50 px-3 py-1 text-[10px] font-medium text-slate-200 hover:border-yellow-500 hover:text-yellow-300 transition-colors"
                        title="Download Excel"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Excel
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
