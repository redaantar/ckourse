import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !text-foreground !border-border !font-sans !rounded-xl",
          description: "!text-muted-foreground",
          error: "!border-destructive/40",
        },
      }}
    />
  );
}
