import { formatTimestamp } from "@/lib/format";

const FORMATTING = new Set(["B", "I", "U", "S", "STRONG", "EM"]);

function isBlankFormatting(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && FORMATTING.has(node.nodeName) && !node.textContent?.trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Prepare stored note HTML for reading outside the editor:
 * - drops formatting left dangling at the end (an underlined trailing space renders as a stray "_")
 * - makes timestamp pills keyboard-reachable buttons
 * - wraps search matches in <mark>
 */
export function renderNoteHtml(html: string, highlight = ""): string {
  const root = document.createElement("div");
  root.innerHTML = html;

  while (root.lastChild && (isBlankFormatting(root.lastChild) || (root.lastChild.nodeType === Node.TEXT_NODE && !root.lastChild.textContent?.trim()))) {
    root.lastChild.remove();
  }

  for (const pill of root.querySelectorAll<HTMLElement>(".note-timestamp")) {
    pill.removeAttribute("contenteditable");
    pill.setAttribute("role", "button");
    pill.setAttribute("tabindex", "0");
    pill.setAttribute("aria-label", `Play from ${pill.textContent}`);
    pill.title = "Play from here";
  }

  const q = highlight.trim();
  if (q) {
    const re = new RegExp(escapeRegExp(q), "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const texts: Text[] = [];
    while (walker.nextNode()) {
      const t = walker.currentNode as Text;
      if (!t.parentElement?.closest(".note-timestamp")) texts.push(t);
    }
    for (const t of texts) {
      const value = t.data;
      if (!re.test(value)) continue;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of value.matchAll(re)) {
        frag.append(value.slice(last, m.index));
        const mark = document.createElement("mark");
        mark.textContent = m[0];
        frag.append(mark);
        last = m.index + m[0].length;
      }
      frag.append(value.slice(last));
      t.replaceWith(frag);
    }
  }

  return root.innerHTML;
}

/** The first moment a note points at, if it has one. */
export function firstTimestamp(html: string): { seconds: number; label: string } | null {
  const match = html.match(/data-timestamp="(\d+(?:\.\d+)?)"/);
  if (!match) return null;
  const seconds = Math.floor(Number(match[1]));
  return { seconds, label: formatTimestamp(seconds) };
}

export function noteText(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent ?? "";
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "3 weeks ago", "yesterday" — for when a note was written, not a precise clock. */
export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** Course page link that opens the lesson, optionally at a moment in the video. */
export function lessonLink(courseId: number, lessonId: number, seconds?: number): string {
  const t = seconds != null ? `&t=${seconds}` : "";
  return `/course/${courseId}?lesson=${lessonId}${t}&from=/notes`;
}
