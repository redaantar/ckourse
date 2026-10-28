import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/hooks/useTheme";

export function Toaster() {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-popover !text-popover-foreground !border-border !font-sans !rounded-2xl !shadow-pop",
          description: "!text-muted-foreground",
          error: "!border-destructive/40",
        },
      }}
    />
  );
}
