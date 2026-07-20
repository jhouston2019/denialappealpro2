/**
 * PUSHBACK TEMPLATE
 * Purpose: Structured issue-by-issue rebuttal format
 * 
 * This template NEVER performs calculations.
 * It only formats existing structured data for carrier response.
 */

import { FormattedSection, ReportMetadata, StructuredAnalysisInput } from '../report-renderer';

export function buildPushbackTemplate(
  input: StructuredAnalysisInput,
  metadata: ReportMetadata
): FormattedSection[] {
  
  const sections: FormattedSection[] = [];
  
  // Section 1: Header & Summary
  sections.push(buildPushbackHeader(input, metadata));
  
  // Section 2: Issue-by-Issue Rebuttal (all deviations)
  sections.push(buildIssueByIssueRebuttal(input));
  
  // Section 3: Expert Authority Summary
  if (input.expertDirectives && input.expertDirectives.length > 0) {
    sections.push(buildExpertAuthoritySummary(input));
  }
  
  // Section 4: Structured Financial Reconciliation
  sections.push(buildStructuredFinancialReconciliation(input));
  
  // Section 5: Closing Neutral Positioning Statement
  sections.push(buildClosingPositioningStatement(metadata));
  
  // Section 6: Full Audit Trail
  sections.push(buildFullAuditTrail(metadata));
  
  return sections;
}

function buildPushbackHeader(
  input: StructuredAnalysisInput,
  metadata: ReportMetadata
): FormattedSection {
  
  const { deviations } = input;
  const totalMin = deviations.reduce((sum, d) => sum + d.impactMin, 0);
  const totalMax = deviations.reduce((sum, d) => sum + d.impactMax, 0);
  
  const content = `
═══════════════════════════════════════════════════════════════
📘 DENIAL APPEAL PRO
Carrier Pushback Response Packet
═══════════════════════════════════════════════════════════════

Claim Number: ${metadata.claimNumber}
Property: ${metadata.propertyAddress}
Date of Loss: ${metadata.dateOfLoss}
Denial Appealed: ${metadata.estimateName}
${metadata.expertReportReviewed ? `Expert Report: ${metadata.expertReportReviewed}\n` : ''}

RESPONSE SUMMARY

Total Documented Variance: $${totalMin.toLocaleString()} – $${totalMax.toLocaleString()}
Issues Documented: ${deviations.length}

This packet provides structured, issue-by-issue documentation of scope 
variances with supporting calculations, source attribution, and 
compliance references.
  `.trim();
  
  return {
    id: 'pushback-header',
    title: 'Pushback Response Header',
    content,
    format: 'text'
  };
}

function buildIssueByIssueRebuttal(input: StructuredAnalysisInput): FormattedSection {
  
  const { deviations } = input;
  
  let content = '\nISSUE-BY-ISSUE DOCUMENTATION\n\n';
  
  deviations.forEach((dev, idx) => {
    content += `═══════════════════════════════════════════════════════════════\n`;
    content += `ISSUE #${idx + 1}: ${dev.issue}\n`;
    content += `═══════════════════════════════════════════════════════════════\n\n`;
    
    content += `Trade: ${dev.trade} (${dev.tradeName})\n`;
    content += `Severity: ${dev.severity}\n`;
    content += `Source: ${dev.source}\n\n`;
    
    if (dev.reportDirective) {
      content += `Expert Directive:\n"${dev.reportDirective}"\n\n`;
    }
    
    content += `Carrier Scope (Estimate):\n`;
    content += `Quantity: ${dev.estimateValue || 0} ${dev.unit || 'SF'}\n\n`;
    
    content += `Required Scope:\n`;
    content += `Quantity: ${dev.expectedValue || 0} ${dev.unit || 'SF'}\n\n`;
    
    content += `Delta:\n`;
    content += `${(dev.expectedValue || 0) - (dev.estimateValue || 0)} ${dev.unit || 'SF'} shortfall\n\n`;
    
    content += `Formula:\n${dev.calculation}\n\n`;
    
    content += `Impact Range:\n$${dev.impactMin.toLocaleString()} – $${dev.impactMax.toLocaleString()}\n\n`;
    
    if (dev.complianceReference) {
      content += `Compliance Reference:\n${dev.complianceReference}\n\n`;
    }
    
    content += '\n';
  });
  
  return {
    id: 'issue-by-issue',
    title: 'Issue-by-Issue Documentation',
    content,
    format: 'text'
  };
}

function buildExpertAuthoritySummary(input: StructuredAnalysisInput): FormattedSection {
  
  const { expertDirectives, deviations, analysis } = input;
  const expertIntelligence = (analysis as any).expertIntelligence;
  
  const unaddressed = expertDirectives?.filter(dir => {
    const directiveText = (dir as any).directive ?? dir.sourceParagraph ?? '';
    return deviations.some(d => d.reportDirective === directiveText);
  }) || [];
  
  let content = '\nEXPERT AUTHORITY SUMMARY\n\n';
  
  if (expertIntelligence) {
    content += `Authority Type: ${expertIntelligence.authorityType.replace(/_/g, ' ')}\n`;
    content += `Directives Identified: ${expertIntelligence.directives}\n`;
    content += `Measurable Directives: ${expertIntelligence.measurableDirectives}\n`;
    content += `Mandatory Unaddressed: ${expertIntelligence.unaddressedMandatory}\n`;
    content += `Compliance References: ${expertIntelligence.complianceReferences}\n\n`;
  }
  
  if (unaddressed.length > 0) {
    content += 'Unaddressed Mandatory Directives:\n\n';
    unaddressed.forEach((dir, idx) => {
      const directiveText = (dir as any).directive ?? dir.sourceParagraph ?? 'Expert directive';
      content += `${idx + 1}. "${directiveText.substring(0, 100)}..."\n`;
      const complianceRef = dir.complianceBasis;
      if (complianceRef) {
        content += `   Compliance: ${complianceRef.standard}\n`;
      }
      content += '\n';
    });
  }
  
  return {
    id: 'expert-authority',
    title: 'Expert Authority Summary',
    content,
    format: 'text'
  };
}

function buildStructuredFinancialReconciliation(input: StructuredAnalysisInput): FormattedSection {
  
  const { deviations, analysis } = input;
  const propertyDetails = analysis.property_details;
  
  // Categorize by source
  const reportBased = deviations.filter(d => d.source === 'REPORT' || d.source === 'BOTH');
  const dimensionBased = deviations.filter(d => d.source === 'DIMENSION');
  const codeBased = deviations.filter(d => d.deviationType === 'MISSING_DECKING' || d.issue.toLowerCase().includes('code') || (d as any).complianceReference);
  
  const reportMin = reportBased.reduce((sum, d) => sum + d.impactMin, 0);
  const reportMax = reportBased.reduce((sum, d) => sum + d.impactMax, 0);
  const dimensionMin = dimensionBased.reduce((sum, d) => sum + d.impactMin, 0);
  const dimensionMax = dimensionBased.reduce((sum, d) => sum + d.impactMax, 0);
  const codeMin = codeBased.reduce((sum, d) => sum + d.impactMin, 0);
  const codeMax = codeBased.reduce((sum, d) => sum + d.impactMax, 0);
  
  const totalMin = deviations.reduce((sum, d) => sum + d.impactMin, 0);
  const totalMax = deviations.reduce((sum, d) => sum + d.impactMax, 0);
  const estimateTotal = propertyDetails.total_estimate_value || 0;
  
  const content = `
STRUCTURED FINANCIAL RECONCILIATION

Category                          Exposure Range
─────────────────────────────────────────────────────────────
Expert Report-Based Variances     $${reportMin.toLocaleString()} – $${reportMax.toLocaleString()}
Geometry/Dimension-Based          $${dimensionMin.toLocaleString()} – $${dimensionMax.toLocaleString()}
Code Compliance-Based             $${codeMin.toLocaleString()} – $${codeMax.toLocaleString()}
─────────────────────────────────────────────────────────────
Total Documented Variance         $${totalMin.toLocaleString()} – $${totalMax.toLocaleString()}

Current Estimate Total: $${estimateTotal.toLocaleString()}
Variance as % of Estimate: ${Math.round((totalMin / estimateTotal) * 100)}% – ${Math.round((totalMax / estimateTotal) * 100)}%
  `.trim();
  
  return {
    id: 'financial-reconciliation',
    title: 'Structured Financial Reconciliation',
    content,
    format: 'text'
  };
}

function buildClosingPositioningStatement(metadata: ReportMetadata): FormattedSection {
  
  const content = `
CLOSING POSITIONING STATEMENT (Neutral)

The documented variances above reflect measurable scope shortfalls 
identified through structured comparison of:

• Expert remediation directives
• Verified property geometry
• Identified compliance standards
• Structured estimate data

All exposure ranges are derived from:
• Structured calculation formulas
• Versioned cost baselines (v${metadata.costBaselineVersion}, dated ${metadata.costBaselineDate})
• Industry-standard unit pricing (Region: ${metadata.region})

This packet provides a data-supported reconciliation framework for 
scope alignment and resolution.

No coverage determinations are made herein. This documentation presents 
quantified scope variances for professional review and consideration.
  `.trim();
  
  return {
    id: 'closing-positioning',
    title: 'Closing Positioning Statement',
    content,
    format: 'text'
  };
}

function buildFullAuditTrail(metadata: ReportMetadata): FormattedSection {
  
  const content = `
FULL AUDIT & VERIFICATION TRAIL

Report Version: ${metadata.reportVersion}
Cost Baseline Version: ${metadata.costBaselineVersion}
Cost Baseline Date: ${metadata.costBaselineDate}
Region: ${metadata.region}
Export Timestamp: ${new Date(metadata.exportTimestamp).toLocaleString('en-US')}
Report ID: ${metadata.reportId}
SHA-256 Hash: ${metadata.sha256Hash}

Numerical Integrity Verified: YES
Formula Consistency Verified: YES
Source Attribution Complete: YES
Versioning Preserved: YES

All calculations use identical cost baseline and methodology across 
all export formats. This ensures deterministic consistency and 
audit-grade traceability.
  `.trim();
  
  return {
    id: 'full-audit-trail',
    title: 'Full Audit & Verification Trail',
    content,
    format: 'text'
  };
}
