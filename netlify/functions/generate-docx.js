/**
 * generate-docx.js
 * POST { sections, fileName } → structured .docx download
 * Legacy: POST { text, fileName } → plain-text fallback (backward compat)
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, BorderStyle, ShadingType, HeadingLevel,
  LevelFormat, PageNumber, Header, Footer, TabStopType, TabStopPosition,
} = require("docx");
const {
  corsHeaders,
  optionsResponse,
  verifyWizardAuth,
} = require("./_wizardAuth.js");

// ─── Design tokens ───────────────────────────────────────────────
const COLOR_NAVY    = "1B3A5C";
const COLOR_AMBER   = "B45309";
const COLOR_RED     = "B91C1C";
const COLOR_DARK    = "1A1A1A";
const COLOR_MUTED   = "6B7280";
const COLOR_BG_AMBER = "FFF8EF";
const COLOR_BG_RED   = "FEF2F2";
const COLOR_BG_NAVY  = "F0F4F8";
const COLOR_BORDER  = "E5E7EB";
const COLOR_WHITE   = "FFFFFF";

const FONT = "Calibri";
const PAGE_W = 12240; // 8.5in
const PAGE_H = 15840; // 11in
const MARGIN = 1080;  // 0.75in
const CONTENT_W = PAGE_W - MARGIN * 2; // 10080

// ─── Helpers ─────────────────────────────────────────────────────

function spacer(pts = 6) {
  return new Paragraph({ children: [], spacing: { after: pts * 20 } });
}

function divider() {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER, space: 1 } },
    spacing: { after: 80 },
  });
}

function sectionHeading(text, color = COLOR_NAVY) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color, font: FONT, size: 22 })],
    spacing: { before: 240, after: 80 },
  });
}

function bodyPara(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({
      text,
      font: FONT,
      size: opts.size || 20,
      color: opts.color || COLOR_DARK,
      bold: opts.bold || false,
      italics: opts.italics || false,
    })],
    spacing: { after: opts.after ?? 80 },
    alignment: opts.align || AlignmentType.LEFT,
  });
}

function bulletPara(text, color = COLOR_DARK) {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 20, color })],
    bullet: { level: 0 },
    spacing: { after: 60 },
  });
}

function kv(label, value, labelColor = COLOR_MUTED) {
  return new Paragraph({
    children: [
      new TextRun({ text: label + ": ", bold: true, font: FONT, size: 20, color: labelColor }),
      new TextRun({ text: String(value ?? "—"), font: FONT, size: 20, color: COLOR_DARK }),
    ],
    spacing: { after: 80 },
  });
}

function twoColRow(leftLabel, leftVal, rightLabel, rightVal) {
  const cell = (label, val, bg) => new TableCell({
    borders: { top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() },
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    width: { size: CONTENT_W / 2, type: WidthType.DXA },
    children: [
      new Paragraph({ children: [
        new TextRun({ text: label + ": ", bold: true, font: FONT, size: 20, color: COLOR_MUTED }),
        new TextRun({ text: String(val ?? "—"), font: FONT, size: 20, color: COLOR_DARK }),
      ], spacing: { after: 0 } }),
    ],
  });
  return new TableRow({ children: [
    cell(leftLabel, leftVal, COLOR_WHITE),
    cell(rightLabel, rightVal, COLOR_WHITE),
  ]});
}

function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
}

function thinBorder() {
  return { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER };
}

function highlightCard(paragraphs, bg = COLOR_BG_NAVY, borderColor = COLOR_NAVY) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
      bottom: noBorder(), left: noBorder(), right: noBorder(),
      insideH: noBorder(), insideV: noBorder(),
    },
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      width: { size: CONTENT_W, type: WidthType.DXA },
      children: paragraphs,
    })] })],
  });
}

function comparisonTable(lineItems) {
  const hdBorder = { style: BorderStyle.SINGLE, size: 2, color: COLOR_NAVY };
  const hdCell = (text, w) => new TableCell({
    borders: { top: hdBorder, bottom: hdBorder, left: noBorder(), right: noBorder() },
    shading: { fill: COLOR_BG_NAVY, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({ children: [
      new TextRun({ text, bold: true, font: FONT, size: 18, color: COLOR_NAVY })
    ], spacing: { after: 0 } })],
  });

  const COL = [1200, 2400, 1400, 1400, 1000, 2680]; // trade, item, carrier$, other$, delta, reason
  const header = new TableRow({ children: [
    hdCell("Trade", COL[0]),
    hdCell("Carrier Item", COL[1]),
    hdCell("Carrier $", COL[2]),
    hdCell("Contractor $", COL[3]),
    hdCell("Delta", COL[4]),
    hdCell("Note", COL[5]),
  ]});

  const rows = lineItems.map((row, i) => {
    const bg = row.flagged ? "FFF1F0" : (i % 2 === 0 ? COLOR_WHITE : "F9FAFB");
    const deltaColor = row.delta > 0 ? "059669" : row.delta < 0 ? "DC2626" : COLOR_DARK;
    const dataCell = (text, w, color = COLOR_DARK, bold = false) => new TableCell({
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
        left: noBorder(), right: noBorder(),
      },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      width: { size: w, type: WidthType.DXA },
      children: [new Paragraph({ children: [
        new TextRun({ text: String(text ?? ""), font: FONT, size: 18, color, bold })
      ], spacing: { after: 0 } })],
    });

    const reasonChildren = [
      new TextRun({ text: String(row.reason ?? ""), font: FONT, size: 16, color: COLOR_MUTED }),
    ];
    if (row.depreciationNote) {
      reasonChildren.push(new TextRun({ text: " | Dep: " + row.depreciationNote, font: FONT, size: 16, color: COLOR_AMBER, italics: true }));
    }
    const noteCell = new TableCell({
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER },
        left: noBorder(), right: noBorder(),
      },
      shading: { fill: bg, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      width: { size: COL[5], type: WidthType.DXA },
      children: [new Paragraph({ children: reasonChildren, spacing: { after: 0 } })],
    });

    return new TableRow({ children: [
      dataCell(row.trade, COL[0], COLOR_MUTED),
      dataCell(row.carrierItem, COL[1]),
      dataCell(formatMoney(row.carrierAmount), COL[2]),
      dataCell(formatMoney(row.contractorAmount), COL[3]),
      dataCell(formatMoney(row.delta), COL[4], deltaColor, true),
      noteCell,
    ]});
  });

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: COL,
    rows: [header, ...rows],
  });
}

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return (num < 0 ? "-$" : "$") + Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLabel(key) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
}

// ─── Section builders ─────────────────────────────────────────────

function buildAnalysisSection(analysis) {
  const paras = [];

  paras.push(sectionHeading("Analysis", COLOR_NAVY));
  paras.push(divider());

  // Executive Summary card
  if (analysis.executiveSummary) {
    paras.push(highlightCard([
      new Paragraph({ children: [new TextRun({ text: "Summary", bold: true, font: FONT, size: 20, color: COLOR_NAVY })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: analysis.executiveSummary, font: FONT, size: 20, color: COLOR_DARK })], spacing: { after: 0 } }),
    ], COLOR_BG_NAVY, COLOR_NAVY));
    paras.push(spacer(8));
  }

  // Carrier Approach card
  if (analysis.carrierStrategy) {
    paras.push(highlightCard([
      new Paragraph({ children: [new TextRun({ text: "Carrier Approach", bold: true, font: FONT, size: 20, color: COLOR_AMBER })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: analysis.carrierStrategy, font: FONT, size: 20, color: COLOR_DARK })], spacing: { after: 0 } }),
    ], COLOR_BG_AMBER, COLOR_AMBER));
    paras.push(spacer(8));
  }

  // Key metrics row
  paras.push(kv("Risk Level", (analysis.riskLevel || "—").toUpperCase()));
  paras.push(kv("Carrier Amount", formatMoney(analysis.carrierAmount)));
  if (analysis.trueLossRange) {
    paras.push(kv("True Loss Range", `${formatMoney(analysis.trueLossRange.low)} – ${formatMoney(analysis.trueLossRange.high)}`));
    const mid = ((analysis.trueLossRange.low + analysis.trueLossRange.high) / 2);
    const gap = mid - (analysis.carrierAmount || 0);
    paras.push(kv("Estimated Gap (midpoint vs carrier)", formatMoney(gap)));
  }
  paras.push(kv("Recommended Strategy", analysis.recommendedStrategy || "—"));
  paras.push(spacer(4));

  // Finding sections
  const sections = [
    { label: "Scope Omissions", field: "scopeOmissions", color: COLOR_DARK },
    { label: "Pricing Suppression Flags", field: "pricingFlags", color: COLOR_DARK },
    { label: "Depreciation Issues", field: "depreciationFindings", color: COLOR_RED },
    { label: "Code Upgrade Gaps", field: "codeUpgradeGaps", color: COLOR_DARK },
    { label: "O&P Findings", field: "opFindings", color: COLOR_DARK },
    { label: "Procedural Defects", field: "proceduralDefects", color: COLOR_DARK },
    { label: "Dispute Angles", field: "disputeAngles", color: COLOR_DARK },
    { label: "Bad Faith Indicators", field: "badFaithIndicators", color: COLOR_RED },
    { label: "Action Items", field: "actionItems", color: COLOR_DARK },
    { label: "Required Documents", field: "requiredDocuments", color: COLOR_DARK },
    { label: "Escalation Options", field: "escalationOptions", color: COLOR_DARK },
  ];

  for (const { label, field, color } of sections) {
    const items = analysis[field];
    if (!Array.isArray(items) || items.length === 0) continue;
    paras.push(sectionHeading(label, color === COLOR_RED ? COLOR_RED : COLOR_NAVY));
    for (const item of items) {
      paras.push(bulletPara(String(item), color));
    }
    paras.push(spacer(4));
  }

  return paras;
}

function buildComparisonSection(comparison) {
  const paras = [];
  paras.push(sectionHeading("Comparison", COLOR_NAVY));
  paras.push(divider());

  paras.push(kv("Mode", comparison.mode || "—"));
  paras.push(kv("Total Carrier", formatMoney(comparison.totalCarrier)));
  paras.push(kv("Total Contractor / Recon", formatMoney(comparison.totalContractor)));
  paras.push(kv("Total Delta", formatMoney(comparison.totalDelta)));
  paras.push(spacer(8));

  if (Array.isArray(comparison.lineItems) && comparison.lineItems.length > 0) {
    paras.push(comparisonTable(comparison.lineItems));
  }

  paras.push(spacer(8));
  return paras;
}

function buildLetterSection(letterText, title = "Demand Letter") {
  const paras = [];
  paras.push(sectionHeading(title, COLOR_NAVY));
  paras.push(divider());

  const LETTER_HEADINGS = [
    "Basis for Supplement", "Basis for Dispute", "Basis for Appeal",
    "Basis for Request", "Policy Obligations", "Regulatory Duties",
    "Demand", "Reservation of Rights",
  ];

  for (const line of String(letterText).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) { paras.push(spacer(4)); continue; }

    const match = LETTER_HEADINGS.find(h => trimmed.startsWith(h + "."));
    if (match) {
      const rest = trimmed.slice(match.length + 1).trim();
      paras.push(new Paragraph({
        children: [
          new TextRun({ text: match + ".  ", bold: true, font: FONT, size: 20, color: COLOR_NAVY }),
          new TextRun({ text: rest, font: FONT, size: 20, color: COLOR_DARK }),
        ],
        spacing: { after: 120 },
      }));
    } else {
      paras.push(bodyPara(trimmed, { after: 100 }));
    }
  }

  paras.push(spacer(8));
  return paras;
}

function buildCoverSection(claimMeta) {
  const paras = [];

  paras.push(new Paragraph({
    children: [new TextRun({ text: "Denial Appeal Pro", bold: true, font: FONT, size: 36, color: COLOR_NAVY })],
    spacing: { after: 60 },
  }));
  paras.push(new Paragraph({
    children: [new TextRun({ text: "Insurance Estimate Analysis Report", font: FONT, size: 24, color: COLOR_MUTED })],
    spacing: { after: 240 },
  }));
  paras.push(divider());
  paras.push(spacer(8));

  if (claimMeta) {
    const fields = [
      ["Insured", claimMeta.insuredName],
      ["Policy Number", claimMeta.policyNumber],
      ["Claim Number", claimMeta.claimNumber],
      ["Date of Loss", claimMeta.dateOfLoss],
      ["Adjuster", claimMeta.adjusterName],
      ["Carrier", claimMeta.carrierName || claimMeta.carrier],
      ["State", claimMeta.state],
      ["Claim Type", claimMeta.claimType],
    ];
    for (const [label, val] of fields) {
      if (val) paras.push(kv(label, val));
    }
  }

  paras.push(spacer(12));
  return paras;
}

// ─── Main handler ─────────────────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const auth = await verifyWizardAuth(event);
  if (!auth.ok) return auth.response;

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const fileName = String(body.fileName || "estimate-review.docx");

  // ── Structured path (new) ──────────────────────────────────────
  // body.sections = { claimMeta?, analysis?, comparison?, letter?, letterTitle? }
  if (body.sections) {
    const { claimMeta, analysis, comparison, letter, letterTitle } = body.sections;
    const children = [];

    if (claimMeta || analysis) children.push(...buildCoverSection(claimMeta));
    if (analysis)    children.push(...buildAnalysisSection(analysis));
    if (comparison)  children.push(...buildComparisonSection(comparison));
    if (letter)      children.push(...buildLetterSection(letter, letterTitle));

    const doc = new Document({
      styles: {
        default: { document: { run: { font: FONT, size: 20 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  }

  // ── Legacy plain-text path (backward compat) ──────────────────
  const text = String(body.text || "");
  const lines = text.split("\n");
  const LETTER_HEADINGS = [
    "Basis for Supplement", "Basis for Dispute", "Basis for Appeal",
    "Basis for Request", "Policy Obligations", "Regulatory Duties",
    "Demand", "Reservation of Rights",
  ];

  const children = [];

  if (body.certifiedMailHeader) {
    children.push(new Paragraph({
      children: [new TextRun({ text: "SENT VIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED", bold: true, font: FONT, size: 20, color: COLOR_DARK })],
      spacing: { after: 240 },
    }));
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { children.push(new Paragraph({ children: [], spacing: { after: 120 } })); continue; }
    const match = LETTER_HEADINGS.find(h => trimmed.startsWith(h + "."));
    if (match) {
      const rest = trimmed.slice(match.length + 1).trim();
      children.push(new Paragraph({
        children: [
          new TextRun({ text: match + ".  ", bold: true, font: FONT, size: 20, color: COLOR_NAVY }),
          new TextRun({ text: rest, font: FONT, size: 20, color: COLOR_DARK }),
        ],
        spacing: { after: 120 },
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, font: FONT, size: 20, color: COLOR_DARK })],
        spacing: { after: 120 },
      }));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
    body: buffer.toString("base64"),
    isBase64Encoded: true,
  };
};
