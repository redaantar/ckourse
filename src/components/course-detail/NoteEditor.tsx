import { useState, useRef, useEffect, useCallback } from "react";
import {
  PaperPlaneTiltIcon as PaperPlaneTilt,
  XIcon as X,
  TextBolderIcon as TextBolder,
  TextItalicIcon as TextItalic,
  TextUnderlineIcon as TextUnderline,
  TextStrikethroughIcon as TextStrikethrough,
  ClockIcon as Clock,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { buildTimestampHtml, formatTimestamp, parseTimeString } from "@/lib/format";
import { SNAPPY, EASE_OUT } from "@/lib/constants";

// Matches @current or @m:ss / @h:mm:ss followed by a word boundary (space, end, punctuation)
const TIMESTAMP_COMMIT_RE = /@(current|\d{1,2}(?::\d{2}){1,2})(?=[\s,.\-!?;:]|$)/;

interface NoteEditorProps {
  videoTime: number;
  initialContent?: string;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  className?: string;
}

interface Suggestion {
  label: string;
  description: string;
  seconds: number;
}

export function NoteEditor({
  videoTime,
  initialContent = "",
  onSubmit,
  onCancel,
  className,
}: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const videoTimeRef = useRef(videoTime);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    query: string;
  } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const updateActiveFormats = useCallback(() => {
    const formats = new Set<string>();
    for (const cmd of ["bold", "italic", "underline", "strikeThrough"]) {
      if (document.queryCommandState(cmd)) formats.add(cmd);
    }
    setActiveFormats(formats);
  }, []);

  useEffect(() => {
    videoTimeRef.current = videoTime;
  }, [videoTime]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (initialContent) {
      el.innerHTML = initialContent;
    }
    el.focus();
    const sel = window.getSelection();
    if (sel && el.childNodes.length > 0) {
      sel.selectAllChildren(el);
      sel.collapseToEnd();
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      if (editorRef.current?.contains(document.activeElement) || editorRef.current === document.activeElement) {
        updateActiveFormats();
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, [updateActiveFormats]);

  const isEmpty = useCallback(() => {
    const el = editorRef.current;
    if (!el) return true;
    return !el.textContent?.trim();
  }, []);

  function execFormat(command: string) {
    document.execCommand(command, false);
    editorRef.current?.focus();
    updateActiveFormats();
  }

  // Get the @... query text behind cursor, if any
  function getAtQuery(): { text: string; node: Text; start: number; end: number } | null {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;

    const text = node.textContent ?? "";
    const cursor = range.startOffset;

    // Walk backwards from cursor to find @
    let atPos = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      if (text[i] === "@") {
        atPos = i;
        break;
      }
      // Stop if we hit a space before finding @
      if (text[i] === " " || text[i] === "\u00A0") break;
    }

    if (atPos === -1) return null;
    const query = text.slice(atPos + 1, cursor);
    return { text: query, node: node as Text, start: atPos, end: cursor };
  }

  // Build suggestions based on current query
  function getSuggestions(query: string): Suggestion[] {
    const time = videoTimeRef.current;
    const currentLabel = formatTimestamp(time);
    const suggestions: Suggestion[] = [];

    // Always offer "current" if query is prefix of "current" or empty
    if ("current".startsWith(query.toLowerCase()) || query === "") {
      suggestions.push({
        label: `@${currentLabel}`,
        description: "Current time",
        seconds: time,
      });
    }

    // If query looks like a partial time (digits and colons), offer it as typed
    if (query && /^\d{1,2}(:\d{0,2}){0,2}$/.test(query)) {
      const parsed = parseTimeString(query);
      if (parsed !== null && parsed !== time) {
        suggestions.push({
          label: `@${formatTimestamp(parsed)}`,
          description: "Go to time",
          seconds: parsed,
        });
      }
    }

    return suggestions;
  }

  function replaceAtQuery(seconds: number) {
    const atq = getAtQuery();
    if (!atq) return;

    const { node, start, end } = atq;
    const html = buildTimestampHtml(seconds);

    const replaceRange = document.createRange();
    replaceRange.setStart(node, start);
    replaceRange.setEnd(node, end);
    replaceRange.deleteContents();

    const temp = document.createElement("span");
    temp.innerHTML = html + "\u00A0";
    const frag = document.createDocumentFragment();
    let lastChild: Node | null = null;
    while (temp.firstChild) {
      lastChild = temp.firstChild;
      frag.appendChild(lastChild);
    }
    replaceRange.insertNode(frag);

    if (lastChild) {
      const sel = window.getSelection();
      const newRange = document.createRange();
      newRange.setStartAfter(lastChild);
      newRange.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(newRange);
    }

    setMenu(null);
  }

  // Try to commit a completed timestamp pattern (e.g. after space)
  function tryCommitTimestamp() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return false;
    const node = sel.getRangeAt(0).startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return false;

    const text = node.textContent ?? "";
    const match = TIMESTAMP_COMMIT_RE.exec(text);
    if (!match) return false;

    const raw = match[1];
    let seconds: number;
    if (raw === "current") {
      seconds = videoTimeRef.current;
    } else {
      const parsed = parseTimeString(raw);
      if (parsed === null) return false;
      seconds = parsed;
    }

    const html = buildTimestampHtml(seconds);
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    const replaceRange = document.createRange();
    replaceRange.setStart(node, matchStart);
    replaceRange.setEnd(node, matchEnd);
    replaceRange.deleteContents();

    const temp = document.createElement("span");
    temp.innerHTML = html + "\u00A0";
    const frag = document.createDocumentFragment();
    let lastChild: Node | null = null;
    while (temp.firstChild) {
      lastChild = temp.firstChild;
      frag.appendChild(lastChild);
    }
    replaceRange.insertNode(frag);

    if (lastChild) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastChild);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    setMenu(null);
    return true;
  }

  function updateMenu() {
    const atq = getAtQuery();
    if (!atq) {
      setMenu(null);
      return;
    }

    // Position the menu at the cursor
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const editorRect = editorRef.current?.getBoundingClientRect();
    if (!editorRect) return;

    setMenu({
      x: rect.left - editorRect.left,
      y: rect.bottom - editorRect.top + 4,
      query: atq.text,
    });
    setSelectedIndex(0);
  }

  function handleInput() {
    // First try to auto-commit completed patterns (after space/punctuation)
    if (tryCommitTimestamp()) return;
    updateMenu();
    updateActiveFormats();
  }

  function handleSubmit() {
    if (isEmpty()) return;
    const html = editorRef.current?.innerHTML ?? "";
    onSubmit(html);
    if (editorRef.current) editorRef.current.innerHTML = "";
    setMenu(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Menu navigation
    if (menu) {
      const suggestions = getSuggestions(menu.query);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (suggestions.length > 0) {
          e.preventDefault();
          replaceAtQuery(suggestions[selectedIndex]?.seconds ?? suggestions[0].seconds);
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(null);
        return;
      }
    }

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && onCancel && !menu) {
      onCancel();
    }
  }

  const suggestions = menu ? getSuggestions(menu.query) : [];

  const toolbarButtons = [
    { command: "bold", icon: TextBolder, label: "Bold" },
    { command: "italic", icon: TextItalic, label: "Italic" },
    { command: "underline", icon: TextUnderline, label: "Underline" },
    { command: "strikeThrough", icon: TextStrikethrough, label: "Strikethrough" },
  ];

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      <div className="flex items-center gap-0.5 border-b border-border/50 px-2 py-1.5">
        {toolbarButtons.map(({ command, icon: Icon, label }) => (
          <button
            key={command}
            onMouseDown={(e) => {
              e.preventDefault();
              execFormat(command);
            }}
            title={label}
            className={cn(
              "rounded p-1 transition-colors",
              activeFormats.has(command)
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
          </button>
        ))}

        <span className="ml-2 font-mono text-[10px] text-muted-foreground/40">
          Type <span className="text-muted-foreground/60">@</span> to tag time
        </span>
      </div>

      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder="Write a note..."
          className="note-editable min-h-18 w-full px-3 pt-2.5 pb-2 font-sans text-xs leading-relaxed text-foreground focus:outline-none"
        />

        {menu && suggestions.length > 0 && (
          <div
            ref={menuRef}
            className="absolute z-10 min-w-45 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
            style={{
              left: menu.x,
              top: menu.y,
              opacity: 1,
              transform: "translateY(0)",
              transition: `opacity 200ms ${EASE_OUT}, transform 200ms ${EASE_OUT}`,
            }}
          >
            {suggestions.map((s, i) => (
              <button
                key={s.seconds}
                onMouseDown={(e) => {
                  e.preventDefault();
                  replaceAtQuery(s.seconds);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  i === selectedIndex
                    ? "bg-secondary"
                    : "hover:bg-secondary/50"
                )}
              >
                <Clock className="size-3.5 shrink-0 text-primary" />
                <span className="font-mono text-[11px] font-semibold text-foreground">
                  {s.label}
                </span>
                <span className="ml-auto font-sans text-[10px] text-muted-foreground">
                  {s.description}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5 border-t border-border/50 px-3 py-1.5">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 font-sans text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          style={{ transitionTimingFunction: SNAPPY }}
        >
          <PaperPlaneTilt className="size-3.5" weight="fill" />
          Save
        </button>
      </div>
    </div>
  );
}
