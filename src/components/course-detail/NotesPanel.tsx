import { useState } from "react";
import {
  NotePencilIcon as NotePencil,
  PencilSimpleIcon as PencilSimple,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import { NoteEditor } from "./NoteEditor";
import { SNAPPY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Note } from "@/types";
import { formatTimestamp } from "@/lib/format";

interface NotesPanelProps {
  notes: Note[];
  videoTime: number;
  editingNoteId: number | null;
  showEditor: boolean;
  onAdd: (content: string) => void;
  onEdit: (noteId: number, content: string) => void;
  onDelete: (noteId: number) => void;
  onSetEditing: (id: number | null) => void;
  onSetShowEditor: (show: boolean) => void;
  onTimestampClick?: (seconds: number, lessonId: number) => void;
}

export function NotesPanel({
  notes,
  videoTime,
  editingNoteId,
  showEditor,
  onAdd,
  onEdit,
  onDelete,
  onSetEditing,
  onSetShowEditor,
  onTimestampClick,
}: NotesPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      {showEditor ? (
        <NoteEditor
          videoTime={videoTime}
          onSubmit={onAdd}
          onCancel={() => onSetShowEditor(false)}
        />
      ) : (
        <button
          onClick={() => onSetShowEditor(true)}
          className="flex h-12 items-center gap-2.5 rounded-2xl bg-secondary/70 px-4 font-sans text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          style={{ transitionTimingFunction: SNAPPY }}
        >
          <NotePencil className="size-4" />
          Write a note at {formatTimestamp(videoTime)}
        </button>
      )}

      {notes.length === 0 && !showEditor && (
        <p className="px-1 py-2 font-sans text-[13px] text-muted-foreground">
          Notes you write here stay pinned to this lesson. Type @ in a note to link the exact moment.
        </p>
      )}

      {notes.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          videoTime={videoTime}
          isEditing={editingNoteId === note.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onStartEdit={() => onSetEditing(note.id)}
          onCancelEdit={() => onSetEditing(null)}
          onTimestampClick={onTimestampClick}
        />
      ))}
    </div>
  );
}

interface NoteCardProps {
  note: Note;
  videoTime: number;
  isEditing: boolean;
  onEdit: (noteId: number, content: string) => void;
  onDelete: (noteId: number) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onTimestampClick?: (seconds: number, lessonId: number) => void;
}

function NoteCard({
  note,
  videoTime,
  isEditing,
  onEdit,
  onDelete,
  onStartEdit,
  onCancelEdit,
  onTimestampClick,
}: NoteCardProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (isEditing) {
    return (
      <NoteEditor
        videoTime={videoTime}
        initialContent={note.content}
        onSubmit={(content) => onEdit(note.id, content)}
        onCancel={onCancelEdit}
      />
    );
  }

  const date = new Date(note.updatedAt);
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="group rounded-2xl border border-border bg-card px-4 py-3 shadow-card"
      style={{ transitionTimingFunction: SNAPPY }}
    >
      <div className="flex items-start gap-2">
        <div
          className="note-content min-w-0 flex-1 font-sans text-sm leading-relaxed text-foreground select-text"
          dangerouslySetInnerHTML={{ __html: note.content }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains("note-timestamp")) {
              const seconds = Number(target.dataset.timestamp);
              if (!isNaN(seconds) && onTimestampClick) {
                onTimestampClick(seconds, note.lessonId);
              }
            }
          }}
        />
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
            confirmingDelete ? "opacity-100" : "opacity-0",
          )}
          onMouseLeave={() => setConfirmingDelete(false)}
        >
          <button
            onClick={onStartEdit}
            aria-label="Edit note"
            title="Edit note"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <PencilSimple className="size-3.5" />
          </button>
          {confirmingDelete ? (
            <button
              onClick={() => onDelete(note.id)}
              onBlur={() => setConfirmingDelete(false)}
              autoFocus
              className="rounded-full bg-destructive/12 px-2.5 py-1 font-sans text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
            >
              Delete?
            </button>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              aria-label="Delete note"
              title="Delete note"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/12 hover:text-destructive"
            >
              <Trash className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-1.5 font-sans text-xs text-muted-foreground">{formatted}</p>
    </div>
  );
}
