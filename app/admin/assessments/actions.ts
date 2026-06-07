"use server"

import { createClient } from "@/lib/supabase/server"
import { adminClient } from "@/lib/supabase/admin"
import { requireAdmin, isAdmin } from "@/lib/auth-helpers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import {
  buildSignatureStoragePath,
  buildPhotoStoragePath,
} from "@/lib/form-builder/storage/upload-paths"
import { expandRepeatingSections } from "@/lib/form-builder/expand-repeating-sections"
import { extractPAS79Summary } from "@/lib/form-builder/risk/pas79"
import { YELLOW_BROOM_EXEMPLAR } from "@/lib/ai/exemplars/yellow-broom-fra"
import { buildReportPrompt } from "@/lib/ai/prompt-builder"
import { dispatchNotification } from "@/lib/notifications/n8n-dispatch"

export async function startAssessment(clientId: string, templateVersionId: string) {
  // Admin-role gate — writes via the service-role adminClient (RLS bypassed),
  // so an authenticated-user check alone lets any client user start an
  // assessment for any org. isAdmin() checks server-trusted admin_users.
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: Admin role required to start assessment")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized: Authentication required to start assessment")
  }
  const userId = user.id

  // 1. Fetch template_id
  const { data: templateVersion, error: tvError } = await adminClient
    .from("template_versions")
    .select("template_id")
    .eq("id", templateVersionId)
    .single()

  if (tvError || !templateVersion) {
    throw new Error("Failed to fetch template version")
  }

  // 2. Insert form_assignment
  const { data: assignment, error: assignError } = await adminClient
    .from("form_assignments")
    .insert({
      client_id: clientId,
      template_id: templateVersion.template_id,
      template_version_id: templateVersionId,
      assigned_by: userId,
      status: "assigned"
    })
    .select()
    .single()

  if (assignError || !assignment) {
    throw new Error(`Failed to create assignment: ${assignError?.message || "Unknown error"}`)
  }

  // 3. Insert form_submission
  const { data: submission, error: submitError } = await adminClient
    .from("form_submissions")
    .insert({
      assignment_id: assignment.id,
      client_id: clientId,
      template_version_id: templateVersionId,
      answers_json: {},
      submitted_by: userId,
      status: "draft"
    })
    .select()
    .single()

  if (submitError || !submission) {
    throw new Error(`Failed to create draft submission: ${submitError?.message || "Unknown error"}`)
  }

  redirect(`/admin/assessments/${submission.id}`)
}

/**
 * Hard-delete a form submission, its parent assignment, and any generated
 * report PDF in storage. Confirmation lives in the UI (AlertDialog on the
 * assessment form header).
 */
export async function deleteAssessment(submissionId: string) {
  // Admin-role gate — every other destructive action in this file at least
  // checks for an authenticated user; this one had nothing (code audit
  // 2026-05-29). Without it, any caller who can invoke this Server Action
  // could hard-delete arbitrary submissions, parent assignments, and storage
  // PDFs. isAdmin() checks server-trusted admin_users, not client-set
  // app_metadata.
  if (!(await isAdmin())) {
    throw new Error("Unauthorized: Admin role required to delete assessment")
  }

  // Fetch the assignment id and storage path first.
  const { data: sub } = await adminClient
    .from("form_submissions")
    .select("assignment_id, report_storage_path, client_id")
    .eq("id", submissionId)
    .maybeSingle()

  if (!sub) {
    // Nothing to delete — treat as success rather than an error so the UI
    // can navigate away without showing a scary toast.
    return { clientId: null as string | null }
  }

  const { error: subDeleteError } = await adminClient
    .from("form_submissions")
    .delete()
    .eq("id", submissionId)

  if (subDeleteError) {
    console.error("Error deleting submission:", subDeleteError)
    throw new Error(subDeleteError.message)
  }

  if (sub.assignment_id) {
    const { error: assignDeleteError } = await adminClient
      .from("form_assignments")
      .delete()
      .eq("id", sub.assignment_id)
    if (assignDeleteError) {
      // Non-fatal — submission is already gone, assignment is just dangling.
      console.error("Failed to delete parent form_assignment:", assignDeleteError)
    }
  }

  if (sub.report_storage_path) {
    const { error: rmError } = await adminClient.storage
      .from("reports")
      .remove([sub.report_storage_path])
    if (rmError) {
      console.error("Failed to remove assessment PDF from storage:", rmError)
    }
  }

  revalidatePath("/admin/review-queue")
  revalidatePath("/admin")
  if (sub.client_id) {
    revalidatePath(`/admin/clients/${sub.client_id}`)
  }

  return { clientId: sub.client_id ?? null }
}

export async function autosaveAnswers(submissionId: string, answersJson: Record<string, unknown>) {
  // Admin-role gate — writes via the service-role adminClient (RLS bypassed).
  // An authenticated-user check alone lets any client user autosave into any
  // admin draft. requireAdmin() enforces admin_users membership (and stays
  // demo-compatible: returns null actor in the dev/preview demo flow).
  await requireAdmin()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized: Authentication required for autosave")
  }

  // Write via adminClient (service-role) so RLS can't silently null out the
  // update when the admin's JWT lacks `app_metadata.role = 'admin'`. The
  // `submitted_by` filter keeps the defense-in-depth that only the admin who
  // started the draft can edit it. `.select("id")` lets us verify the row
  // actually matched — without it, a stale id or status mismatch would still
  // silently succeed.
  const { data: rows, error } = await adminClient
    .from("form_submissions")
    .update({ answers_json: answersJson })
    .eq("id", submissionId)
    .eq("status", "draft")
    .eq("submitted_by", user.id)
    .select("id")

  if (error) {
    throw new Error(`Failed to autosave: ${error.message}`)
  }
  if (!rows || rows.length === 0) {
    throw new Error(
      "Autosave matched zero rows — submission may have been submitted, deleted, or belongs to a different user."
    )
  }
}

// Legacy `submitAssessment` removed 2026-05-29 — superseded by the validated
// `submitAssessmentAction` below. Last caller was retired with the
// form-interpreter migration; the legacy function had no remaining import
// across app/ or components/, and shipping both risked duplicate
// assessment-submission-webhook fires for the same submissionId.

/**
 * Submit a form assessment with server-side validation.
 *
 * Security contract (T-13-09, T-13-10, T-13-11):
 * 1. Admin gate: requireAdmin — non-admin (and unauthenticated) callers are rejected.
 * 2. Pinned version: schema is fetched from template_versions using the
 *    submission's own template_version_id FK — the client cannot supply a
 *    different (weaker) version.
 * 3. Server-side validation: validateEntitiesValues runs against the pinned
 *    schema. If it fails, no DB write happens.
 * 4. audit trail: status=submitted + submitted_at written atomically with answers_json.
 *
 * @param submissionId - The UUID of the form_submissions row to submit.
 * @param rawValues - The raw entity values from the client interpreter store.
 */
export async function submitAssessmentAction(
  submissionId: string,
  rawValues: unknown
): Promise<void> {
  // T-13-11: admin-role gate before any read/write. requireAdmin() enforces
  // admin_users membership (real-prod) while staying demo-compatible — it
  // returns a null actor in the dev/preview demo flow, same as the previous
  // requireActorUserId("admin") which only checked for *any* authenticated user.
  const userId = await requireAdmin()

  // Step 1: fetch submission row to read the pinned template_version_id
  const { data: submission, error: subError } = await adminClient
    .from("form_submissions")
    .select("template_version_id")
    .eq("id", submissionId)
    .single()

  if (subError || !submission) {
    throw new Error(`Failed to fetch submission: ${subError?.message ?? "not found"}`)
  }

  // Step 2: fetch the PINNED version schema — never the template's latest version
  // T-13-10: the server selects the version via the stored FK; the client cannot
  // supply a different version ID.
  const { data: version, error: versionError } = await adminClient
    .from("template_versions")
    .select("schema_json")
    .eq("id", submission.template_version_id)
    .single()

  if (versionError || !version) {
    throw new Error(`Failed to fetch pinned template version: ${versionError?.message ?? "not found"}`)
  }

  // Step 3: server-side validation — T-13-09
  const { validateEntitiesValues } = await import("@coltorapps/builder")
  const { formBuilder } = await import("@/lib/form-builder")
  const { sanitizeSchema } = await import("@/lib/form-builder/sanitize-schema")
  const { pruneSchemaForValidation } = await import("@/lib/form-builder/prune-schema-for-validation")
  const { setCurrentFormSchema } = await import("@/lib/form-builder/visibility/compute-computed-values")

  // The pinned schema_json can contain since-removed entity types (e.g. the
  // seeded FRA's signatureField, deregistered 2026-06-04). The client renders
  // AND validates against the sanitized schema (interpreter-renderer.tsx), but
  // feeding the raw schema into coltorapps here throws
  // `Unkown entity type "signatureField"` (typo is upstream) and crashes the
  // whole submit. Sanitize once and use it for every consumer below so the
  // server validates exactly what the client validated.
  const schemaJson = sanitizeSchema(version.schema_json as Parameters<typeof sanitizeSchema>[0])

  // coltorapps walks entity.children recursively and validates each at the root level,
  // but repeatingSection child values live nested inside instances[] — so any static
  // `required: true` on a template child would always fail at the root. Prune to stop
  // the walk at repeatingSection; the section's own validator still enforces the
  // { instances } shape and min/max counts.
  const prunedSchema = pruneSchemaForValidation(schemaJson)

  // Register the schema in the module-level slot so makeShouldBeProcessed's
  // augmentation path can derive computedField values (D-02) during the
  // coltorapps eligibility walk. Without this, the walker would see every
  // computedField-sourced rule evaluate against `undefined` and silently
  // delete the dependent entity's value from the validated `result.data` —
  // which is then iterated by stripHiddenAnswers, so the value would never
  // reach `answers_json`. The corresponding cleanup is in the finally below.
  // TODO: under concurrent server actions this slot is racy; the low-traffic
  // admin context makes that acceptable for now. A future hardening could
  // use AsyncLocalStorage or thread the schema through the walker directly.
  setCurrentFormSchema(schemaJson as Parameters<typeof setCurrentFormSchema>[0])
  let result: Awaited<ReturnType<typeof validateEntitiesValues>>
  try {
    result = await validateEntitiesValues(rawValues, formBuilder, prunedSchema as Parameters<typeof validateEntitiesValues>[2])
  } finally {
    setCurrentFormSchema(null)
  }
  if (!result.success) {
    throw new Error("Form validation failed server-side. Please check your answers and try again.")
  }

  // Per-instance required enforcement — mirrors the client guard in interpreter-renderer.tsx.
  const { validateInstanceRequired } = await import("@/lib/form-builder/validate-instance-required")
  const instanceFailures = validateInstanceRequired(
    schemaJson as Parameters<typeof validateInstanceRequired>[0],
    result.data as Record<string, unknown>
  )
  if (instanceFailures.length > 0) {
    const first = instanceFailures[0]
    throw new Error(
      `Missing required field "${first.childLabel}" in ${first.repSectionLabel} #${first.instanceIndex + 1}` +
        (instanceFailures.length > 1 ? ` (and ${instanceFailures.length - 1} more)` : "")
    )
  }

  // Step 3.5: Phase 15 — server-side visibility evaluation + hidden-subtree scrub (D-01, COND-01).
  // Order is load-bearing: validate FIRST (coerced types feed operator semantics correctly),
  // THEN evaluate visibility against the validated values, THEN strip hidden entities.
  // runReportDraftGeneration in the after() callback reads answers_json post-write — it
  // automatically benefits from the scrub without any change to the AI path (CONTEXT §deferred).
  // evaluateVisibility receives the schema explicitly so it does NOT depend on the
  // module-level slot (cleared above).
  const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility")
  const { stripHiddenAnswers } = await import("@/lib/form-builder/visibility/strip-hidden-answers")
  const visibility = evaluateVisibility(schemaJson as Parameters<typeof evaluateVisibility>[0], result.data as Record<string, unknown>)
  const scrubbedAnswers = stripHiddenAnswers(schemaJson as Parameters<typeof stripHiddenAnswers>[0], result.data as Record<string, unknown>, visibility)

  // Step 4: write validated data — T-13-13 (audit trail); uses SCRUBBED answers (D-01).
  // submitted_by ownership filter matches the legacy submitAssessment + autosaveAnswers
  // pattern — defence-in-depth that only the admin who started the draft can submit it.
  // userId may be null in demo mode (see lib/auth-helpers.ts requireActorUserId), in
  // which case the original draft was also written with submitted_by=null and the
  // ownership check is skipped to keep the demo flow working. .select("id") guards
  // against silent no-ops when the row was already submitted or doesn't match.
  let updateQuery = adminClient
    .from("form_submissions")
    .update({
      answers_json: scrubbedAnswers,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "draft")
  if (userId !== null) {
    updateQuery = updateQuery.eq("submitted_by", userId)
  }
  const { data: updatedRows, error: updateError } = await updateQuery.select("id")

  if (updateError) {
    throw new Error(`Failed to submit assessment: ${updateError.message}`)
  }
  if (!updatedRows || updatedRows.length === 0) {
    throw new Error(
      "Submit matched zero rows — submission may have been submitted, deleted, or belongs to a different user."
    )
  }

  // Auto-generate the AI draft after the response is sent. Runs in the
  // background on Vercel via Fluid Compute — Matt's submit redirect stays
  // fast (no AI wait), and the draft is usually ready by the time he opens
  // /admin/assessments/[id]/review. On failure, the manual "Generate AI
  // Draft" button on the review page is the retry surface.
  after(async () => {
    try {
      await runReportDraftGeneration(submissionId)
    } catch (err) {
      // runReportDraftGeneration itself logs to workflow_errors and flips
      // status='ai_draft_failed' before rethrowing (D-10). But if it threw
      // BEFORE that point (e.g., the status-flip update itself failed), the
      // submission would be stuck at 'submitted' and the Review page would
      // show "Generate AI Draft" instead of "Retry Draft" — misleading
      // because auto-generation did run and fail. Best-effort flip here
      // closes that window. Code audit 2026-05-29 (M2).
      console.error("Auto report-draft generation failed", { submissionId, err })
      try {
        await adminClient
          .from("form_submissions")
          .update({ status: "ai_draft_failed" })
          .eq("id", submissionId)
          .eq("status", "submitted")
      } catch (flipErr) {
        console.error("Fallback status flip to ai_draft_failed also failed", { submissionId, flipErr })
      }
    }
  })

  // Phase 18 SC#5 — fire the assessment-submission n8n webhook for the
  // Module 1 downstream (Matt's existing n8n workflows that fan out to
  // Proton Mail / customer notifications / Drive backups). The legacy
  // submitAssessment was removed 2026-05-29 (code audit M4); this is now
  // the only webhook-firing path. Distinct from the AI-draft pipeline in
  // the after() callback above — both are post-response background tasks;
  // neither blocks Matt's submit redirect.
  // Inline (not extracted to lib/notifications/n8n-dispatch.ts) per
  // RESEARCH §Q5: that helper's typed union targets a DIFFERENT n8n URL
  // (N8N_WEBHOOK_URL → Proton Mail routing); the assessment webhook
  // targets N8N_ASSESSMENT_WEBHOOK_URL which is a separate workflow.
  after(async () => {
    const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL
    if (!webhookUrl) return
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
        signal: AbortSignal.timeout(3000),
      })
    } catch (err) {
      console.error("Phase 18 SC#5 n8n webhook trigger failed", { submissionId, err })
      await adminClient.from("workflow_errors").insert({
        workflow_name: "assessment-submission-webhook",
        error_message: String(err),
        payload: { submissionId },
      })
    }
  })
}

// ── runReportDraftGeneration ─────────────────────────────────────────────────

/**
 * Core AI-draft generation — no auth check, caller is responsible.
 * Used by both the manual generateReportDraft Server Action and the
 * auto-trigger inside submitAssessmentAction's after() callback.
 */
async function runReportDraftGeneration(submissionId: string) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (dev) or Vercel project env (prod) before generating report drafts."
    )
  }

  // Step 1: Fetch form_submissions row — also fetch template_version_id
  // so we can load the pinned schema for repeatingSection expansion.
  const { data: submission, error: fetchError } = await adminClient
    .from("form_submissions")
    .select("answers_json, template_version_id")
    .eq("id", submissionId)
    .single()

  if (fetchError || !submission) {
    throw new Error("Submission not found or fetch failed")
  }

  // Step 2: Fetch the PINNED version schema (same two-step pattern as
  // submitAssessmentAction — NEVER a FK join; Phase 13 RESEARCH Pitfall 2).
  const { data: version, error: versionError } = await adminClient
    .from("template_versions")
    .select("schema_json")
    .eq("id", submission.template_version_id)
    .single()

  if (versionError || !version) {
    throw new Error(
      `Failed to fetch pinned template version for AI prompt: ${versionError?.message ?? "not found"}`
    )
  }

  // Step 3: Expand repeatingSection instances into labelled flat objects per
  // RESEARCH Pattern 10. The AI sees one labelled object per door / hazard,
  // not an opaque nested "instances" array.
  // CONTEXT §specifics: FRA-doors test scenario expects N instances →
  // N hazards in the generated draft.
  const expandedAnswers = expandRepeatingSections(
    version.schema_json as Parameters<typeof expandRepeatingSections>[0],
    submission.answers_json as Record<string, unknown>
  )

  // Step 3b: Recompute the PAS 79 risk rating from the PINNED schema + raw
  // answers. The on-screen renderer computes this badge but deliberately never
  // persists it (computed-field-renderer.tsx ~128-133), so answers_json carries
  // the likelihood/consequence inputs but not the derived level. We recompute
  // here — NOT from expandedAnswers (which relabels repeatingSection children),
  // but from the raw answers_json the renderer/visibility engine also read, so
  // the dependency entity IDs resolve. Returns null when there is no PAS 79
  // field or its inputs are missing/out of range — buildReportPrompt then omits
  // the line entirely (no "undefined" in the prompt).
  const pas79Summary = extractPAS79Summary(
    version.schema_json as Parameters<typeof extractPAS79Summary>[0],
    submission.answers_json as Record<string, unknown>
  )

  // Step 4: Initialize createOpenAI
  const openai = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  })

  // Step 5: Define the Zod schema (unchanged — only the prompt input changes)
  const reportSchema = z.object({
    executiveSummary: z.string(),
    hazards: z.array(z.object({
      location: z.string(),
      description: z.string(),
      severity: z.enum(["Low", "Medium", "High", "Critical"]),
      recommendedAction: z.string(),
    })),
    complianceStatus: z.enum(["Pass", "Action Required", "Fail"]),
  })

  // Step 6: Call generateObject with expanded answers
  try {
    const { object } = await generateObject({
      model: openai('openai/gpt-4o-mini'),
      schema: reportSchema,
      prompt: buildReportPrompt({
        exemplar: YELLOW_BROOM_EXEMPLAR,
        exemplarLabel: "YELLOW BROOM 2023 FRA, anonymised",
        expandedAnswers,
        pas79: pas79Summary
          ? {
              likelihood: pas79Summary.likelihood,
              consequence: pas79Summary.consequence,
              level: pas79Summary.result.level,
            }
          : null,
      }),
    })

    // Step 7: Update draft_report_json and status
    const { error: updateError } = await adminClient
      .from("form_submissions")
      .update({
        draft_report_json: object,
        status: "draft_ready_for_review"
      })
      .eq("id", submissionId)

    if (updateError) {
      throw new Error(`Failed to update draft report: ${updateError.message}`)
    }

    // Step 8: Revalidate paths
    revalidatePath("/admin/assessments")
    revalidatePath(`/admin/assessments/${submissionId}/review`)

    // Return the generated draft so the client can update its local state
    // immediately — router.refresh() alone won't re-seed the review page's
    // useState(draft), so without this the regenerated draft only appears
    // after a full manual reload.
    return { success: true, draft: object }
  } catch (err: unknown) {
    console.error("generateReportDraft failed:", err)
    const errMessage = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : null

    // D-10: log to workflow_errors BEFORE flipping status / rethrowing.
    // adminClient (service-role) bypasses RLS so the insert succeeds even when
    // the caller is the after-submit background task (no admin JWT in scope).
    // Schema (migrations/001:188-196): workflow_name + error_message + payload
    // are the only input columns — there is NO top-level `workflow_type` or
    // `severity` column; severity nests under payload (PATTERNS.md correction #1).
    await adminClient.from("workflow_errors").insert({
      workflow_name: "ai_report_draft",
      error_message: errMessage,
      payload: {
        submission_id: submissionId,
        stack: errStack,
        severity: "high",
      },
    })

    // D-10: flip status so the Review page can render the retry CTA (Plan 06)
    // instead of the generic "no draft yet" empty-state. Order: workflow_errors
    // insert FIRST so the audit row exists even if this update later fails.
    await adminClient
      .from("form_submissions")
      .update({ status: "ai_draft_failed" })
      .eq("id", submissionId)

    revalidatePath(`/admin/assessments/${submissionId}/review`)

    // Preserve the existing error-message shape used by the manual Server Action
    // wrapper at generateReportDraft (line ~503).
    throw new Error(`Failed to generate report draft via AI: ${errMessage}`)
  }
}

/**
 * Manual AI-draft generation — the retry path from the /review page when
 * the auto-trigger inside submitAssessmentAction failed or the draft is
 * missing for any reason.
 */
export async function generateReportDraft(submissionId: string) {
  // Admin-role gate — runReportDraftGeneration writes via the service-role
  // adminClient and spends an LLM call; an authenticated-user check alone lets
  // any client user burn AI quota / overwrite admin drafts. requireAdmin()
  // enforces admin_users membership and stays demo-compatible.
  await requireAdmin()

  return runReportDraftGeneration(submissionId)
}


// ── uploadMediaAction ────────────────────────────────────────────────────────

/**
 * Upload a signature or photo file to the form-media Supabase Storage bucket
 * and write an audit row to the field_media table.
 *
 * Security contract (D-15, D-16, D-17):
 * - T-14-03-01: requireActorUserId("admin") is the FIRST statement — carries
 *   forward Phase 13 T-13-11. Non-admin callers are rejected before any I/O.
 * - T-14-03-02: MIME whitelist — only image/png, image/jpeg, image/webp
 *   accepted. SVG explicitly excluded (can carry JS via foreignObject/script).
 * - T-14-03-03: Size caps — signature ≤ 500KB, photo ≤ 2MB. Server-side
 *   buffer check is the second defence after client-side compression.
 * - T-14-03-04: The path prefix {clientId}/... comes from the RSC context
 *   (not from raw user input beyond non-empty validation). Phase 16 RLS
 *   will harden this further for client-surface uploads.
 * - T-14-03-05: field_media row insert records the audit trail; accepted risk.
 *
 * Storage path contracts:
 * - D-16 (signature): {clientId}/signatures/{submissionId}/{fieldId}.png
 *   → upsert: true (re-sign overwrites; one signature per field)
 * - D-17 (photo): {clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}
 *   → upsert: false (UUID guarantees no collision)
 *
 * @param submissionId - UUID of the form_submissions row
 * @param fieldId      - The coltorapps entity ID for this field
 * @param fileDataUrl  - Base64 data URL (e.g. from canvas.toDataURL())
 * @param mediaType    - "image" (audio reserved for future phases)
 * @param clientId     - UUID of the client org (from RSC-fetched submission)
 * @param kind         - "signature" (D-16 path) | "photo" (D-17 path)
 * @returns The storage path string (for the renderer to store in entity.value)
 */
export async function uploadMediaAction(
  submissionId: string,
  fieldId: string,
  fileDataUrl: string,
  mediaType: "image" | "audio",
  clientId: string,
  kind: "signature" | "photo"
): Promise<string> {
  // Step 1: T-14-03-01 — admin-role gate, FIRST line; carry-forward of T-13-11.
  // requireAdmin() enforces admin_users membership (real-prod) while staying
  // demo-compatible, upgrading the previous requireActorUserId("admin") which
  // only required *any* authenticated user.
  await requireAdmin()

  // Step 2: Validate non-empty inputs BEFORE revealing any path structure
  if (!clientId) throw new Error("uploadMediaAction: clientId is required")
  if (!submissionId) throw new Error("uploadMediaAction: submissionId is required")
  if (!fieldId) throw new Error("uploadMediaAction: fieldId is required")

  // Step 3: Parse the data URL header and enforce MIME whitelist (T-14-03-02)
  // Format: data:<mime>;base64,<data>
  const dataUrlMatch = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!dataUrlMatch) {
    throw new Error("uploadMediaAction: invalid data URL format")
  }
  const mime = dataUrlMatch[1]
  const base64Data = dataUrlMatch[2]

  const ALLOWED_MIMES = ["image/png", "image/jpeg", "image/webp"] as const
  if (!ALLOWED_MIMES.includes(mime as (typeof ALLOWED_MIMES)[number])) {
    throw new Error(
      `Unsupported MIME type: ${mime}. Only image/png, image/jpeg, image/webp are accepted.`
    )
  }

  // audio mediaType is reserved for future phases (e.g. audio/webm STT capture)
  if (mediaType === "audio") {
    throw new Error("audio MIME not yet supported in Phase 14")
  }

  // Step 4: Signatures must be PNG (canvas.toDataURL() always produces PNG — D-16)
  if (kind === "signature" && mime !== "image/png") {
    throw new Error(
      "Signatures must be PNG. Use canvas.toDataURL('image/png') in the renderer."
    )
  }

  // Step 5: Convert base64 → Buffer
  const buffer = Buffer.from(base64Data, "base64")

  // Step 6: Enforce size caps (T-14-03-03)
  if (kind === "signature" && buffer.byteLength > 500_000) {
    throw new Error(
      `Signature too large (max 500KB). Got ${Math.round(buffer.byteLength / 1024)}KB.`
    )
  }
  if (kind === "photo" && buffer.byteLength > 2_000_000) {
    throw new Error(
      `Photo too large (max 2MB). Got ${Math.round(buffer.byteLength / 1024 / 1024 * 10) / 10}MB.`
    )
  }

  // Step 7: Derive extension from MIME
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
  }
  const ext = extMap[mime] as "png" | "jpg" | "webp"

  // Step 8: Compose storage path via Plan 14-01 helpers (D-16 / D-17)
  let storagePath: string
  if (kind === "signature") {
    // D-16: {clientId}/signatures/{submissionId}/{fieldId}.png
    storagePath = buildSignatureStoragePath({ clientId, submissionId, fieldId })
  } else {
    // D-17: {clientId}/photos/{submissionId}/{fieldId}/{uuid}.{ext}
    storagePath = buildPhotoStoragePath({
      clientId,
      submissionId,
      fieldId,
      uuid: crypto.randomUUID(),
      ext: ext as "jpg" | "jpeg" | "png" | "webp",
    })
  }

  // Step 9: Upload to form-media bucket via adminClient (service-role bypasses RLS)
  // upsert: true for signatures (re-sign overwrites); false for photos (UUID path)
  const { error: uploadError } = await adminClient.storage
    .from("form-media")
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: kind === "signature",
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  // Step 10: Write field_media audit row (FOUND-07)
  // Do NOT proceed past upload failure (guard above ensures this).
  // An insert failure here is an audit-row gap — log + throw so the renderer
  // surfaces it. The user can retry; idempotent for signatures (upsert path),
  // and UUID-safe for photos.
  const { error: insertError } = await adminClient
    .from("field_media")
    .insert({
      submission_id: submissionId,
      field_id: fieldId,
      storage_path: storagePath,
      media_type: mediaType,
    })

  if (insertError) {
    console.error("field_media insert failed after successful storage upload", {
      submissionId,
      fieldId,
      storagePath,
      error: insertError,
    })
    throw new Error(`field_media insert failed: ${insertError.message}`)
  }

  // Step 11: Return path so the renderer can store it in entity.value
  return storagePath
}

// ── finalizeReport ───────────────────────────────────────────────────────────

export async function finalizeReport(
  submissionId: string,
  approvedDraft: {
    executiveSummary: string
    hazards: { location: string; description: string; severity: "Low" | "Medium" | "High" | "Critical"; recommendedAction: string }[]
    complianceStatus: "Pass" | "Action Required" | "Fail"
  }
) {
  // Admin-role gate — finalizeReport mints client-facing signed report URLs,
  // generates/uploads the PDF, and fires n8n delivery via the service-role
  // adminClient. An authenticated-user check alone lets any client user trigger
  // report delivery for any submission. requireAdmin() enforces admin_users
  // membership and stays demo-compatible.
  await requireAdmin()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized: Authentication required to finalize report")
  }

  // 1. Fetch submission + client details
  const { data: submission, error: fetchError } = await adminClient
    .from("form_submissions")
    .select("id, client_id, created_at, client:clients(name, site_address)")
    .eq("id", submissionId)
    .single()

  if (fetchError || !submission) {
    throw new Error("Submission not found")
  }

  // 1b. Resolve client-facing contact email (D-07 — copies cron/expiry pattern).
  // If missing, do NOT throw — the PDF is still produced and the dispatch arm
  // will record the failure via workflow_errors below.
  const { data: clientUsers } = await adminClient
    .from("client_users")
    .select("name, email")
    .eq("client_id", submission.client_id)
    .limit(1)
  const contact = clientUsers?.[0]
  const contactEmail = contact?.email

  const client = submission.client as { name?: string; site_address?: string } | null
  const assessmentDate = new Date(submission.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // 2. Generate PDF buffer
  const { generateReportPdfBuffer } = await import("@/lib/pdf/generator")

  const pdfBuffer = await generateReportPdfBuffer({
    clientName: client?.name || "Unknown Client",
    siteAddress: client?.site_address || "",
    assessmentDate,
    executiveSummary: approvedDraft.executiveSummary,
    hazards: approvedDraft.hazards,
    complianceStatus: approvedDraft.complianceStatus,
  })

  // 3. Upload to Supabase Storage (reports bucket)
  const fileName = `${submission.client_id}/report_${submissionId}.pdf`

  const { error: uploadError } = await adminClient
    .storage
    .from("reports")
    .upload(fileName, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Failed to upload report PDF: ${uploadError.message}`)
  }

  // 4. Update submission: store path, update draft_report_json with approved content, mark Completed
  const { error: updateError } = await adminClient
    .from("form_submissions")
    .update({
      draft_report_json: approvedDraft,
      report_storage_path: fileName,
      status: "completed",
    })
    .eq("id", submissionId)

  if (updateError) {
    throw new Error(`Failed to update submission after PDF generation: ${updateError.message}`)
  }

  revalidatePath("/admin/review-queue")
  revalidatePath(`/admin/assessments/${submissionId}/review`)

  // 5. D-07 — mint a 7-day client-facing signed URL (separate from Matt's 5-min URL).
  // This URL is ONLY ever placed inside the n8n payload; it must NOT be returned
  // to the React client component (T-07-04-02 — keeps the long-lived URL out of
  // Matt's browser context).
  const { data: clientSigned } = await adminClient
    .storage
    .from("reports")
    .createSignedUrl(fileName, 60 * 60 * 24 * 7)

  // 6. D-07 — dispatch report_ready to n8n with the 7-day URL + en-GB-formatted
  // assessmentDate (reuses the value computed above so the email date matches
  // the PDF header).
  const payload = {
    type: "report_ready" as const,
    client_email: contactEmail ?? "",
    client_name: client?.name ?? "there",
    report_url: clientSigned?.signedUrl ?? "",
    assessment_date: assessmentDate,
    report_storage_path: fileName,
  }

  // 7. D-08 — dispatch failure does NOT roll back the PDF / status flip.
  // Insert a workflow_errors row (workflow_name='report_delivery_email') and
  // surface deliveryEmailFailed=true so review-client.tsx can render the
  // non-blocking toast (Plan 06 wires that).
  const dispatchResult = await dispatchNotification(payload)
  let deliveryEmailFailed = false
  if (!dispatchResult.ok) {
    deliveryEmailFailed = true
    await adminClient.from("workflow_errors").insert({
      workflow_name: "report_delivery_email",
      error_message: dispatchResult.error ?? "unknown dispatch failure",
      payload: { ...payload, severity: "high" },
    })
    // do NOT throw — PDF is the artefact of record (D-08)
  }

  // 8. Return a signed URL for Matt's immediate download (D-05 — 5-min TTL).
  const { data: signedUrlData } = await adminClient
    .storage
    .from("reports")
    .createSignedUrl(fileName, 60 * 5) // 5 minute link

  return { success: true, downloadUrl: signedUrlData?.signedUrl ?? null, deliveryEmailFailed }
}
