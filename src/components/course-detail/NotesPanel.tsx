import {
  NotePencilIcon as NotePencil,
  PencilSimpleIcon as PencilSimple,
  TrashIcon as Trash,
} from "@phosphor-icons/react";
import { NoteEditor } from "./NoteEditor";
import { SNAPPY } from "@/lib/constants";
import type { Note } from "@/types";

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
          className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 font-sans text-xs text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground"
          style={{ transitionTimingFunction: SNAPPY }}
        >
          <NotePencil className="size-3.5" />
          Add a note...
        </button>
      )}

      {notes.length === 0 && !showEditor && (
        <p className="py-4 text-center font-sans text-xs text-muted-foreground/60">
          No notes yet. Start capturing your thoughts.
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
      className="group rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-secondary/50"
      style={{ transitionTimingFunction: SNAPPY }}
    >
      <div className="flex items-start gap-2">
        <div
          className="note-content flex-1 font-sans text-xs leading-relaxed text-foreground/90"
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
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onStartEdit}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <PencilSimple className="size-3" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash className="size-3" />
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground/50">
          {note.lessonTitle}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/50">
          {formatted}
        </span>
      </div>
    </div>
  );
}
