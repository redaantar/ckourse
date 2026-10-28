import { PlusIcon as Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import emptyAnimation from "@/assets/lotties/empty.json";
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
        // Fill the inset content panel (window height minus its 8px margins) so the block sits dead center
        "flex min-h-[calc(100dvh-1rem)] flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      {/* Match the animation's 231×95 canvas so no letterboxing pads it vertically */}
      <div className="aspect-[231/95] w-90 max-w-full" aria-hidden="true">
        <Lottie animationData={emptyAnimation} loop />
      </div>

      <h3 className="mt-6 font-heading text-2xl font-semibold text-foreground">
        Your library is waiting
      </h3>
      <p className="mt-2 max-w-sm font-sans text-sm text-balance text-muted-foreground">
        Bring in a folder of videos and Ckourse turns it into a course, with
        chapters, progress and notes, ready to pick up wherever you stop.
      </p>

      <div className="mt-6">
        <Button size="lg" onClick={onImport}>
          <Plus className="size-4" weight="bold" />
          Add your first course
        </Button>
      </div>
    </div>
  );
}
