const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const {
  corsHeaders,
  optionsResponse,
  verifyWizardAuth,
} = require("./_wizardAuth.js");
const {
  evaluateExportGate,
  exportBlockedPayload,
} = require("../../lib/appeal/netlify-entry.ts");

/**
 * Standard PDF 14 fonts use WinAnsi; pdf-lib throws if a code point is not encodable.
 * Replace common UTF-8 punctuation and symbols with ASCII so exports never 500.
 */
function sanitizeTextForWinAnsi(input) {
  if (input == null) return "";
  return String(input)
    .replace(/[\u2500-\u257F\u2550-\u256C]/g, (ch) => (ch === "\u2550" ? "=" : "-"))
    .replace(/[\u2010-\u2015\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2022\u2023\u25E6\u2043\u25AA]/g, "*")
    .replace(/\u00A0/g, " ");
}

function splitInlineLetterHeadingLine(line) {
  const m = /^(Basis for Supplement|Policy Obligations|Regulatory Duties|Demand|Reservation of Rights)(\. {1,2})/.exec(
    line
  );
  if (m) {
    return { heading: m[0], rest: line.slice(m[0].length) };
  }
  return null;
}

function wordWrapToLines(raw, widthFont, fontSize, maxWidth) {
  const out = [];
  const words = String(raw).split(" ");
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (widthFont.widthOfTextAtSize(test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out;
}

function sanitizeFileName(name) {
  if (typeof name !== "string" || !name.trim()) return "export.pdf";
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "_").trim();
  if (!safe.toLowerCase().endsWith(".pdf")) {
    return `${(safe || "export").slice(0, 180)}.pdf`;
  }
  return safe.slice(0, 200) || "export.pdf";
}

function jsonError(statusCode, error, details, code) {
  const body = { error };
  if (details) body.details = details;
  if (code) body.code = code;
  return {
    statusCode,
    headers: { ...corsHeaders },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return optionsResponse();

  if (event.httpMethod !== "POST") {
    return jsonError(405, "Method not allowed", null, "METHOD");
  }

  console.log("[generate-pdf] request", {
    hasBody: Boolean(event.body),
    bodyLength: event.body != null ? String(event.body).length : 0,
  });
  // In-process text layout via pdf-lib only — no headless browser / PUPPETEER_* required on Netlify.
  console.log("[generate-pdf] runtime", {
    NODE_ENV: process.env.NODE_ENV,
    NETLIFY: process.env.NETLIFY,
    NETLIFY_CONTEXT: process.env.NETLIFY_CONTEXT,
  });

  const auth = await verifyWizardAuth(event);
  if (!auth.ok) return auth.response;

  let body;
  try {
    if (event.body == null || String(event.body).trim() === "") {
      body = {};
    } else {
      body = JSON.parse(event.body);
    }
  } catch (e) {
    return jsonError(
      400,
      "Invalid JSON in request body",
      e && e.message ? e.message : String(e),
      "INVALID_JSON"
    );
  }

  console.log("[generate-pdf] parsed", {
    keys: body && typeof body === "object" ? Object.keys(body) : [],
    textType: body && typeof body.text,
    fileNameType: body && typeof body.fileName,
    certifiedMailHeader: Boolean(body && body.certifiedMailHeader),
  });

  const { text: rawText, fileName: rawName, certifiedMailHeader, ledger } =
    body || {};

  if (rawText != null && typeof rawText !== "string") {
    return jsonError(
      400,
      'Field "text" must be a string (or omitted for empty body)',
      null,
      "TEXT_TYPE"
    );
  }

  const text = rawText == null ? "" : rawText;

  // Export gate — all seven grounding rules (shared with DOCX).
  const gateErrors = evaluateExportGate(text, ledger);
  if (gateErrors.length) {
    const payload = exportBlockedPayload(gateErrors);
    return {
      statusCode: 422,
      headers: { ...corsHeaders },
      body: JSON.stringify(payload),
    };
  }

  const fileName = sanitizeFileName(
    typeof rawName === "string" ? rawName : undefined
  );

  const headerBlock = certifiedMailHeader
    ? "SENT VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED\n\n"
    : "";
  const fullText = headerBlock + text;

  const fullTextSafe = sanitizeTextForWinAnsi(String(fullText));
  if (!String(fullTextSafe).trim()) {
    return jsonError(
      400,
      "No text provided for PDF export (empty or missing after parsing)",
      "Send a non-empty string in the JSON field \"text\".",
      "EMPTY_TEXT"
    );
  }

  try {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const fontSize = 12;
    const lineHeight = fontSize * 1.6;
    const margin = 72;

    const addPage = () => {
      const p = pdfDoc.addPage([612, 792]);
      return { page: p, y: p.getHeight() - margin };
    };

    let { page, y } = addPage();
    const maxWidth = 612 - margin * 2;

    const rawLines = String(fullTextSafe).split("\n");
    const wrappedLineRuns = [];

    for (const raw of rawLines) {
      if (raw.trim() === "") {
        wrappedLineRuns.push([{ t: "", f: font }]);
        continue;
      }
      const splitH = splitInlineLetterHeadingLine(raw);
      if (splitH) {
        for (const line of wordWrapToLines(
          splitH.heading,
          font,
          fontSize,
          maxWidth
        )) {
          wrappedLineRuns.push([{ t: line, f: boldFont }]);
        }
        if ((splitH.rest || "").trim().length > 0) {
          for (const seg of wordWrapToLines(
            splitH.rest,
            font,
            fontSize,
            maxWidth
          )) {
            wrappedLineRuns.push([{ t: seg, f: font }]);
          }
        }
        continue;
      }
      for (const seg of wordWrapToLines(raw, font, fontSize, maxWidth)) {
        const lineFont = splitInlineLetterHeadingLine(seg) ? boldFont : font;
        wrappedLineRuns.push([{ t: seg, f: lineFont }]);
      }
    }

    for (const runs of wrappedLineRuns) {
      if (y < margin + lineHeight) {
        const next = addPage();
        page = next.page;
        y = next.y;
      }
      if (!runs[0] || !String(runs[0].t).trim()) {
        y -= lineHeight;
        continue;
      }
      let x = margin;
      for (const run of runs) {
        if (!run.t) continue;
        page.drawText(run.t, {
          x,
          y,
          size: fontSize,
          font: run.f,
          color: rgb(0, 0, 0),
        });
        x += run.f.widthOfTextAtSize(run.t, fontSize);
      }
      y -= lineHeight;
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const pageNumSize = 10;
    for (let i = 0; i < totalPages; i++) {
      const label = `${i + 1} of ${totalPages}`;
      const w = font.widthOfTextAtSize(label, pageNumSize);
      pages[i].drawText(label, {
        x: 306 - w / 2,
        y: 36,
        size: pageNumSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    const pdfBytes = await pdfDoc.save();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Access-Control-Allow-Origin": "*",
      },
      body: Buffer.from(pdfBytes).toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("generate-pdf error:", err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders },
      body: JSON.stringify({
        error: "Failed to generate PDF",
        details: err && err.message ? err.message : String(err),
        code: "PDF_BUILD",
      }),
    };
  }
};
