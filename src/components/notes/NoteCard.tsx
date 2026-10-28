import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PencilSimpleIcon as PencilSimple, TrashIcon as Trash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MomentFrame } from "@/components/notes/MomentFrame";
import { firstTimestamp, lessonLink, renderNoteHtml } from "@/lib/notes";
import type { NoteWithCourse } from "@/types";

interface NoteCardProps {
  note: NoteWithCourse;
  /** Off when the group heading already names the course */
  showCourse: boolean;
  /** Formatted time the note was last touched */
  time: string;
  highlight?: string;
  onStartEdit: () => void;
  onDelete: () => void;
  className?: string;
}

/** Click (or Enter on) an inline timestamp pill to land in the video at that moment. */
export function useTimestampJump(courseId: number, lessonId: number) {
  const navigate = useNavigate();
  const jump = (target: EventTarget) => {
    const pill = (target as HTMLElement).closest<HTMLElement>(".note-timestamp");
    if (!pill) return false;
    navigate(lessonLink(courseId, lessonId, Math.floor(Number(pill.dataset.timestamp))));
    return true;
  };
  return {
    onClick: (e: MouseEvent) => {
      if (jump(e.target)) e.preventDefault();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && jump(e.target)) e.preventDefault();
    },
  };
}

export function NoteCard({ note, showCourse, time, highlight = "", onStartEdit, onDelete, className }: NoteCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [hovered, setHovered] = useState(false);
  const html = useMemo(() => renderNoteHtml(note.content, highlight), [note.content, highlight]);
  const moment = useMemo(() => firstTimestamp(note.content), [note.content]);
  const timestampHandlers = useTimestampJump(note.courseId, note.lessonId);

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow duration-200 hover:shadow-pop",
        className,
      )}
    >
      <Link
        to={lessonLink(note.courseId, note.lessonId, moment?.seconds)}
        aria-label={moment ? `Watch ${note.lessonTitle} from ${moment.label}` : `Open ${note.lessonTitle}`}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="m-1.5 mb-0 block overflow-hidden rounded-[11px]"
      >
        <MomentFrame
          courseTitle={note.courseTitle}
          accentColor={note.accentColor}
          videoPath={note.videoPath}
          seconds={moment?.seconds}
          hovered={hovered}
        />
      </Link>

      <div className="flex flex-1 flex-col px-4 pt-3 pb-3">
        <Link
          to={lessonLink(note.courseId, note.lessonId)}
          className="min-w-0 underline-offset-4 hover:underline"
          title={`${note.courseTitle} › ${note.lessonTitle}`}
        >
          <p className="truncate font-sans text-[13px] font-medium text-foreground">{note.lessonTitle}</p>
          {showCourse && <p className="truncate font-sans text-xs text-muted-foreground">{note.courseTitle}</p>}
        </Link>

        <div
          className="note-content mt-2 line-clamp-[8] flex-1 font-sans text-[15px] leading-relaxed text-foreground select-text"
          dangerouslySetInnerHTML={{ __html: html }}
          {...timestampHandlers}
        />

        <footer className="mt-3 flex min-h-8 items-center gap-1 font-sans text-xs text-muted-foreground">
          {confirmingDelete ? (
            <div className="flex w-full items-center gap-1" role="group" aria-label="Confirm delete">
              <span className="mr-auto text-foreground">Delete this note?</span>
              <Button variant="ghost" size="xs" onClick={() => setConfirmingDelete(false)} autoFocus>
                Keep
              </Button>
              <Button variant="destructive" size="xs" onClick={onDelete}>
                Delete
              </Button>
            </div>
          ) : (
            <>
              <time
                dateTime={note.updatedAt}
                className="mr-auto tabular-nums"
                title={new Date(note.updatedAt).toLocaleString()}
              >
                {time}
              </time>
              <div className="-mr-1.5 flex items-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                <Button variant="ghost" size="icon-sm" onClick={onStartEdit} title="Edit note" aria-label="Edit note">
                  <PencilSimple />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setConfirmingDelete(true)}
                  title="Delete note"
                  aria-label="Delete note"
                  className="hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash />
                </Button>
              </div>
            </>
          )}
        </footer>
      </div>
    </article>
  );
}
