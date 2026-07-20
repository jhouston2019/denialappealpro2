import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Report } from "@/lib/report-types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export default async function ExampleReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  const report = data as Report | null;

  if (!report || !report.result_json) {
    notFound();
  }

  const analysis = report.result_json;
  const propertyDetails = analysis.property_details || {};
  const classification = analysis.classification || {};
  const detectedTrades = analysis.detected_trades || [];
  const missingItems = analysis.missing_items || [];
  const quantityIssues = analysis.quantity_issues || [];
  const structuralGaps = analysis.structural_gaps || [];
  const pricingObservations = analysis.pricing_observations || [];
  const complianceNotes = analysis.compliance_notes || [];
  const criticalActions = analysis.critical_action_items || [];
  const missingValue = analysis.total_missing_value_estimate || { low: 0, high: 0 };
  const riskLevel = analysis.risk_level || 'unknown';

  const estimateValue = propertyDetails.total_estimate_value || 0;
  const gapPercentageLow = estimateValue > 0 
    ? Math.round((missingValue.low / estimateValue) * 100) 
    : 0;
  const gapPercentageHigh = estimateValue > 0 
    ? Math.round((missingValue.high / estimateValue) * 100) 
    : 0;

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getRiskColor(risk: string) {
    switch (risk) {
      case 'high': return 'text-red-400 bg-red-500/10 border-red-500/40';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/40';
      case 'low': return 'text-green-400 bg-green-500/10 border-green-500/40';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/40';
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'error': return 'border-red-500/40 bg-red-500/5';
      case 'warning': return 'border-yellow-500/40 bg-yellow-500/5';
      case 'info': return 'border-blue-500/40 bg-blue-500/5';
      default: return 'border-slate-700 bg-slate-900/50';
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

  const criticalCount = missingItems.filter((i: any) => i.severity === 'error').length;
  const warningCount = missingItems.filter((i: any) => i.severity === 'warning').length;
  const infoCount = missingItems.filter((i: any) => i.severity === 'info').length;

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
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500"
            >
              Home
            </Link>
            <Link
              href="/examples"
              className="rounded-full bg-slate-900 px-3 py-1.5 text-blue-300"
            >
              Examples
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500"
            >
              Pricing
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

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex items-center gap-3">
          <Link
            href="/examples"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to Examples
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <div className="mb-4 inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            📊 Example Report
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-50">
                {report.estimate_name}
              </h1>
              <p className="mt-2 text-xs text-slate-400">
                {propertyDetails.claim_number || 'No claim number'} • {propertyDetails.address || 'No address'}
              </p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${getRiskColor(riskLevel)}`}>
              {riskLevel.toUpperCase()} RISK
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Estimate Value
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-50">
                {formatCurrency(estimateValue)}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {classification.metadata?.line_item_count || 0} line items
              </p>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-red-400">
                Missing Scope
              </p>
              <p className="mt-2 text-2xl font-bold text-red-400">
                {formatCurrency(missingValue.low)} - {formatCurrency(missingValue.high)}
              </p>
              <p className="mt-1 text-[10px] text-red-300">
                {missingItems.length} items identified
              </p>
            </div>
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-yellow-400">
                Gap Percentage
              </p>
              <p className="mt-2 text-2xl font-bold text-yellow-400">
                {gapPercentageLow}% - {gapPercentageHigh}%
              </p>
              <p className="mt-1 text-[10px] text-yellow-300">
                of original estimate
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-50">Property Information</h2>
          <div className="mt-4 grid gap-3 text-xs md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Address</span>
              <p className="mt-1 text-slate-200">{propertyDetails.address || 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Claim Number</span>
              <p className="mt-1 text-slate-200">{propertyDetails.claim_number || 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Date of Loss</span>
              <p className="mt-1 text-slate-200">{propertyDetails.date_of_loss || 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Adjuster</span>
              <p className="mt-1 text-slate-200">{propertyDetails.adjuster || 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Platform</span>
              <p className="mt-1 text-slate-200">
                {classification.classification || 'Unknown'} ({classification.confidence || 0}%)
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Trades Detected</span>
              <p className="mt-1 text-slate-200">{detectedTrades.length} categories</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-50">Issues Summary</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔴</span>
                <div>
                  <p className="text-3xl font-bold text-red-400">{criticalCount}</p>
                  <p className="text-[11px] text-slate-400">Critical Items</p>
                  <p className="mt-1 text-[10px] text-red-300">Must be addressed</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🟡</span>
                <div>
                  <p className="text-3xl font-bold text-yellow-400">{warningCount}</p>
                  <p className="text-[11px] text-slate-400">Warnings</p>
                  <p className="mt-1 text-[10px] text-yellow-300">Should be reviewed</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔵</span>
                <div>
                  <p className="text-3xl font-bold text-blue-400">{infoCount}</p>
                  <p className="text-[11px] text-slate-400">Informational</p>
                  <p className="mt-1 text-[10px] text-blue-300">Best practices</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {detectedTrades.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">
              Detected Trades ({detectedTrades.length})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Trade categories found in the estimate
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {detectedTrades.map((trade: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="inline-flex items-center rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                        {trade.code}
                      </span>
                      <p className="mt-2 text-xs font-semibold text-slate-200">{trade.name}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {trade.line_items.length} line items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-50">
                        {formatCurrency(trade.subtotal)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {missingItems.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">
              Missing Items ({missingItems.length})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Items not found in the estimate that are typically expected for this damage type
            </p>
            <div className="mt-4 space-y-3">
              {missingItems.map((item: any, idx: number) => (
                <div key={idx} className={`rounded-xl border p-5 ${getSeverityColor(item.severity)}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getSeverityIcon(item.severity)}</span>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-sm font-semibold text-slate-50">{item.category}</h3>
                        <span className="text-sm font-bold text-slate-50">
                          ${item.estimated_cost_impact}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.description}</p>
                      {item.xactimate_codes && item.xactimate_codes.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-[10px] text-slate-500">Xactimate Codes:</span>
                          {item.xactimate_codes.map((code: string, cIdx: number) => (
                            <span key={cIdx} className="inline-flex items-center rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                              {code}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.justification && (
                        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">Justification</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                            {item.justification}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {quantityIssues.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">
              Quantity Issues ({quantityIssues.length})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Line items with incorrect or insufficient quantities
            </p>
            <div className="mt-4 space-y-3">
              {quantityIssues.map((issue: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                  <h3 className="text-sm font-semibold text-slate-50">{issue.line_item}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-300">{issue.description}</p>
                  {issue.recommended_quantity && (
                    <div className="mt-3 flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400">Recommended:</span>
                      <span className="font-semibold text-yellow-300">{issue.recommended_quantity}</span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span className="text-slate-400">Cost Impact:</span>
                    <span className="font-semibold text-slate-200">
                      ${typeof issue.cost_impact === 'number' ? issue.cost_impact.toFixed(2) : issue.cost_impact}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {structuralGaps.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">
              Structural Gaps ({structuralGaps.length})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Missing trades or incomplete scope that affects structural integrity
            </p>
            <div className="mt-4 space-y-3">
              {structuralGaps.map((gap: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-50">{gap.category}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{gap.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="text-slate-400">
                          Type: <span className="text-slate-200">{gap.gap_type.replace(/_/g, ' ')}</span>
                        </span>
                        {gap.xactimate_codes && gap.xactimate_codes.length > 0 && (
                          <span className="text-slate-400">
                            Codes: <span className="font-mono text-slate-300">{gap.xactimate_codes.join(', ')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-400">${gap.estimated_cost}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {pricingObservations.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">
              Pricing Observations ({pricingObservations.length})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Market comparison for key line items
            </p>
            <div className="mt-4 space-y-3">
              {pricingObservations.map((obs: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <h3 className="text-sm font-semibold text-slate-50">{obs.item}</h3>
                  <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
                    <div>
                      <span className="text-slate-400">Observed Price:</span>
                      <span className="ml-2 font-semibold text-slate-200">${obs.observed_price}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Typical Range:</span>
                      <span className="ml-2 font-semibold text-slate-200">${obs.typical_range}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{obs.note}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {complianceNotes.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">
              Compliance Notes ({complianceNotes.length})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Industry standards and building code requirements
            </p>
            <div className="mt-4 space-y-3">
              {complianceNotes.map((note: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-50">{note.standard}</h3>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          note.status === 'included' 
                            ? 'border-green-500/40 bg-green-500/10 text-green-400'
                            : 'border-red-500/40 bg-red-500/10 text-red-400'
                        }`}>
                          {note.status === 'included' ? '✓' : '✗'} {note.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{note.requirement}</p>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{note.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {criticalActions.length > 0 && (
          <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-red-400">
              Critical Action Items ({criticalActions.length})
            </h2>
            <p className="mt-1 text-xs text-red-300">
              Recommended actions to address identified gaps
            </p>
            <div className="mt-4 space-y-2">
              {criticalActions.map((action: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-slate-900/50 p-3 text-xs text-slate-200">
                  <span className="mt-0.5 font-bold text-red-400">{idx + 1}.</span>
                  <span className="flex-1">{action}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-50">Executive Summary</h2>
          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            {analysis.summary}
          </p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-50">Analysis Metadata</h2>
          <div className="mt-4 grid gap-3 text-xs md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Processing Time</span>
              <p className="mt-1 font-semibold text-slate-200">{analysis.metadata?.processing_time_ms || 0}ms</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Model Version</span>
              <p className="mt-1 font-semibold text-slate-200">{analysis.metadata?.model_version || 'N/A'}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Confidence Score</span>
              <p className="mt-1 font-semibold text-slate-200">{analysis.metadata?.confidence_score || 0}%</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Analysis Depth</span>
              <p className="mt-1 font-semibold text-slate-200">{analysis.metadata?.analysis_depth || 'standard'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-slate-50">
              Get This Level of Analysis for Your Estimates
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">
              This is an example report. Start your own comprehensive estimate analysis in under 2 minutes.
            </p>
            <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-lg bg-[#2563EB] px-8 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF] transition"
              >
                Start Your Review
              </Link>
              <Link
                href="/examples"
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-8 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:text-white transition"
              >
                ← View All Examples
              </Link>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <p>Example report • Fictional data for demonstration</p>
        </div>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/90 py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-xs text-slate-400">
              © 2024 Denial Appeal Pro. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <Link href="/pricing" className="text-slate-400 hover:text-slate-200">
                Pricing
              </Link>
              <Link href="/examples" className="text-slate-400 hover:text-slate-200">
                Examples
              </Link>
              <Link href="/login" className="text-slate-400 hover:text-slate-200">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
