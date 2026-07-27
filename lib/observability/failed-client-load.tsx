import "server-only"

import { ClientDataLoadError } from "@/components/client/data-load-error"
import { logAppErrorAsync } from "./log"

/**
 * The one way a client page reports a failed data load: records the fault in
 * `app_error_log` (so /admin/diagnostics and /admin/errors see it) and returns
 * the load-error panel to render in place of the page content.
 *
 * Pages must not render <ClientDataLoadError /> directly — a caught-and-
 * rendered query failure that never reaches the error log is exactly how the
 * July 2026 Billing 42703 stayed invisible to both admin dashboards while
 * clients saw a broken page. tests/api/client-error-states.test.ts enforces
 * this statically.
 */
export function failedClientLoad(input: {
  /** Dot-scoped logical area, "client.<page>.load". */
  area: string
  /** Fills "We couldn't load your <itemName>." on the panel. */
  itemName: string
  /** The real query error — PostgrestError, Error, anything thrown. */
  error: unknown
  /** Tenant id when the page has one. No PII beyond that belongs here. */
  clientId?: string | null
  context?: Record<string, unknown>
}) {
  logAppErrorAsync({
    area: input.area,
    source: "render",
    // The user is looking at a broken page, not a degraded read.
    severity: "error",
    error: input.error,
    clientId: input.clientId ?? null,
    context: input.context,
  })
  return <ClientDataLoadError itemName={input.itemName} />
}
