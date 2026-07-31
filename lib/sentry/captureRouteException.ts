export async function captureRouteException(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    if (context) {
      Sentry.withScope((scope) => {
        scope.setContext("route", context);
        Sentry.captureException(error);
      });
      return;
    }
    Sentry.captureException(error);
  } catch {
    /* Sentry optional */
  }
}
