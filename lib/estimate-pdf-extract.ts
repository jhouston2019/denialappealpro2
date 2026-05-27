const PDFJS_CDN_VERSION = "4.4.168";

/** Max pages sent to AI vision (cost/time); embedded text is read for every page. */
export const PDF_VISION_MAX_PAGES = 15;

/** Above this page count we never imply full-document vision OCR. */
export const PDF_LARGE_PAGE_THRESHOLD = 25;

async function loadPdfDocument(file: File) {
  const pdfjsLib = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_CDN_VERSION}/pdf.worker.min.mjs`;
  }
  const arrayBuffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

export type PdfTextExtractionResult = {
  pages: string[];
  totalPages: number;
};

/** One string per PDF page (index 0 = page 1). Reads every page's text layer. */
export async function extractTextPagesFromPDF(
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<PdfTextExtractionResult> {
  const pdf = await loadPdfDocument(file);
  const textPages: string[] = [];
  const total = pdf.numPages;
  for (let i = 1; i <= total; i++) {
    onProgress?.(i, total);
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      textPages.push(pageText);
    } catch {
      textPages.push("");
    }
    if (i % 25 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
  return { pages: textPages, totalPages: total };
}

/** First N page indices (0-based) to run AI vision on for large/scanned PDFs. */
export function defaultVisionPageIndices(
  totalPages: number,
  maxVision: number = PDF_VISION_MAX_PAGES
): number[] {
  const n = Math.min(totalPages, maxVision);
  return Array.from({ length: n }, (_, i) => i);
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const { pages } = await extractTextPagesFromPDF(file);
  return pages.join("\n\n");
}

const OCR_MAX_PIXEL_WIDTH = 1800;
const OCR_JPEG_QUALITY = 0.82;

/** Render specific 1-based page numbers as JPEG base64 for vision OCR. */
export async function extractPageImagesFromPDF(
  file: File,
  pageNumbers: number[]
): Promise<string[]> {
  if (pageNumbers.length === 0) return [];
  const pdf = await loadPdfDocument(file);
  const images: string[] = [];
  for (const pageNum of pageNumbers) {
    if (pageNum < 1 || pageNum > pdf.numPages) continue;
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, OCR_MAX_PIXEL_WIDTH / baseViewport.width);
    const viewport = page.getViewport({ scale: Math.max(0.75, scale) });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", OCR_JPEG_QUALITY);
    const base64 = dataUrl.split(",")[1];
    if (base64) images.push(base64);
  }
  return images;
}

/** @deprecated Use extractPageImagesFromPDF — renders first N pages only. */
export async function extractImagesFromPDF(
  file: File,
  maxPages: number = PDF_VISION_MAX_PAGES
): Promise<string[]> {
  const indices = Array.from({ length: maxPages }, (_, i) => i + 1);
  return extractPageImagesFromPDF(file, indices);
}

export function countNativePagesWithText(pages: string[], minChars = 40): number {
  return pages.filter((p) => p.trim().length >= minChars).length;
}

export function mergeNativeAndVisionPages(
  nativePages: string[],
  visionByPageIndex: Map<number, string>,
  pageHasSufficientNative: (pageText: string) => boolean
): string {
  const parts: string[] = [];
  for (let i = 0; i < nativePages.length; i++) {
    const native = (nativePages[i] ?? "").trim();
    const vision = visionByPageIndex.get(i)?.trim();
    if (vision && !pageHasSufficientNative(native)) {
      parts.push(vision);
    } else if (native) {
      parts.push(native);
    }
  }
  return parts.join("\n\n");
}
