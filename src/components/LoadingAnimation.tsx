import { useLottie } from "lottie-react";
import loadingAnimation from "@/assets/lotties/loading.json";
import { cn } from "@/lib/utils";

// useLottie only loads on mount, and only if its container is already in the
// DOM — so the hook must live in the component that renders the View. Calling
// it in a parent and rendering the View conditionally leaves it blank.
export function LoadingAnimation({ className }: { className?: string }) {
  const { View } = useLottie({
    animationData: loadingAnimation,
    loop: true,
    className: cn("size-12", className),
    "aria-hidden": true,
  });
  return View;
}
