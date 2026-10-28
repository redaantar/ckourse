// pdf.js is loaded lazily so the ~1 MB library only ships to the webview the
// first time someone opens a PDF. The legacy build targets older WebKit, which
// matters because Tauri uses the system WKWebView on macOS.
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export type { PDFDocumentProxy };

let pdfjsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function openPdfDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs();
  // pdf.js transfers the buffer to its worker, so hand it a copy-free view it can own.
  return pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
}
