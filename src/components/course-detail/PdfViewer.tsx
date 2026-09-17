import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLottie } from "lottie-react";
import {
  ArrowSquareOutIcon as ArrowSquareOut,
  ArrowsOutLineHorizontalIcon as ArrowsOutLineHorizontal,
  FilePdfIcon as FilePdf,
  MagnifyingGlassMinusIcon as MagnifyingGlassMinus,
  MagnifyingGlassPlusIcon as MagnifyingGlassPlus,
  WarningCircleIcon as WarningCircle,
  XIcon as X,
} from "@phosphor-icons/react";
import loadingAnimation from "@/assets/lotties/loading.json";
import { cn } from "@/lib/utils";
import { reportError } from "@/lib/posthog";
import { openPdfDocument, type PDFDocumentProxy } from "@/lib/pdf";
import { readResource } from "@/lib/store";
import type { Resource } from "@/types";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.2;
/** Horizontal breathing room around pages when fitting to width. */
const FIT_PADDING = 48;
/** Start rendering pages this far before they scroll into view. */
const PRERENDER_MARGIN = "800px 0px";

type ZoomMode = { kind: "fit" } | { kind: "manual"; scale: number };

interface PageSize {
  width: number;
  height: number;
}

interface PdfViewerProps {
  resource: Resource;
  onClose: () => void;
  /** Opens the file in the system viewer. Omitted for remote resources. */
  onOpenExternally?: () => void;
  className?: string;
}

export function PdfViewer({ resource, onClose, onOpenExternally, className }: PdfViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [baseSize, setBaseSize] = useState<PageSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomMode>({ kind: "fit" });
  const [containerWidth, setContainerWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  const { View: loadingAnimationView } = useLottie({
    animationData: loadingAnimation,
    loop: true,
    className: "size-28",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const currentPageRef = useRef(1);
  /** Scroll position as a fraction of the document height, kept across zoom changes. */
  const scrollRatioRef = useRef(0);

  // Load the document.
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;

    setDoc(null);
    setBaseSize(null);
    setError(null);
    setCurrentPage(1);
    setPageInput("1");
    currentPageRef.current = 1;
    scrollRatioRef.current = 0;

    (async () => {
      try {
        const bytes = await readResource(resource.id);
        const pdf = await openPdfDocument(bytes);
        if (cancelled) {
          void pdf.destroy();
          return;
        }
        loaded = pdf;
        const first = await pdf.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setBaseSize({ width: vp.width, height: vp.height });
        setDoc(pdf);
      } catch (err) {
        if (cancelled) return;
        reportError(err, "PdfViewer.load", { resourceId: resource.id });
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
    };
  }, [resource.id]);

  // Track the available width for fit-to-width.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Focus the page area so arrow keys / space scroll the document right away.
  useEffect(() => {
    if (doc) scrollRef.current?.focus({ preventScroll: true });
  }, [doc]);

  const fitScale =
    baseSize && containerWidth > 0
      ? clamp((containerWidth - FIT_PADDING) / baseSize.width)
      : 1;
  const scale = zoom.kind === "fit" ? fitScale : zoom.scale;

  // Keep the reader at the same spot in the document when the zoom changes.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollRatioRef.current * el.scrollHeight;
  }, [scale]);

  const zoomBy = useCallback(
    (factor: number) => setZoom({ kind: "manual", scale: clamp(scale * factor) }),
    [scale],
  );

  const goToPage = useCallback(
    (page: number) => {
      if (!doc) return;
      const target = Math.min(Math.max(1, Math.round(page)), doc.numPages);
      pageRefs.current.get(target)?.scrollIntoView({ block: "start" });
      currentPageRef.current = target;
      setCurrentPage(target);
      setPageInput(String(target));
    },
    [doc],
  );

  // Current page = the last page whose top has scrolled past the upper third.
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !doc) return;
    scrollRatioRef.current = container.scrollHeight > 0 ? container.scrollTop / container.scrollHeight : 0;
    const probe = container.getBoundingClientRect().top + container.clientHeight / 3;
    let page = 1;
    for (let i = 1; i <= doc.numPages; i++) {
      const el = pageRefs.current.get(i);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= probe) page = i;
      else break;
    }
    if (page !== currentPageRef.current) {
      currentPageRef.current = page;
      setCurrentPage(page);
      setPageInput(String(page));
    }
  }, [doc]);

  // Keyboard: Esc closes, Cmd/Ctrl +/-/0 zoom. Listens in the capture phase and
  // stops propagation so the video player's shortcuts (space, arrows, f...) don't
  // fire underneath the viewer; default actions like scrolling still happen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomBy(ZOOM_STEP);
      } else if (e.key === "-") {
        e.preventDefault();
        zoomBy(1 / ZOOM_STEP);
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom({ kind: "fit" });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, zoomBy]);

  const registerPage = useCallback((pageNumber: number, el: HTMLDivElement | null) => {
    if (el) pageRefs.current.set(pageNumber, el);
    else pageRefs.current.delete(pageNumber);
  }, []);

  const numPages = doc?.numPages ?? 0;

  return (
    <div
      className={cn("fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm", className)}
      role="dialog"
      aria-modal="true"
      aria-label={resource.title}
    >
      {/* Drag strip — keeps the window draggable and clears the traffic lights zone */}
      <div data-tauri-drag-region className="h-7 w-full shrink-0" />

      <div className="flex items-center justify-between gap-4 border-b border-border px-6 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FilePdf className="size-4 shrink-0 text-muted-foreground" />
          <h3 className="truncate font-heading text-sm font-bold text-foreground">
            {resource.title}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {doc && (
            <>
              <form
                className="mr-2 flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(pageInput);
                  if (Number.isFinite(n)) goToPage(n);
                  else setPageInput(String(currentPage));
                }}
              >
                <input
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => setPageInput(String(currentPage))}
                  inputMode="numeric"
                  aria-label="Page number"
                  className="w-10 rounded-md border border-border bg-card px-1.5 py-0.5 text-center font-mono text-xs text-foreground outline-none focus:border-primary"
                />
                <span className="font-mono text-xs text-muted-foreground">/ {numPages}</span>
              </form>

              <ToolbarButton label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={scale <= MIN_SCALE}>
                <MagnifyingGlassMinus className="size-4" />
              </ToolbarButton>
              <span className="w-11 text-center font-mono text-xs text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
              <ToolbarButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} disabled={scale >= MAX_SCALE}>
                <MagnifyingGlassPlus className="size-4" />
              </ToolbarButton>
              <ToolbarButton
                label="Fit to width"
                onClick={() => setZoom({ kind: "fit" })}
                active={zoom.kind === "fit"}
              >
                <ArrowsOutLineHorizontal className="size-4" />
              </ToolbarButton>
            </>
          )}

          {onOpenExternally && (
            <ToolbarButton label="Open in default app" onClick={onOpenExternally}>
              <ArrowSquareOut className="size-4" />
            </ToolbarButton>
          )}
          <ToolbarButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </ToolbarButton>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={-1}
        className="min-h-0 flex-1 overflow-auto outline-none"
      >
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <WarningCircle className="size-6 text-destructive" />
            <p className="font-sans text-sm font-semibold text-foreground">Couldn't open this PDF</p>
            <p className="max-w-md font-sans text-xs text-muted-foreground">{error}</p>
            {onOpenExternally && (
              <button
                onClick={onOpenExternally}
                className="mt-2 rounded-md px-3 py-1.5 font-sans text-xs font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Open in default app
              </button>
            )}
          </div>
        ) : !doc || !baseSize ? (
          <div className="flex h-full flex-col items-center justify-center">
            {loadingAnimationView}
            <p className="mt-2 font-sans text-sm font-semibold text-foreground">Loading PDF...</p>
          </div>
        ) : (
          <div className="flex w-max min-w-full flex-col items-center gap-4 px-6 py-6">
            {Array.from({ length: numPages }, (_, i) => (
              <PdfPage
                key={i + 1}
                doc={doc}
                pageNumber={i + 1}
                scale={scale}
                estimatedSize={baseSize}
                root={scrollRef.current}
                register={registerPage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  /** Size of page 1 at scale 1 — used until this page's real size is known. */
  estimatedSize: PageSize;
  root: HTMLElement | null;
  register: (pageNumber: number, el: HTMLDivElement | null) => void;
}

function PdfPage({ doc, pageNumber, scale, estimatedSize, root, register }: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState<PageSize | null>(null);
  const [rendered, setRendered] = useState(false);

  const setWrapper = useCallback(
    (el: HTMLDivElement | null) => {
      wrapperRef.current = el;
      register(pageNumber, el);
    },
    [pageNumber, register],
  );

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root, rootMargin: PRERENDER_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  // Render (or re-render on zoom) while the page is near the viewport. Pages that
  // scroll far away keep their last bitmap; that's cheap enough for course PDFs
  // and avoids flashing blank pages when scrolling back.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;

    (async () => {
      try {
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        setSize({ width: viewport.width / scale, height: viewport.height / scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        task = page.render({
          canvas,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await task.promise;
        if (!cancelled) setRendered(true);
      } catch (err) {
        // A superseded render rejects with RenderingCancelledException — expected.
        if (cancelled || (err instanceof Error && err.name === "RenderingCancelledException")) return;
        reportError(err, "PdfViewer.renderPage", { pageNumber });
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, scale, visible]);

  const base = size ?? estimatedSize;
  const width = Math.floor(base.width * scale);
  const height = Math.floor(base.height * scale);

  return (
    <div
      ref={setWrapper}
      data-page={pageNumber}
      className="relative shrink-0 overflow-hidden rounded-sm bg-white shadow-lg"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="block" />
      {!rendered && (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-neutral-400">
          {pageNumber}
        </span>
      )}
    </div>
  );
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

function ToolbarButton({ label, onClick, disabled, active, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function clamp(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}
