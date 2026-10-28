import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowsClockwiseIcon as ArrowsClockwise, PlayIcon as Play, CaretRightIcon as CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MomentFrame } from "@/components/notes/MomentFrame";
import { EASE_OUT, SPRING_SNAPPY } from "@/lib/constants";
import { firstTimestamp, lessonLink, renderNoteHtml, timeAgo } from "@/lib/notes";
import { useTimestampJump } from "@/components/notes/NoteCard";
import type { NoteWithCourse } from "@/types";

interface RevisitNoteProps {
  notes: NoteWithCourse[];
  className?: string;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Brings back one thing you wrote a while ago. Re-reading your own words is
 * retrieval practice: it's how a note turns into something you remember.
 */
export function RevisitNote({ notes, className }: RevisitNoteProps) {
  // Prefer notes old enough to have been forgotten; fall back to everything
  const pool = useMemo(() => {
    const older = notes.filter((n) => Date.now() - new Date(n.updatedAt).getTime() > DAY);
    return older.length >= 2 ? older : notes;
  }, [notes]);

  const [pick, setPick] = useState(() => Math.floor(Math.random() * pool.length));
  const [turns, setTurns] = useState(0);
  const [hovered, setHovered] = useState(false);
  const note = pool[pick % pool.length];

  const html = useMemo(() => renderNoteHtml(note.content), [note.content]);
  const moment = useMemo(() => firstTimestamp(note.content), [note.content]);
  const timestampHandlers = useTimestampJump(note.courseId, note.lessonId);

  const another = () => {
    if (pool.length < 2) return;
    let next = Math.floor(Math.random() * (pool.length - 1));
    if (next >= pick % pool.length) next++;
    setPick(next);
    setTurns((t) => t + 1);
  };

  return (
    <section
      aria-label="Revisit a note"
      className={cn(
        "relative flex overflow-hidden rounded-3xl border border-border bg-card shadow-card",
        className,
      )}
    >
      <Link
        key={`frame-${note.id}`}
        to={lessonLink(note.courseId, note.lessonId, moment?.seconds)}
        tabIndex={-1}
        aria-hidden="true"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        className="m-2 mr-0 hidden w-72 shrink-0 self-center overflow-hidden rounded-[18px] sm:block lg:w-96"
        style={{ animation: `card-in 400ms ${EASE_OUT} both` }}
      >
        <MomentFrame
          courseTitle={note.courseTitle}
          accentColor={note.accentColor}
          videoPath={note.videoPath}
          seconds={moment?.seconds}
          hovered={hovered}
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <p className="font-sans text-[13px] font-semibold text-foreground">
            Remember this?{" "}
            <span className="font-normal text-muted-foreground">You wrote it {timeAgo(note.updatedAt)}.</span>
          </p>
          {pool.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={another}
              className="-my-1 ml-auto text-muted-foreground"
              title="Show another note"
            >
              <ArrowsClockwise
                className="size-4"
                style={{ transform: `rotate(${turns * 180}deg)`, transition: `transform ${SPRING_SNAPPY}` }}
              />
              Another
            </Button>
          )}
        </div>

        <div key={note.id} className="flex flex-1 flex-col gap-4" style={{ animation: `card-in 350ms ${EASE_OUT} both` }}>
          <div
            className="note-content line-clamp-4 font-heading text-[19px] leading-snug font-medium tracking-[-0.01em] text-balance text-foreground select-text lg:text-[22px]"
            dangerouslySetInnerHTML={{ __html: html }}
            {...timestampHandlers}
          />

          <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link
              to={lessonLink(note.courseId, note.lessonId)}
              className="flex min-w-0 items-center gap-1 font-sans text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="max-w-56 truncate">{note.courseTitle}</span>
              <CaretRight className="size-2.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{note.lessonTitle}</span>
            </Link>
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link to={lessonLink(note.courseId, note.lessonId, moment?.seconds)}>
                <Play weight="fill" className="size-3.5" />
                {moment ? (
                  <>
                    Watch from <span className="font-mono text-[12px]">{moment.label}</span>
                  </>
                ) : (
                  "Open lesson"
                )}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
