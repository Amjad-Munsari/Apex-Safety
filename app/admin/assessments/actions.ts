"use server"

import { createClient } from "@/lib/supabase/server"
import { adminClient } from "@/lib/supabase/admin"
import { requireActorUserId } from "@/lib/auth-helpers"
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

export async function startAssessment(clientId: string, templateVersionId: string) {
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
  // Auth gate via SSR client so unauthenticated callers can't trigger writes.
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

export async function submitAssessment(submissionId: string, finalAnswers: Record<string, unknown>) {
  // Auth gate via SSR client; the write itself goes through adminClient so RLS
  // can't silently zero-row the update when the admin JWT lacks the role claim.
  // See autosaveAnswers above for the same pattern and rationale.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized: Authentication required for submission")
  }

  const { data: submission, error } = await adminClient
    .from("form_submissions")
    .update({
      answers_json: finalAnswers,
      status: "submitted",
      submitted_at: new Date().toISOString()
    })
    .eq("id", submissionId)
    .eq("submitted_by", user.id) // Ensure user owns the submission
    .select("client_id")
    .single()

  if (error || !submission) {
    throw new Error(`Failed to submit: ${error?.message || "Ownership verification failed"}`)
  }

  // Fire and forget webhook
  const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
        signal: AbortSignal.timeout(3000)
      })
    } catch (err) {
      console.error("Webhook trigger failed", err)
      // Log error to workflow_errors
      await adminClient.from("workflow_errors").insert({
        workflow_name: "assessment-submission-webhook",
        error_message: String(err),
        payload: { submissionId }
      })
    }
  }

  return { clientId: submission.client_id }
}

/**
 * Submit a form assessment with server-side validation.
 *
 * Security contract (T-13-09, T-13-10, T-13-11):
 * 1. Auth gate: requireActorUserId — unauthenticated callers are rejected.
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
  // T-13-11: auth gate before any read/write
  const userId = await requireActorUserId("admin")

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
  const { pruneSchemaForValidation } = await import("@/lib/form-builder/prune-schema-for-validation")

  // coltorapps walks entity.children recursively and validates each at the root level,
  // but repeatingSection child values live nested inside instances[] — so any static
  // `required: true` on a template child would always fail at the root. Prune to stop
  // the walk at repeatingSection; the section's own validator still enforces the
  // { instances } shape and min/max counts.
  const prunedSchema = pruneSchemaForValidation(version.schema_json as Parameters<typeof pruneSchemaForValidation>[0])
  const result = await validateEntitiesValues(rawValues, formBuilder, prunedSchema as Parameters<typeof validateEntitiesValues>[2])
  if (!result.success) {
    throw new Error("Form validation failed server-side. Please check your answers and try again.")
  }

  // Per-instance required enforcement — mirrors the client guard in interpreter-renderer.tsx.
  const { validateInstanceRequired } = await import("@/lib/form-builder/validate-instance-required")
  const instanceFailures = validateInstanceRequired(
    version.schema_json as Parameters<typeof validateInstanceRequired>[0],
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
  const { evaluateVisibility } = await import("@/lib/form-builder/visibility/evaluate-visibility")
  const { stripHiddenAnswers } = await import("@/lib/form-builder/visibility/strip-hidden-answers")
  const visibility = evaluateVisibility(version.schema_json as Parameters<typeof evaluateVisibility>[0], result.data as Record<string, unknown>)
  const scrubbedAnswers = stripHiddenAnswers(version.schema_json as Parameters<typeof stripHiddenAnswers>[0], result.data as Record<string, unknown>, visibility)

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
      console.error("Auto report-draft generation failed", { submissionId, err })
    }
  })

  // Phase 18 SC#5 — fire the assessment-submission n8n webhook for the
  // Module 1 downstream (Matt's existing n8n workflows that fan out to
  // Proton Mail / customer notifications / Drive backups). Mirrored from
  // the legacy submitAssessment (actions.ts:194-212). Distinct from the
  // AI-draft pipeline in the after() callback above — both are
  // post-response background tasks; neither blocks Matt's submit redirect.
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
      prompt: `Act as a Fire Risk Assessor. Draft a professional report based on the following raw assessment answers:\n\n${JSON.stringify(expandedAnswers, null, 2)}\n\nDo NOT invent any hazards that are not explicitly stated in the input data. Summarize appropriately.`,
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

    return { success: true }
  } catch (err: any) {
    console.error("generateReportDraft failed:", err)
    throw new Error(`Failed to generate report draft via AI: ${err.message || String(err)}`)
  }
}

/**
 * Manual AI-draft generation — the retry path from the /review page when
 * the auto-trigger inside submitAssessmentAction failed or the draft is
 * missing for any reason.
 */
export async function generateReportDraft(submissionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Unauthorized: Authentication required to generate draft")
  }

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
  // Step 1: T-14-03-01 — auth gate, FIRST line; carry-forward of T-13-11
  await requireActorUserId("admin")

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

  const client = submission.client as any
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

  // 5. Return a signed URL for immediate download
  const { data: signedUrlData } = await adminClient
    .storage
    .from("reports")
    .createSignedUrl(fileName, 60 * 5) // 5 minute link

  return { success: true, downloadUrl: signedUrlData?.signedUrl ?? null }
}
