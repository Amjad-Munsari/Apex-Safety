// Tests for the proposal_signature_request and proposal_signed payload types
// added to lib/notifications/n8n-dispatch.ts.
//
// Fetch-mock pattern and env-stubbing mirrors the existing scheduler spec
// (tests/scheduler/n8n-assessment-webhook.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ── server-only guard — the SUT imports "server-only" at the module top ───────
// Vitest runs in jsdom; mock the package to a no-op so the import doesn't throw.
vi.mock("server-only", () => ({}))

// ── Suite ────────────────────────────────────────────────────────────────────

const FAKE_WEBHOOK_URL = "https://n8n.example.test/webhook/notifications"
const FAKE_SECRET = "super-secret-token"

describe("dispatchNotification — proposal payload types", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv("N8N_WEBHOOK_URL", FAKE_WEBHOOK_URL)
    vi.stubEnv("N8N_WEBHOOK_SECRET", FAKE_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("POSTs a proposal_signature_request payload correctly and returns ok:true", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 200 })
    )

    const { dispatchNotification } = await import("@/lib/notifications/n8n-dispatch")

    const result = await dispatchNotification({
      type: "proposal_signature_request",
      client_name: "Acme Ltd",
      client_email: "contact@acme.example",
      proposal_title: "Fire Risk Assessment Proposal",
      signing_url: "https://app.example.com/sign/abc123rawtoken",
      expiry_date: "2026-07-08",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit]

    // URL
    expect(calledUrl).toBe(FAKE_WEBHOOK_URL)

    // Method
    expect(init.method).toBe("POST")

    // Headers
    const headers = init.headers as Record<string, string>
    expect(headers["X-Webhook-Secret"]).toBe(FAKE_SECRET)
    expect(headers["Content-Type"]).toBe("application/json")

    // Body shape
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.type).toBe("proposal_signature_request")
    expect(body.signing_url).toBe("https://app.example.com/sign/abc123rawtoken")

    // Result
    expect(result.ok).toBe(true)
  })

  it("POSTs a proposal_signed payload correctly and returns ok:true", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 200 })
    )

    const { dispatchNotification } = await import("@/lib/notifications/n8n-dispatch")

    const result = await dispatchNotification({
      type: "proposal_signed",
      client_name: "Acme Ltd",
      client_email: "contact@acme.example",
      proposal_title: "Fire Risk Assessment Proposal",
      signed_at: "2026-06-08T14:30:00.000Z",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit]

    // URL
    expect(calledUrl).toBe(FAKE_WEBHOOK_URL)

    // Method
    expect(init.method).toBe("POST")

    // Headers
    const headers = init.headers as Record<string, string>
    expect(headers["X-Webhook-Secret"]).toBe(FAKE_SECRET)
    expect(headers["Content-Type"]).toBe("application/json")

    // Body shape
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.type).toBe("proposal_signed")

    // Result
    expect(result.ok).toBe(true)
  })

  it("returns ok:false with status 500 when the webhook returns a non-ok response", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 500 })
    )

    const { dispatchNotification } = await import("@/lib/notifications/n8n-dispatch")

    const result = await dispatchNotification({
      type: "proposal_signature_request",
      client_name: "Acme Ltd",
      client_email: "contact@acme.example",
      proposal_title: "Fire Risk Assessment Proposal",
      signing_url: "https://app.example.com/sign/abc123rawtoken",
      expiry_date: "2026-07-08",
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
  })
})
