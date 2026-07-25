// Regression spec for the inline n8n assessment-webhook fire in
// submitAssessmentAction (app/admin/assessments/actions.ts).
// Phase 18 — Plan 18-02. Covers RESEARCH §Q5 SC#5 satisfaction:
//   1. env-var-unset → skip silently (no fetch)
//   2. env-var-set → POST { submissionId } with 3s timeout
//   3. fetch rejection → workflow_errors insert, never throws
//   4. fetch success → no workflow_errors insert
//
// Hoisting-safe pattern (same idiom as Phase 17 specs):
//   All spy vi.fn() declared BEFORE vi.mock factories so they can close
//   over the spies at hoist time.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const FAKE_SUBMISSION_ID = "11111111-1111-4111-a111-111111111111"
const FAKE_WEBHOOK_URL = "https://n8n.example.test/webhook/assessment-submitted"
const FAKE_WEBHOOK_SECRET = "test-webhook-secret"

// ── next/* mocks — prevent server-only errors in jsdom environment ───────────
// next/cache, next/navigation, and next/server all import server-only
// transitively. Mock before any SUT import.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))

// ── @/lib/supabase/server — also imports server-only ────────────────────────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-user-id-1" } } }),
    },
  }),
}))

// ── Supabase admin client spies ──────────────────────────────────────────────

const workflowErrorsInsertSpy = vi.fn().mockResolvedValue({ error: null })

// form_submissions: called twice by submitAssessmentAction
//   (1) .select("template_version_id").eq(id).single()  — fetch submission row
//   (3) .update({...}).eq(id).eq("status","draft")       — write validated data
const submissionsSelectEqSingleSpy = vi.fn().mockResolvedValue({
  data: { template_version_id: "tv-id-1" },
  error: null,
})
const submissionsUpdateEqEqSpy = vi
  .fn()
  .mockResolvedValue({ data: [{ id: "11111111-1111-4111-a111-111111111111" }], error: null })

// template_versions: .select("schema_json").eq(id).single()
const versionsSelectEqSingleSpy = vi.fn().mockResolvedValue({
  data: { schema_json: { entities: {}, root: [] } },
  error: null,
})

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "workflow_errors") {
        return { insert: workflowErrorsInsertSpy }
      }
      if (table === "form_submissions") {
        return {
          // Called in Step 1: .select(...).eq(...).single()
          select: () => ({
            eq: () => ({ single: () => submissionsSelectEqSingleSpy() }),
          }),
          // Step 4: .update(...).eq("id").eq("status")[.eq("submitted_by")].select("id")
          // Self-chaining eq() supports the optional submitted_by predicate; the
          // terminal select() resolves the result.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          update: () => {
            const chain: any = { eq: () => chain, select: () => submissionsUpdateEqEqSpy() }
            return chain
          },
        }
      }
      if (table === "template_versions") {
        return {
          select: () => ({
            eq: () => ({ single: () => versionsSelectEqSingleSpy() }),
          }),
        }
      }
      // Fallback for any other table
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }
    },
  },
}))

// ── Auth mock ────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth-helpers", () => ({
  requireActorUserId: vi.fn().mockResolvedValue("admin-user-id-1"),
  // submitAssessmentAction now gates via authorizeSubmissionAccess (admin OR owner).
  isAdmin: vi.fn().mockResolvedValue(true),
  getClientContext: vi.fn().mockResolvedValue({ client_id: "client-id-1" }),
}))

// ── Form builder mocks ───────────────────────────────────────────────────────

vi.mock("@coltorapps/builder", () => ({
  validateEntitiesValues: vi.fn().mockResolvedValue({
    success: true,
    data: {},
  }),
}))

vi.mock("@/lib/form-builder", () => ({
  formBuilder: {},
}))

vi.mock("@/lib/form-builder/visibility/evaluate-visibility", () => ({
  evaluateVisibility: vi.fn().mockReturnValue({}),
}))

vi.mock("@/lib/form-builder/visibility/strip-hidden-answers", () => ({
  stripHiddenAnswers: vi.fn().mockImplementation((_schema: unknown, data: unknown) => data),
}))

// ── next/server after() — invoke callback eagerly so tests can await side effects ──
// Without this, after() runs out-of-band and the spec races against the webhook fire.

vi.mock("next/server", () => ({
  after: (cb: () => Promise<void> | void) => cb(),
}))

// ── AI SDK mocks — suppress runReportDraftGeneration side effects ────────────
// The AI after() callback still fires (same eagerly-invoked after() mock above),
// but runReportDraftGeneration is not the target of this spec. We stub the
// Supabase calls it makes (already covered by adminClient mock above) and
// suppress the OpenRouter call.

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({ object: {} }),
}))

vi.mock("@ai-sdk/openai", () => ({
  // createOpenAI returns a model factory that is CALLED as openrouter("model").
  // It must be a function, else runReportDraftGeneration throws "openai is not a
  // function" and logs a spurious second workflow_errors row.
  createOpenAI: () => () => ({}),
}))

// ── Suite ────────────────────────────────────────────────────────────────────

describe("submitAssessmentAction inline n8n webhook fire (Phase 18 SC#5)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    // Re-apply default resolved values after clearAllMocks
    submissionsSelectEqSingleSpy.mockResolvedValue({
      data: { template_version_id: "tv-id-1" },
      error: null,
    })
    versionsSelectEqSingleSpy.mockResolvedValue({
      data: { schema_json: { entities: {}, root: [] } },
      error: null,
    })
    submissionsUpdateEqEqSpy.mockResolvedValue({ data: [{ id: FAKE_SUBMISSION_ID }], error: null })
    workflowErrorsInsertSpy.mockResolvedValue({ error: null })
    // Stub OPENROUTER_API_KEY so runReportDraftGeneration doesn't throw
    vi.stubEnv("OPENROUTER_API_KEY", "test-key-placeholder")
    vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_SECRET", FAKE_WEBHOOK_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("skips the webhook when N8N_ASSESSMENT_WEBHOOK_URL is unset", async () => {
    vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_URL", "")
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 200 })
    )

    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions")
    await submitAssessmentAction(FAKE_SUBMISSION_ID, {})

    // fetch may be called by the AI pipeline (generateObject → OpenRouter) but
    // NOT by the webhook. Filter to only webhook-URL calls.
    const webhookCalls = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === "string" && url.startsWith("https://n8n.example.test")
    )
    expect(webhookCalls).toHaveLength(0)
    expect(workflowErrorsInsertSpy).not.toHaveBeenCalled()
  })

  it("POSTs { submissionId } to the configured webhook URL with content-type JSON and a 3s timeout", async () => {
    vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_URL", FAKE_WEBHOOK_URL)
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 200 })
    )

    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions")
    await submitAssessmentAction(FAKE_SUBMISSION_ID, {})

    const webhookCall = fetchSpy.mock.calls.find(
      ([url]) => url === FAKE_WEBHOOK_URL
    )
    expect(webhookCall).toBeDefined()

    const init = webhookCall![1] as RequestInit
    expect(init.method).toBe("POST")
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json")
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${FAKE_WEBHOOK_SECRET}`
    )
    expect(init.body).toBe(JSON.stringify({ submissionId: FAKE_SUBMISSION_ID }))
    expect(init.signal).toBeDefined()
    expect(workflowErrorsInsertSpy).not.toHaveBeenCalled()
  })

  it("inserts a workflow_errors row when fetch rejects, and never throws", async () => {
    vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_URL", FAKE_WEBHOOK_URL)

    // Only the webhook fetch rejects; AI-related fetches resolve OK
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      if (url === FAKE_WEBHOOK_URL) {
        return Promise.reject(new TypeError("network error"))
      }
      return Promise.resolve(new Response(null, { status: 200 }))
    })

    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions")
    // Must not throw even though fetch rejects
    await expect(submitAssessmentAction(FAKE_SUBMISSION_ID, {})).resolves.toBeUndefined()

    expect(workflowErrorsInsertSpy).toHaveBeenCalledTimes(1)
    const insertArg = workflowErrorsInsertSpy.mock.calls[0][0]
    expect(insertArg.workflow_name).toBe("assessment-submission-webhook")
    expect(insertArg.payload).toEqual({ submissionId: FAKE_SUBMISSION_ID })
    expect(typeof insertArg.error_message).toBe("string")
  })

  it("does not insert workflow_errors when fetch resolves successfully", async () => {
    vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_URL", FAKE_WEBHOOK_URL)
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }))

    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions")
    await submitAssessmentAction(FAKE_SUBMISSION_ID, {})

    expect(workflowErrorsInsertSpy).not.toHaveBeenCalled()
  })

  it("does not send and records a workflow error when the shared secret is missing", async () => {
    vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_URL", FAKE_WEBHOOK_URL)
    vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_SECRET", "")
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 200 })
    )

    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions")
    await submitAssessmentAction(FAKE_SUBMISSION_ID, {})

    expect(fetchSpy).not.toHaveBeenCalledWith(
      FAKE_WEBHOOK_URL,
      expect.anything()
    )
    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_name: "assessment-submission-webhook",
        error_message: expect.stringContaining("SECRET"),
      })
    )
  })

  it("records non-2xx webhook responses as workflow errors", async () => {
    vi.stubEnv("N8N_ASSESSMENT_WEBHOOK_URL", FAKE_WEBHOOK_URL)
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 503 })
    )

    const { submitAssessmentAction } = await import("@/app/admin/assessments/actions")
    await submitAssessmentAction(FAKE_SUBMISSION_ID, {})

    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_name: "assessment-submission-webhook",
        error_message: expect.stringContaining("503"),
      })
    )
  })
})
