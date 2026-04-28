import posthog from "posthog-js";

export { posthog };

// Thin wrapper around posthog.captureException for non-fatal errors.
// Use this for caught errors and rejected promises so they reach PostHog
// with consistent metadata. The `source` should identify the call site
// (e.g. "CourseDetail.handleAddNote") to make grouping in PostHog easy.
export function reportError(
  error: unknown,
  source: string,
  extra?: Record<string, unknown>,
) {
  const err = error instanceof Error ? error : new Error(String(error));
  posthog.captureException(err, {
    extra: { source, ...extra },
  });
}
