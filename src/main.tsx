import ReactDOM from "react-dom/client";
import { StrictMode } from "react";
import { HashRouter } from "react-router-dom";
import { PostHogProvider } from "@posthog/react";
import App from "./App";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";


const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: "2026-01-30",
  exception_autocapture: true,
} as const;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PostHogProvider apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN} options={posthogOptions}>
      <ErrorBoundary>
        <HashRouter>
          <App />
        </HashRouter>
        <Toaster />
      </ErrorBoundary>
    </PostHogProvider>
  </StrictMode>
);
