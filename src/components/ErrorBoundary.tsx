import { Component, type ErrorInfo, type ReactNode } from "react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    posthog.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex h-screen flex-col items-center justify-center gap-3 bg-background">
          <p className="font-heading text-xl font-semibold text-foreground">Ckourse hit a snag</p>
          <p className="max-w-sm text-center font-sans text-sm text-muted-foreground">
            Your courses, progress and notes are safe. We've reported the problem; reloading usually clears it.
          </p>
          <Button className="mt-3" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
