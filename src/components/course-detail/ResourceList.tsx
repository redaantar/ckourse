import { useState } from "react";
import {
  FileIcon as File,
  FilePdfIcon as FilePdf,
  FileTextIcon as FileText,
  LinkIcon as LinkSimple,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import type { CourseDetail, Lesson, Resource } from "@/types";

/** Show the search box once a course has more files than fit at a glance. */
const SEARCH_THRESHOLD = 8;

const resourceIcons: Record<string, React.ElementType> = {
  pdf: FilePdf,
  document: FileText,
  text: FileText,
  link: LinkSimple,
};

interface ResourceGroup {
  title: string;
  items: { resource: Resource; lesson?: Lesson }[];
}

interface ResourceListProps {
  courseData: CourseDetail;
  activeLesson?: Lesson;
  onOpen: (resource: Resource) => void;
  className?: string;
}

/**
 * The Resources tab: the playing lesson's files up top, then every file in the
 * course as a compact list grouped by section, so attachments are findable
 * without first playing the lesson they belong to.
 */
export function ResourceList({ courseData, activeLesson, onOpen, className }: ResourceListProps) {
  const [query, setQuery] = useState("");

  const current = activeLesson
    ? courseData.resources.filter((r) => r.lessonId === activeLesson.id)
    : [];

  const needle = query.trim().toLowerCase();
  const matches = (resource: Resource, lesson?: Lesson) =>
    !needle ||
    resource.title.toLowerCase().includes(needle) ||
    !!lesson?.title.toLowerCase().includes(needle);

  const groups: ResourceGroup[] = [
    {
      title: "Course",
      items: courseData.resources
        .filter((r) => r.lessonId == null)
        .map((resource): ResourceGroup["items"][number] => ({ resource })),
    },
    ...courseData.sections.map((section) => ({
      title: section.title,
      items: section.lessons.flatMap((lesson) =>
        courseData.resources
          .filter((r) => r.lessonId === lesson.id)
          .map((resource) => ({ resource, lesson })),
      ),
    })),
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => matches(i.resource, i.lesson)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {current.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-1.5 shadow-card">
          <p className="px-2.5 pt-1 pb-1.5 font-sans text-xs font-medium text-foreground">
            This lesson
          </p>
          {current.map((resource) => (
            <ResourceRow key={resource.id} resource={resource} onOpen={onOpen} />
          ))}
        </div>
      )}

      {courseData.resources.length > SEARCH_THRESHOLD && (
        <SearchInput value={query} onChange={setQuery} placeholder="Search files..." />
      )}

      <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-border bg-card shadow-card">
        {groups.length === 0 ? (
          <p className="px-4 py-6 text-center font-sans text-[13px] text-muted-foreground">
            No files match "{query}"
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.title} className="border-b border-border p-1.5 last:border-b-0">
              <div className="flex items-baseline justify-between gap-3 px-2.5 pt-1 pb-1.5">
                <p className="truncate font-sans text-xs font-medium text-muted-foreground">
                  {group.title}
                </p>
                <span className="shrink-0 font-sans text-xs text-muted-foreground tabular-nums">
                  {group.items.length}
                </span>
              </div>
              {group.items.map(({ resource, lesson }) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  lesson={lesson}
                  active={lesson != null && lesson.id === activeLesson?.id}
                  onOpen={onOpen}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface ResourceRowProps {
  resource: Resource;
  lesson?: Lesson;
  active?: boolean;
  onOpen: (resource: Resource) => void;
}

function ResourceRow({ resource, lesson, active, onOpen }: ResourceRowProps) {
  const Icon = resourceIcons[resource.type] || File;
  return (
    <button
      type="button"
      onClick={() => onOpen(resource)}
      title={lesson ? `${resource.title} — ${lesson.title}` : resource.title}
      className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary"
    >
      <Icon
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground",
          active && "text-foreground",
        )}
      />
      <span className="min-w-0 flex-1 truncate font-sans text-[13px] font-medium text-foreground">
        {resource.title}
      </span>
      {lesson && (
        <span className="hidden max-w-[45%] truncate font-sans text-xs text-muted-foreground sm:block">
          {lesson.title}
        </span>
      )}
    </button>
  );
}
