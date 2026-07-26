// Tests for the Resend email transport in lib/notifications/dispatch.ts.
//
// The eight email-shaped payload types are rendered from templates and sent via
// Resend; the three client_form_* events still POST to the n8n webhook. These
// tests cover both branches plus the missing-key and Resend-error paths.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// server-only guard — the SUT imports "server-only" at module top.
vi.mock("server-only", () => ({}))

// Mock the Resend SDK: `new Resend(key).emails.send(opts)` → sendSpy.
const sendSpy = vi.fn()
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: (...args: unknown[]) => sendSpy(...args) },
  })),
}))

const SIGNATURE_PAYLOAD = {
  type: "proposal_signature_request" as const,
  client_name: "Acme Ltd",
  client_email: "contact@acme.example",
  proposal_title: "Fire Risk Assessment Proposal",
  signing_url: "https://app.example.com/sign/abc123rawtoken",
  expiry_date: "2026-07-08",
}

describe("dispatchNotification — Resend email transport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules() // reset the memoized Resend client between tests
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("sends an email via Resend for an email-shaped payload and returns ok:true", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key")
    vi.stubEnv("EMAIL_FROM", "Merlin Safety System <notifications@merlinsafetysystem.com>")
    vi.stubEnv("EMAIL_REPLY_TO", "info@888safetyandtraining.com")
    sendSpy.mockResolvedValue({ data: { id: "email_123" }, error: null })

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    const result = await dispatchNotification(SIGNATURE_PAYLOAD)

    expect(result.ok).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(1)

    const opts = sendSpy.mock.calls[0][0] as {
      from: string
      to: string
      subject: string
      html: string
      replyTo?: string
    }
    expect(opts.to).toBe("contact@acme.example")
    expect(opts.from).toContain("merlinsafetysystem.com")
    expect(opts.subject).toContain("Fire Risk Assessment Proposal")
    expect(opts.replyTo).toBe("info@888safetyandtraining.com")
    // The raw signing URL must appear in the email body (it's the CTA), but never
    // in the log — logging redaction is asserted separately at the unit level.
    expect(opts.html).toContain("abc123rawtoken")
    expect(opts.html.length).toBeGreaterThan(0)
  })

  it("returns ok:false when Resend reports an error", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key")
    sendSpy.mockResolvedValue({ data: null, error: { message: "domain not verified" } })

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    const result = await dispatchNotification(SIGNATURE_PAYLOAD)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("domain not verified")
  })

  it("uses the canonical public reply address when EMAIL_REPLY_TO is unset", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key")
    sendSpy.mockResolvedValue({ data: { id: "email_456" }, error: null })

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    await dispatchNotification(SIGNATURE_PAYLOAD)

    const opts = sendSpy.mock.calls[0][0] as {
      html: string
      replyTo: string
    }
    expect(opts.replyTo).toBe("info@888safetyandtraining.com")
    expect(opts.html).toContain("info@888safetyandtraining.com")
    expect(opts.html).toContain("0333 049 8979")
  })

  it("returns ok:false in production when RESEND_API_KEY is missing (no send attempted)", async () => {
    vi.stubEnv("NODE_ENV", "production")
    // RESEND_API_KEY intentionally unset.

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    const result = await dispatchNotification(SIGNATURE_PAYLOAD)

    expect(result.ok).toBe(false)
    expect(result.error).toContain("RESEND_API_KEY")
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it("escapes client-controlled fields in the rendered HTML (no raw markup injection)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key")
    sendSpy.mockResolvedValue({ data: { id: "e1" }, error: null })

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    await dispatchNotification({
      ...SIGNATURE_PAYLOAD,
      client_name: '<script>alert(1)</script>',
      proposal_title: '"><img src=x onerror=alert(2)>',
    })

    const html = (sendSpy.mock.calls[0][0] as { html: string }).html
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).not.toContain("<img src=x onerror=alert(2)>")
    expect(html).toContain("&lt;script&gt;")
    expect(html).toContain("&lt;img src=x")
  })

  it("uses recipient_email (not client_email) as the To for portal invites", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key")
    sendSpy.mockResolvedValue({ data: { id: "e2" }, error: null })

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    const result = await dispatchNotification({
      type: "client_portal_invite",
      client_name: "Acme Ltd",
      recipient_name: "Jane",
      recipient_email: "jane@acme.example",
      invite_url: "https://app.example.com/auth/confirm?token_hash=abc",
      status: "invited",
    })

    expect(result.ok).toBe(true)
    const opts = sendSpy.mock.calls[0][0] as { to: string; html: string }
    expect(opts.to).toBe("jane@acme.example")
    expect(opts.html).toContain("Acme Ltd")
  })

  it("routes client_form_* events to the n8n webhook, not Resend", async () => {
    vi.stubEnv("N8N_WEBHOOK_URL", "https://n8n.example.test/webhook/events")
    vi.stubEnv("N8N_WEBHOOK_SECRET", "secret-token")
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        Response.json({ ok: true, delivered: true }, { status: 200 })
      )

    const { dispatchNotification } = await import("@/lib/notifications/dispatch")
    const result = await dispatchNotification({
      type: "client_form_submitted",
      client_id: "00000000-0000-0000-0000-000000000000",
      client_name: "Hallam House Care Home",
      submission_id: "11111111-1111-1111-1111-111111111111",
      assignment_id: null,
      submitted_at: "2026-07-23T10:00:00.000Z",
    })

    expect(result.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).not.toHaveBeenCalled()

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://n8n.example.test/webhook/events")
    expect((init.headers as Record<string, string>)["X-Webhook-Secret"]).toBe("secret-token")

    fetchSpy.mockRestore()
  })
})
