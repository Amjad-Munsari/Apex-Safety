import type { Instrumentation } from "next"

/**
 * Catches every server-side error Next.js observes — Server Component renders,
 * route handlers, server actions and proxy — without any call site opting in.
 *
 * This is the piece that turns "we log the failures we remembered to wrap" into
 * "we log everything". A `try/catch` only reports faults someone anticipated;
 * `onRequestError` fires for the ones nobody did, which are the ones that
 * actually cost time to diagnose.
 *
 * It matters most for Server Components: in production React replaces those
 * errors with an opaque digest in the browser, so without this hook the only
 * record is a short-lived Vercel log line and Matt sees a bare error page.
 * Storing the digest alongside the real stack means a screenshot of
 * "Digest: 2158489109" is enough to find the cause.
 *
 * The handler is awaited (per Next's docs, unawaited async work here is not
 * guaranteed to run) and can never throw — a throw inside the error handler
 * would be reported by nothing.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  try {
    // Imported lazily so this module stays loadable in the Edge runtime and so
    // a logger-side import failure cannot break server startup.
    const { logAppError } = await import("@/lib/observability/log")
    const { safeHeaders } = await import("@/lib/observability/redact")

    const headers = safeHeaders(request.headers)

    // Next's routeType maps cleanly onto our source vocabulary; anything new in
    // a future release falls back to 'route' rather than failing the insert
    // against the CHECK constraint.
    const sourceByRouteType: Record<string, "render" | "route" | "action" | "proxy"> = {
      render: "render",
      route: "route",
      action: "action",
      proxy: "proxy",
    }

    await logAppError({
      area: `unhandled.${context.routeType ?? "unknown"}`,
      source: sourceByRouteType[context.routeType] ?? "route",
      error: err,
      routePath: context.routePath,
      requestPath: request.path,
      requestMethod: request.method,
      // Vercel stamps every request with x-vercel-id; it's the correlation key
      // between this row and the platform's own logs.
      requestId: headers["x-vercel-id"] ?? headers["x-request-id"],
      actorType: "system",
      context: {
        routerKind: context.routerKind,
        routeType: context.routeType,
        renderSource: context.renderSource,
        // `renderType` is documented but absent from this release's types; read
        // it defensively so we keep the detail without pinning to a shape the
        // installed version doesn't declare.
        renderType: (context as { renderType?: string }).renderType,
        revalidateReason: context.revalidateReason,
        headers,
      },
    })
  } catch (loggingFailure) {
    // Last resort: the original error must not be lost because reporting broke.
    console.error("[instrumentation] onRequestError failed to report", loggingFailure)
    console.error("[instrumentation] original error", err)
  }
}
