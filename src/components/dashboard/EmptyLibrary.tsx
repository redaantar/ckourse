import { PlusIcon as Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SquircleButton } from "@/components/ui/SquircleButton";
import emptyAnimation from "@/assets/lotties/empty.json";
import { EASE_OUT } from "@/lib/constants";
import LottieLib from "lottie-react";

// Handle CJS/ESM default export interop: in some Vite/Rollup build modes
// lottie-react resolves to the module namespace object rather than the component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lottie: React.ComponentType<{ animationData: unknown; loop?: boolean }> = (LottieLib as any).default ?? LottieLib;

interface EmptyLibraryProps {
  onImport: () => void;
  className?: string;
}

export function EmptyLibrary({ onImport, className }: EmptyLibraryProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-24 text-center",
        className
      )}
      style={{
        animation: `card-in 500ms ${EASE_OUT} both`,
      }}
    >
      <div className="-mb-32 size-90">
        <Lottie animationData={emptyAnimation} loop />
      </div>

      <h3 className="font-heading text-xl font-bold text-foreground">
        No courses yet
      </h3>
      <p className="mt-2 max-w-xs font-sans text-sm text-muted-foreground">
        Import a course folder to start tracking your progress and pick up right
        where you left off.
      </p>

      <div className="mt-6">
        <SquircleButton variant="primary" onClick={onImport}>
          <Plus className="size-4" weight="bold" />
          Import Course
        </SquircleButton>
      </div>
    </div>
  );
}
