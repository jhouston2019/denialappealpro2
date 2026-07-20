import Link from "next/link";
import { requireUserAndPaywall } from "@/lib/auth/serverPageGuards";
import { notFound } from "next/navigation";
import type { Report } from "@/lib/report-types";
import ExportControls from "./ExportControls";
import PrintStyles from "./PrintStyles";
import { getVerticalReportTitle } from "@/lib/verticalReportUtils";
import SupplementGenerator from "@/components/SupplementGenerator";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireUserAndPaywall();

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
  const vertical = analysis.vertical || '';
  const detectedTrades = analysis.detected_trades || [];
  const missingItems = analysis.missing_items || [];
  const quantityIssues = analysis.quantity_issues || [];
  const structuralGaps = analysis.structural_gaps || [];
  const pricingObservations = analysis.pricing_observations || [];
  const complianceNotes = analysis.compliance_notes || [];
  const criticalActions = analysis.critical_action_items || [];
  const missingValue = analysis.total_missing_value_estimate || { low: 0, high: 0 };
  const riskLevel = analysis.risk_level || 'unknown';

  const reportTitle = getVerticalReportTitle(vertical);

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
    <>
      <PrintStyles 
        claimNumber={propertyDetails.claim_number || ''}
        propertyAddress={propertyDetails.address || ''}
      />
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
              className="rounded-full border border-slate-700 px-3 py-1.5 hover:border-slate-500"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/reports"
              className="rounded-full bg-slate-900 px-3 py-1.5 text-blue-300"
            >
              Reports
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/reports"
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to Reports
          </Link>
        </div>

        {/* Watermark Info Bar - Visible on screen and print */}
        <div className="rounded-lg border-2 border-blue-500/40 bg-blue-500/5 px-4 py-3">
          <div className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-400">Claim:</span>
                <span className="ml-2 font-semibold text-blue-300">
                  {propertyDetails.claim_number || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Property:</span>
                <span className="ml-2 font-semibold text-slate-200">
                  {propertyDetails.address || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Date of Loss:</span>
                <span className="ml-2 font-semibold text-slate-200">
                  {propertyDetails.date_of_loss || 'N/A'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-red-400">CONFIDENTIAL</div>
              <div className="text-slate-400">Report ID: {report.id.substring(0, 8)}</div>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-slate-50">
                {reportTitle}
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                {propertyDetails.claim_number || 'No claim number'}
              </p>
            </div>
            <ExportControls reportId={report.id} />
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getRiskColor(riskLevel)}`}>
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
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-red-400">
                Missing Scope
              </p>
              <p className="mt-2 text-2xl font-bold text-red-400">
                {formatCurrency(missingValue.low)} - {formatCurrency(missingValue.high)}
              </p>
            </div>
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-yellow-400">
                Gap Percentage
              </p>
              <p className="mt-2 text-2xl font-bold text-yellow-400">
                {gapPercentageLow}% - {gapPercentageHigh}%
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-50">Property Information</h2>
          <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
            <div>
              <span className="text-slate-400">Address:</span>
              <span className="ml-2 text-slate-200">{propertyDetails.address || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400">Claim Number:</span>
              <span className="ml-2 text-slate-200">{propertyDetails.claim_number || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400">Date of Loss:</span>
              <span className="ml-2 text-slate-200">{propertyDetails.date_of_loss || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400">Adjuster:</span>
              <span className="ml-2 text-slate-200">{propertyDetails.adjuster || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400">Platform:</span>
              <span className="ml-2 text-slate-200">
                {classification.classification || 'Unknown'} ({classification.confidence || 0}% confidence)
              </span>
            </div>
            <div>
              <span className="text-slate-400">Line Items:</span>
              <span className="ml-2 text-slate-200">
                {classification.metadata?.line_item_count || 0}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-50">Issues Summary</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔴</span>
                <div>
                  <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
                  <p className="text-[11px] text-slate-400">Critical Items</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🟡</span>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">{warningCount}</p>
                  <p className="text-[11px] text-slate-400">Warnings</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔵</span>
                <div>
                  <p className="text-2xl font-bold text-blue-400">{infoCount}</p>
                  <p className="text-[11px] text-slate-400">Informational</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {detectedTrades.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">Detected Trades ({detectedTrades.length})</h2>
            <div className="mt-4 space-y-3">
              {detectedTrades.map((trade: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-blue-300">{trade.code}</span>
                      <span className="ml-2 text-xs text-slate-300">{trade.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      {formatCurrency(trade.subtotal)}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1">
                    {trade.line_items.slice(0, 3).map((item: any, itemIdx: number) => (
                      <div key={itemIdx} className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{item.description}</span>
                        <span>{item.quantity} {item.unit}</span>
                      </div>
                    ))}
                    {trade.line_items.length > 3 && (
                      <p className="text-[11px] text-slate-500">
                        + {trade.line_items.length - 3} more items
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {missingItems.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">Missing Items ({missingItems.length})</h2>
            <div className="mt-4 space-y-3">
              {missingItems.map((item: any, idx: number) => (
                <div key={idx} className={`rounded-xl border p-4 ${getSeverityColor(item.severity)}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{getSeverityIcon(item.severity)}</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-50">{item.category}</h3>
                      <p className="mt-1 text-xs text-slate-300">{item.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px]">
                        <div>
                          <span className="text-slate-400">Cost Impact:</span>
                          <span className="ml-1 font-semibold text-slate-200">
                            ${item.estimated_cost_impact}
                          </span>
                        </div>
                        {item.xactimate_codes && item.xactimate_codes.length > 0 && (
                          <div>
                            <span className="text-slate-400">Codes:</span>
                            <span className="ml-1 font-mono text-slate-300">
                              {item.xactimate_codes.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                      {item.justification && (
                        <p className="mt-2 text-[11px] italic text-slate-400">
                          {item.justification}
                        </p>
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
            <h2 className="text-sm font-semibold text-slate-50">Quantity Issues ({quantityIssues.length})</h2>
            <div className="mt-4 space-y-3">
              {quantityIssues.map((issue: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
                  <h3 className="text-sm font-semibold text-slate-50">{issue.line_item}</h3>
                  <p className="mt-1 text-xs text-slate-300">{issue.description}</p>
                  {issue.recommended_quantity && (
                    <p className="mt-2 text-[11px] text-yellow-400">
                      Recommended: {issue.recommended_quantity}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Cost Impact: ${typeof issue.cost_impact === 'number' ? issue.cost_impact.toFixed(2) : issue.cost_impact}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {structuralGaps.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">Structural Gaps ({structuralGaps.length})</h2>
            <div className="mt-4 space-y-3">
              {structuralGaps.map((gap: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-50">{gap.category}</h3>
                      <p className="mt-1 text-xs text-slate-300">{gap.description}</p>
                      <div className="mt-2 flex items-center gap-4 text-[11px]">
                        <span className="text-slate-400">Type: <span className="text-slate-200">{gap.gap_type.replace(/_/g, ' ')}</span></span>
                        {gap.xactimate_codes && (
                          <span className="text-slate-400">Codes: <span className="font-mono text-slate-300">{gap.xactimate_codes.join(', ')}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-red-400">${gap.estimated_cost}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {pricingObservations.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">Pricing Observations ({pricingObservations.length})</h2>
            <div className="mt-4 space-y-3">
              {pricingObservations.map((obs: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <h3 className="text-sm font-semibold text-slate-50">{obs.item}</h3>
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Observed:</span>
                      <span className="ml-1 text-slate-200">${obs.observed_price}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Typical Range:</span>
                      <span className="ml-1 text-slate-200">${obs.typical_range}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{obs.note}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {complianceNotes.length > 0 && (
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-slate-50">Compliance Notes ({complianceNotes.length})</h2>
            <div className="mt-4 space-y-3">
              {complianceNotes.map((note: any, idx: number) => (
                <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-50">{note.standard}</h3>
                      <p className="mt-1 text-xs text-slate-300">{note.requirement}</p>
                      <p className="mt-2 text-[11px] text-slate-400">{note.description}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      note.status === 'included' 
                        ? 'border-green-500/40 bg-green-500/10 text-green-400'
                        : 'border-red-500/40 bg-red-500/10 text-red-400'
                    }`}>
                      {note.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {criticalActions.length > 0 && (
          <section className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-red-400">Critical Action Items ({criticalActions.length})</h2>
            <div className="mt-4 space-y-2">
              {criticalActions.map((action: string, idx: number) => (
                <div key={idx} className="flex items-start gap-3 text-xs text-slate-200">
                  <span className="mt-0.5 text-red-400">✓</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <SupplementGenerator 
          reportData={{
            missingItems,
            quantityIssues,
            pricingObservations,
            vertical,
            propertyDetails
          }}
        />

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-50">Executive Summary</h2>
          <p className="mt-4 text-xs leading-relaxed text-slate-300">
            {analysis.summary}
          </p>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-lg">
          <h2 className="text-sm font-semibold text-slate-50">Analysis Metadata</h2>
          <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
            <div>
              <span className="text-slate-400">Processing Time:</span>
              <span className="ml-2 text-slate-200">{analysis.metadata?.processing_time_ms || 0}ms</span>
            </div>
            <div>
              <span className="text-slate-400">Model Version:</span>
              <span className="ml-2 text-slate-200">{analysis.metadata?.model_version || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400">Confidence Score:</span>
              <span className="ml-2 text-slate-200">{analysis.metadata?.confidence_score || 0}%</span>
            </div>
            <div>
              <span className="text-slate-400">Analysis Depth:</span>
              <span className="ml-2 text-slate-200">{analysis.metadata?.analysis_depth || 'standard'}</span>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard/reports"
            className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-slate-50"
          >
            ← Back to Reports
          </Link>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-slate-50"
          >
            🖨️ Print Report
          </button>
        </div>
      </main>
    </div>
    </>
  );
}
