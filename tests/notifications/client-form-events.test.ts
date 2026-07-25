// Tests for the three two-way-form-builder client events dispatched via
// lib/notifications/client-form-events.ts → dispatchNotification.
//
// Mirrors the fetch-mock + env-stub pattern of n8n-proposal-dispatch.test.ts.
// dispatchClientFormEvent dynamically imports ./dispatch (which pulls in
// "server-only"); we mock server-only to a no-op so the import resolves in jsdom.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// Capture workflow_errors inserts: a failed client-surface dispatch must land on
// the admin Workflow Errors page, not only in the platform logs.
const workflowErrorInserts: Record<string, unknown>[] = []
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === "workflow_errors") workflowErrorInserts.push(row)
        return Promise.resolve({ error: null })
      },
    }),
  },
}))

const FAKE_WEBHOOK_URL = "https://n8n.example.test/webhook/notifications"
const FAKE_SECRET = "super-secret-token"

const CLIENT_ID = "client-org-0000-4000-8000-000000000001"
const CLIENT_NAME = "Hallam House Care Home"

function deliveryAcknowledgement(): Response {
  return Response.json({ ok: true, delivered: true }, { status: 200 })
}

describe("dispatchClientFormEvent — two-way form builder events", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    workflowErrorInserts.length = 0
    vi.unstubAllEnvs()
    vi.stubEnv("N8N_WEBHOOK_URL", FAKE_WEBHOOK_URL)
    vi.stubEnv("N8N_WEBHOOK_SECRET", FAKE_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("POSTs a client_form_created payload with the org id and template fields", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      deliveryAcknowledgement()
    )
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await dispatchClientFormEvent({
      type: "client_form_created",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      template_id: "tpl-1",
      template_name: "Site Risk Walkthrough",
      template_type: "site_risk",
      created_at: "2026-06-08T10:00:00.000Z",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [calledUrl, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toBe(FAKE_WEBHOOK_URL)
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers["X-Webhook-Secret"]).toBe(FAKE_SECRET)

    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      type: "client_form_created",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      template_id: "tpl-1",
      template_name: "Site Risk Walkthrough",
      template_type: "site_risk",
      created_at: "2026-06-08T10:00:00.000Z",
    })
  })

  it("POSTs a client_form_submitted payload (assignment_id null for self-fill)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      deliveryAcknowledgement()
    )
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await dispatchClientFormEvent({
      type: "client_form_submitted",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      submission_id: "sub-9",
      assignment_id: null,
      submitted_at: "2026-06-08T11:00:00.000Z",
    })

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      type: "client_form_submitted",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      submission_id: "sub-9",
      assignment_id: null,
    })
  })

  it("POSTs a client_template_cloned payload carrying parent lineage", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      deliveryAcknowledgement()
    )
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await dispatchClientFormEvent({
      type: "client_template_cloned",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      template_id: "fork-7",
      template_name: "FRA Type 3",
      parent_template_id: "master-1",
      cloned_at: "2026-06-08T12:00:00.000Z",
    })

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      type: "client_template_cloned",
      template_id: "fork-7",
      parent_template_id: "master-1",
    })
  })

  it("never throws when the webhook returns a non-ok status (flow must not break)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 500 }))
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await expect(
      dispatchClientFormEvent({
        type: "client_form_created",
        client_id: CLIENT_ID,
        client_name: CLIENT_NAME,
        template_id: "tpl-1",
        template_name: "X",
        template_type: "fra",
        created_at: "2026-06-08T10:00:00.000Z",
      })
    ).resolves.toBeUndefined()
  })

  it("never throws when fetch itself rejects (transport failure)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"))
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await expect(
      dispatchClientFormEvent({
        type: "client_template_cloned",
        client_id: CLIENT_ID,
        client_name: CLIENT_NAME,
        template_id: "fork-7",
        template_name: "FRA Type 3",
        parent_template_id: "master-1",
        cloned_at: "2026-06-08T12:00:00.000Z",
      })
    ).resolves.toBeUndefined()
  })

  it("skips dispatch (no fetch) when the webhook env is unset, without throwing", async () => {
    vi.unstubAllEnvs()
    const fetchSpy = vi.spyOn(global, "fetch")
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await expect(
      dispatchClientFormEvent({
        type: "client_form_submitted",
        client_id: CLIENT_ID,
        client_name: CLIENT_NAME,
        submission_id: "sub-9",
        assignment_id: "asg-2",
        submitted_at: "2026-06-08T11:00:00.000Z",
      })
    ).resolves.toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("records a non-ok webhook status to workflow_errors", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 500 }))
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await dispatchClientFormEvent({
      type: "client_form_submitted",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      submission_id: "sub-9",
      assignment_id: null,
      submitted_at: "2026-06-08T11:00:00.000Z",
    })

    // Previously console.error only — invisible on the admin Workflow Errors page.
    expect(workflowErrorInserts).toHaveLength(1)
    expect(workflowErrorInserts[0]).toMatchObject({
      workflow_name: "client_form_submitted",
    })
    expect(String(workflowErrorInserts[0].error_message)).toContain("500")
  })

  it("records a transport rejection to workflow_errors", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"))
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await dispatchClientFormEvent({
      type: "client_template_cloned",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      template_id: "fork-7",
      template_name: "FRA Type 3",
      parent_template_id: "master-1",
      cloned_at: "2026-06-08T12:00:00.000Z",
    })

    expect(workflowErrorInserts).toHaveLength(1)
    expect(String(workflowErrorInserts[0].error_message)).toContain("network down")
  })

  it("records nothing when the dispatch succeeds", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(deliveryAcknowledgement())
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await dispatchClientFormEvent({
      type: "client_form_created",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      template_id: "tpl-1",
      template_name: "X",
      template_type: "fra",
      created_at: "2026-06-08T10:00:00.000Z",
    })

    expect(workflowErrorInserts).toHaveLength(0)
  })

  it("records a 2xx response that does not confirm Gmail delivery", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      Response.json({ ok: true }, { status: 200 })
    )
    const { dispatchClientFormEvent } = await import("@/lib/notifications/client-form-events")

    await dispatchClientFormEvent({
      type: "client_form_created",
      client_id: CLIENT_ID,
      client_name: CLIENT_NAME,
      template_id: "tpl-1",
      template_name: "X",
      template_type: "fra",
      created_at: "2026-06-08T10:00:00.000Z",
    })

    expect(workflowErrorInserts).toHaveLength(1)
    expect(String(workflowErrorInserts[0].error_message)).toContain(
      "did not confirm Gmail delivery"
    )
  })
})
