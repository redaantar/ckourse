import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface CourseTitleContextValue {
  titles: Record<number, string>;
  setTitle: (courseId: number, title: string) => void;
}

const CourseTitleContext = createContext<CourseTitleContextValue>({
  titles: {},
  setTitle: () => {},
});

export function CourseTitleProvider({ children }: { children: ReactNode }) {
  const [titles, setTitles] = useState<Record<number, string>>({});
  const setTitle = useCallback((courseId: number, title: string) => {
    setTitles((prev) => (prev[courseId] === title ? prev : { ...prev, [courseId]: title }));
  }, []);
  return (
    <CourseTitleContext.Provider value={{ titles, setTitle }}>
      {children}
    </CourseTitleContext.Provider>
  );
}

export function useCourseTitles() {
  return useContext(CourseTitleContext);
}
