// The app-side webhook wait (8s inline on a client submit) is deliberately
// shorter than the partner workflow's ~30s worst case, so hitting the timeout
// proves nothing about the outcome — the admin email may still arrive. The
// recorded entry must therefore say "unconfirmed", never claim failure;
// otherwise Matt sees "failed" next to emails that arrived and learns to
// ignore the error log.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const EVENT_PAYLOAD = {
  type: "client_form_submitted" as const,
  client_id: "00000000-0000-0000-0000-000000000000",
  client_name: "Acme Ltd",
  submission_id: "11111111-1111-1111-1111-111111111111",
  assignment_id: null,
  submitted_at: "2026-07-27T10:00:00.000Z",
}

function timeoutRejection(): unknown {
  // AbortSignal.timeout's rejection reason: a DOMException named TimeoutError.
  // Constructed as a plain object because DOMException is not an Error subclass
  // in every runtime — which is exactly why detection matches on the name.
  return Object.assign(new Error("The operation was aborted due to timeout"), {
    name: "TimeoutError",
  })
}

describe("n8n webhook timeout is unconfirmed, not failed", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv("N8N_WEBHOOK_URL", "https://n8n.example.test/webhook/events")
    vi.stubEnv("N8N_WEBHOOK_SECRET", "shh")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("marks a timed-out dispatch unconfirmed with wording that does not claim failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(timeoutRejection())

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    const result = await dispatchNotification(EVENT_PAYLOAD)

    expect(result.ok).toBe(false)
    expect(result.unconfirmed).toBe(true)
    expect(result.error).toContain("No delivery confirmation")
    expect(result.error).toContain("may still arrive")
  })

  it("still reports a genuine transport error as a plain failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"))

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    const result = await dispatchNotification(EVENT_PAYLOAD)

    expect(result.ok).toBe(false)
    expect(result.unconfirmed).toBeUndefined()
    expect(result.error).toContain("network down")
  })

  it("isTimeoutError matches on the name, not the prototype chain", async () => {
    const { isTimeoutError } = await import("@/lib/notifications/dispatch")
    expect(isTimeoutError({ name: "TimeoutError" })).toBe(true)
    expect(isTimeoutError(new Error("boom"))).toBe(false)
    expect(isTimeoutError(undefined)).toBe(false)
  })
})
