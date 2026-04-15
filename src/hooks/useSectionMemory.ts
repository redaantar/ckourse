import type { SectionMemory } from "@/types";

// Module-level map so it survives re-renders without context wiring
const memory = new Map<string, string>();

export const sectionMemory: SectionMemory = {
  get(sectionRoot: string): string {
    return memory.get(sectionRoot) ?? sectionRoot;
  },
  set(sectionRoot: string, fullPath: string): void {
    memory.set(sectionRoot, fullPath);
  },
};
