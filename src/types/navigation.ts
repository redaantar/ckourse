export interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface SectionMemory {
  /** Get the remembered path for a section root, or the root itself. */
  get(sectionRoot: string): string;
  /** Record that a given full path belongs to a section. */
  set(sectionRoot: string, fullPath: string): void;
}
