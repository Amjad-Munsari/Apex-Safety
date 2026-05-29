// Phase 07 Plan 07-07 — Contract tests pinning the user-invisible
// guarantees of the AI report pipeline.
//
// Decisions referenced (see .planning/phases/07-ai-report-pipeline/07-CONTEXT.md):
//   D-06  — draft path (runReportDraftGeneration) MUST NOT call dispatchNotification.
//           Email side-effects are exclusive to finalizeReport (REPORT-11).
//   D-10  — On AI failure inside runReportDraftGeneration, a workflow_errors row
//           is inserted (workflow_name='ai_report_draft') BEFORE the status flip
//           to 'ai_draft_failed', BEFORE the rethrow.
//   D-11  — REPORT-12 acceptance: workflow_errors row + status='ai_draft_failed'.
//   D-08  — On dispatchNotification failure inside finalizeReport, a workflow_errors
//           row is inserted (workflow_name='report_delivery_email') and the PDF /
//           status='completed' is NOT rolled back. The return value carries
//           deliveryEmailFailed=true.
//
// Pattern note: hoisting-safe mocks — every spy is declared BEFORE the matching
// vi.mock factory so the factory can close over it. Mirrors tests/scheduler/
// n8n-assessment-webhook.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// ── Shared call-order log (lets D-10 prove insert-before-update ordering) ────

type CallLogEntry =
  | { kind: "workflow_errors.insert"; arg: Record<string, unknown> }
  | { kind: "form_submissions.update"; arg: Record<string, unknown>; eqId: string }
  | { kind: "form_submissions.select.single" }
  | { kind: "template_versions.select.single" }
  | { kind: "client_users.select.limit" }
  | { kind: "storage.upload"; path: string }
  | { kind: "storage.createSignedUrl"; path: string; ttl: number }
  | { kind: "dispatchNotification"; payload: Record<string, unknown> }

let callLog: CallLogEntry[] = []

// ── Spies (declared before vi.mock factories) ────────────────────────────────

const workflowErrorsInsertSpy = vi.fn()
const formSubmissionsUpdateSpy = vi.fn()
const formSubmissionsSelectSingleSpy = vi.fn()
const templateVersionsSelectSingleSpy = vi.fn()
const clientUsersSelectLimitSpy = vi.fn()
const storageUploadSpy = vi.fn()
const storageCreateSignedUrlSpy = vi.fn()
const dispatchNotificationSpy = vi.fn()
const revalidatePathSpy = vi.fn()
const generateObjectSpy = vi.fn()

// ── next/* mocks — prevent server-only errors in jsdom environment ───────────

vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePathSpy(...args) }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("next/server", () => ({ after: (cb: () => unknown) => cb() }))

// ── Supabase server client — auth gate satisfied with a fake admin user ──────

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }),
    },
  }),
}))

// ── Supabase admin client — chainable mock recording all touched tables ──────
//
// Shape contract (see app/admin/assessments/actions.ts):
//   runReportDraftGeneration:
//     from("form_submissions").select(...).eq("id", id).single()
//     from("template_versions").select(...).eq("id", id).single()
//     [on success] from("form_submissions").update({...}).eq("id", id)
//     [on failure]
//       from("workflow_errors").insert({...})
//       from("form_submissions").update({status:"ai_draft_failed"}).eq("id", id)
//   finalizeReport:
//     from("form_submissions").select(...).eq("id", id).single()
//     from("client_users").select(...).eq("client_id", id).limit(1)
//     storage.from("reports").upload(fileName, buffer, opts)
//     from("form_submissions").update({...}).eq("id", id)
//     storage.from("reports").createSignedUrl(fileName, 60*60*24*7)
//     [on dispatch fail] from("workflow_errors").insert({...})
//     storage.from("reports").createSignedUrl(fileName, 60*5)

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => {
      if (table === "workflow_errors") {
        return {
          insert: (arg: Record<string, unknown>) => {
            callLog.push({ kind: "workflow_errors.insert", arg })
            return workflowErrorsInsertSpy(arg)
          },
        }
      }
      if (table === "form_submissions") {
        return {
          select: () => ({
            eq: () => ({
              single: () => {
                callLog.push({ kind: "form_submissions.select.single" })
                return formSubmissionsSelectSingleSpy()
              },
            }),
          }),
          update: (arg: Record<string, unknown>) => ({
            eq: (_col: string, val: string) => {
              callLog.push({ kind: "form_submissions.update", arg, eqId: val })
              return formSubmissionsUpdateSpy(arg, val)
            },
          }),
        }
      }
      if (table === "template_versions") {
        return {
          select: () => ({
            eq: () => ({
              single: () => {
                callLog.push({ kind: "template_versions.select.single" })
                return templateVersionsSelectSingleSpy()
              },
            }),
          }),
        }
      }
      if (table === "client_users") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => {
                callLog.push({ kind: "client_users.select.limit" })
                return clientUsersSelectLimitSpy()
              },
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
      }
    },
    storage: {
      from: (_bucket: string) => ({
        upload: (path: string, _buffer: unknown, _opts: unknown) => {
          callLog.push({ kind: "storage.upload", path })
          return storageUploadSpy(path)
        },
        createSignedUrl: (path: string, ttl: number) => {
          callLog.push({ kind: "storage.createSignedUrl", path, ttl })
          return storageCreateSignedUrlSpy(path, ttl)
        },
      }),
    },
  },
}))

// ── Notifications mock — the spy MUST register every call from the SUT.
// REPORT-11 / D-06 verification depends on its mock.calls.length staying 0
// across both draft-path branches.

vi.mock("@/lib/notifications/n8n-dispatch", () => ({
  dispatchNotification: (...args: unknown[]) => {
    callLog.push({ kind: "dispatchNotification", payload: args[0] as Record<string, unknown> })
    return dispatchNotificationSpy(...args)
  },
}))

// ── AI SDK mocks — generateObject is the throw / resolve toggle point ────────

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectSpy(...args),
}))

vi.mock("@ai-sdk/openai", () => ({
  // createOpenAI returns a callable that returns an opaque model handle.
  // Neither value is actually invoked beyond being passed to generateObject —
  // which is fully mocked above. Safe to stub to a no-op.
  createOpenAI: () => () => ({}),
}))

// ── PDF generator — dynamically imported in finalizeReport, so a vi.mock
// is the correct interception point.

vi.mock("@/lib/pdf/generator", () => ({
  generateReportPdfBuffer: vi.fn(async () => Buffer.from("fake-pdf-bytes")),
}))

// ── Auth helpers — used at module load time by other exports in actions.ts.
// requireActorUserId is not on either SUT path but the import must resolve.

vi.mock("@/lib/auth-helpers", () => ({
  requireActorUserId: vi.fn(async () => "admin-1"),
}))

// ── Form-builder helpers imported at the top of actions.ts ───────────────────

vi.mock("@/lib/form-builder/storage/upload-paths", () => ({
  buildSignatureStoragePath: vi.fn(() => "x/y/z.png"),
  buildPhotoStoragePath: vi.fn(() => "x/y/z.png"),
}))

vi.mock("@/lib/form-builder/expand-repeating-sections", () => ({
  // Identity function — the answers shape doesn't matter; generateObject is mocked.
  expandRepeatingSections: vi.fn((_schema: unknown, answers: unknown) => answers),
}))

vi.mock("@/lib/ai/exemplars/yellow-broom-fra", () => ({
  YELLOW_BROOM_EXEMPLAR: "FAKE_EXEMPLAR",
}))

vi.mock("@/lib/ai/prompt-builder", () => ({
  buildReportPrompt: vi.fn(() => "FAKE_PROMPT"),
}))

// ── Constants for the SUT calls ──────────────────────────────────────────────

const SUBMISSION_ID = "sub-1"
const CLIENT_ID = "client-1"
const REPORT_PATH = `${CLIENT_ID}/report_${SUBMISSION_ID}.pdf`

const VALID_APPROVED_DRAFT = {
  executiveSummary: "All clear.",
  hazards: [
    {
      location: "Main corridor",
      description: "Blocked fire exit",
      severity: "High" as const,
      recommendedAction: "Clear the obstruction.",
    },
  ],
  complianceStatus: "Action Required" as const,
}

// ── Default-stub helper (re-applied in beforeEach since clearAllMocks wipes
// the resolved-value behavior, not just the call records). ──────────────────

function applyDefaultStubs() {
  // runReportDraftGeneration SELECT chains:
  formSubmissionsSelectSingleSpy.mockResolvedValue({
    data: {
      // finalizeReport needs the wider select shape; runReportDraftGeneration only
      // touches the first two fields. Supplying everything in one shared default
      // is safe because Supabase silently drops keys that the .select() didn't ask for.
      id: SUBMISSION_ID,
      answers_json: { q1: "yes" },
      template_version_id: "tv-1",
      client_id: CLIENT_ID,
      created_at: "2026-05-29T12:00:00Z",
      client: { name: "Acme Properties Ltd", site_address: "12 Example Street" },
    },
    error: null,
  })
  templateVersionsSelectSingleSpy.mockResolvedValue({
    data: { schema_json: { entities: {} } },
    error: null,
  })
  clientUsersSelectLimitSpy.mockResolvedValue({
    data: [{ name: "Acme Contact", email: "contact@acme.test" }],
    error: null,
  })
  formSubmissionsUpdateSpy.mockResolvedValue({ data: null, error: null })
  workflowErrorsInsertSpy.mockResolvedValue({ data: null, error: null })
  storageUploadSpy.mockResolvedValue({ data: { path: REPORT_PATH }, error: null })

  // createSignedUrl is called twice in finalizeReport:
  //   1st: 60*60*24*7  (7-day client URL) — must NOT leak to the caller
  //   2nd: 60*5         (5-min Matt URL)  — must surface as result.downloadUrl
  // The order is fixed by the source (line 801 then line 835) and is verified
  // by the test 5 assertion that result.downloadUrl === short URL.
  storageCreateSignedUrlSpy.mockImplementation(async (_path: string, ttl: number) => {
    if (ttl === 60 * 60 * 24 * 7) {
      return { data: { signedUrl: "https://example/long" }, error: null }
    }
    return { data: { signedUrl: "https://example/short" }, error: null }
  })
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("Phase 7 — AI report pipeline contract", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    callLog = []
    applyDefaultStubs()
    vi.stubEnv("OPENROUTER_API_KEY", "test-key-placeholder")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── Test 1: D-06 / REPORT-11 happy path ────────────────────────────────────
  // The draft path produces a draft and flips status to draft_ready_for_review.
  // No email side-effect fires; no workflow_errors row written.

  it("D-06 / REPORT-11: draft path does NOT call dispatchNotification on success", async () => {
    generateObjectSpy.mockResolvedValue({
      object: {
        executiveSummary: "Generated summary.",
        hazards: [],
        complianceStatus: "Pass",
      },
    })

    const { generateReportDraft } = await import("@/app/admin/assessments/actions")
    const result = await generateReportDraft(SUBMISSION_ID)

    expect(result).toEqual({ success: true })

    // The draft path must NEVER trigger a notification dispatch (D-06).
    expect(dispatchNotificationSpy).not.toHaveBeenCalled()

    // No workflow_errors row on the happy path.
    expect(workflowErrorsInsertSpy).not.toHaveBeenCalled()

    // The status flip is to draft_ready_for_review (NOT ai_draft_failed, NOT completed).
    const updateCalls = formSubmissionsUpdateSpy.mock.calls
    expect(updateCalls.length).toBeGreaterThanOrEqual(1)
    const updateArg = updateCalls[0][0] as Record<string, unknown>
    expect(updateArg.status).toBe("draft_ready_for_review")
  })

  // ── Test 2: D-06 / REPORT-11 failure path ──────────────────────────────────
  // Even when the AI throws, the draft path remains email-free. This is the
  // load-bearing cross-check: a future refactor that adds a "draft failed —
  // tell the client" email would be caught here.

  it("D-06 / REPORT-11: draft path does NOT call dispatchNotification on AI failure", async () => {
    generateObjectSpy.mockRejectedValue(new Error("openrouter 500"))

    const { generateReportDraft } = await import("@/app/admin/assessments/actions")

    await expect(generateReportDraft(SUBMISSION_ID)).rejects.toThrow(
      /Failed to generate report draft/
    )

    expect(dispatchNotificationSpy).not.toHaveBeenCalled()
  })

  // ── Test 3: D-10 / D-11 logging ────────────────────────────────────────────
  // An AI failure inserts a workflow_errors row with the canonical shape and
  // BEFORE the status update. The order is what makes the row durable even if
  // the subsequent update later fails.

  it("D-10 / REPORT-12: AI failure inserts workflow_errors{workflow_name:'ai_report_draft', payload.severity:'high'} BEFORE the status update", async () => {
    generateObjectSpy.mockRejectedValue(new Error("openrouter 500"))

    const { generateReportDraft } = await import("@/app/admin/assessments/actions")
    await expect(generateReportDraft(SUBMISSION_ID)).rejects.toThrow(
      /Failed to generate report draft/
    )

    // Shape assertion — the contract from CONTEXT D-10 and migrations/001.
    expect(workflowErrorsInsertSpy).toHaveBeenCalledTimes(1)
    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_name: "ai_report_draft",
        error_message: expect.any(String),
        payload: expect.objectContaining({
          submission_id: SUBMISSION_ID,
          severity: "high",
        }),
      })
    )

    // Order assertion — find the indices of the two relevant entries in the
    // shared call log. The insert must precede the failure-path status update.
    const insertIdx = callLog.findIndex((e) => e.kind === "workflow_errors.insert")
    const failedUpdateIdx = callLog.findIndex(
      (e) =>
        e.kind === "form_submissions.update" &&
        (e.arg as { status?: string }).status === "ai_draft_failed"
    )

    expect(insertIdx).toBeGreaterThan(-1)
    expect(failedUpdateIdx).toBeGreaterThan(-1)
    expect(insertIdx).toBeLessThan(failedUpdateIdx)
  })

  // ── Test 4: D-10 / D-11 status flip ────────────────────────────────────────
  // Confirms the ai_draft_failed transition that the Review page (Plan 06)
  // keys its retry CTA off.

  it("D-10 / REPORT-12: AI failure flips form_submissions.status to 'ai_draft_failed' on the same id", async () => {
    generateObjectSpy.mockRejectedValue(new Error("openrouter 500"))

    const { generateReportDraft } = await import("@/app/admin/assessments/actions")
    await expect(generateReportDraft(SUBMISSION_ID)).rejects.toThrow(
      /Failed to generate report draft/
    )

    // Find the failure-path update among all form_submissions.update calls.
    const updateCalls = formSubmissionsUpdateSpy.mock.calls
    const failedUpdate = updateCalls.find(
      (c) => (c[0] as { status?: string })?.status === "ai_draft_failed"
    )
    expect(failedUpdate).toBeDefined()

    // The .eq filter must scope the update to the same submission id.
    expect(failedUpdate![1]).toBe(SUBMISSION_ID)
  })

  // ── Test 5: D-08 / REPORT-06 dispatch fallback ─────────────────────────────
  // The Approve path: dispatchNotification returning ok:false must NOT roll
  // back the PDF artefact or the status flip. The failure is logged and
  // surfaced via deliveryEmailFailed=true. The 5-min URL (not the 7-day URL)
  // is what reaches the caller — verified by the URL string equality.

  it("D-08 / REPORT-06: dispatch failure logs workflow_errors, keeps status='completed', returns deliveryEmailFailed=true with the 5-min downloadUrl", async () => {
    dispatchNotificationSpy.mockResolvedValue({ ok: false, error: "n8n down" })

    const { finalizeReport } = await import("@/app/admin/assessments/actions")
    const result = await finalizeReport(SUBMISSION_ID, VALID_APPROVED_DRAFT)

    // The PDF was saved and the atomic update committed BEFORE dispatch ran.
    const completedUpdate = formSubmissionsUpdateSpy.mock.calls.find(
      (c) => (c[0] as { status?: string })?.status === "completed"
    )
    expect(completedUpdate).toBeDefined()
    const completedArg = completedUpdate![0] as Record<string, unknown>
    expect(completedArg.status).toBe("completed")
    expect(completedArg.report_storage_path).toBe(REPORT_PATH)
    expect(completedArg.draft_report_json).toEqual(VALID_APPROVED_DRAFT)

    // CRITICAL: status is NOT rolled back to anything else after dispatch fails.
    // Assert no subsequent form_submissions.update overrode 'completed'.
    const completedIdx = callLog.findIndex(
      (e) => e.kind === "form_submissions.update" && (e.arg as { status?: string }).status === "completed"
    )
    const dispatchIdx = callLog.findIndex((e) => e.kind === "dispatchNotification")
    expect(completedIdx).toBeGreaterThan(-1)
    expect(dispatchIdx).toBeGreaterThan(completedIdx) // PDF saved BEFORE dispatch
    const updatesAfterDispatch = callLog
      .slice(dispatchIdx + 1)
      .filter((e) => e.kind === "form_submissions.update")
    expect(updatesAfterDispatch).toHaveLength(0)

    // workflow_errors row written with the report_delivery_email tag.
    expect(workflowErrorsInsertSpy).toHaveBeenCalledTimes(1)
    expect(workflowErrorsInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_name: "report_delivery_email",
        error_message: expect.any(String),
      })
    )

    // Return shape contract for Plan 06's toast.
    expect(result.success).toBe(true)
    expect(result.deliveryEmailFailed).toBe(true)

    // T-07-04-02 cross-check: the 5-min URL is what Matt's browser receives.
    // The 7-day URL exists only inside the n8n payload — never echoed back.
    expect(result.downloadUrl).toBe("https://example/short")

    // Belt-and-braces: confirm two createSignedUrl calls happened, one with
    // each TTL, and the 7-day call came first (D-07 contract ordering).
    const signedUrlEntries = callLog.filter((e) => e.kind === "storage.createSignedUrl")
    expect(signedUrlEntries).toHaveLength(2)
    expect((signedUrlEntries[0] as { ttl: number }).ttl).toBe(60 * 60 * 24 * 7)
    expect((signedUrlEntries[1] as { ttl: number }).ttl).toBe(60 * 5)
  })
})
