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
  await requireActorUserId("admin")

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

  const result = await validateEntitiesValues(rawValues, formBuilder, version.schema_json)
  if (!result.success) {
    throw new Error("Form validation failed server-side. Please check your answers and try again.")
  }

  // Step 4: write validated data — T-13-13 (audit trail)
  const { error: updateError } = await adminClient
    .from("form_submissions")
    .update({
      answers_json: result.data,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "draft")

  if (updateError) {
    throw new Error(`Failed to submit assessment: ${updateError.message}`)
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
}

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

  // 1. Fetch form_submissions row
  const { data: submission, error: fetchError } = await adminClient
    .from("form_submissions")
    .select("answers_json")
    .eq("id", submissionId)
    .single()

  if (fetchError || !submission) {
    throw new Error("Submission not found or fetch failed")
  }

  // 2. Initialize createOpenAI
  const openai = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  })

  // 3. Define the Zod schema
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

  // 4. Call generateObject
  try {
    const { object } = await generateObject({
      model: openai('openai/gpt-4o-mini'),
      schema: reportSchema,
      prompt: `Act as a Fire Risk Assessor. Draft a professional report based on the following raw assessment answers:\n\n${JSON.stringify(submission.answers_json, null, 2)}\n\nDo NOT invent any hazards that are not explicitly stated in the input data. Summarize appropriately.`,
    })

    // 5. Update draft_report_json and status
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

    // 6. Call revalidatePath
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
