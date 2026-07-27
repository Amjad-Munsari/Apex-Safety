import "server-only"

import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { after } from "next/server"

import { YELLOW_BROOM_EXEMPLAR } from "@/lib/ai/exemplars/yellow-broom-fra"
import { buildReportPrompt } from "@/lib/ai/prompt-builder"
import { expandRepeatingSections } from "@/lib/form-builder/expand-repeating-sections"
import { extractPAS79Summary } from "@/lib/form-builder/risk/pas79"
import { adminClient } from "@/lib/supabase/admin"
import { logAppError } from "@/lib/observability/log"

/**
 * Generate and persist the AI report draft for a committed submission.
 *
 * This lives in a server-only module rather than a "use server" action file:
 * client and admin submission actions both need it, but it must never become a
 * directly callable Server Action without its own authorization check.
 */
export async function runReportDraftGeneration(submissionId: string) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (dev) or Vercel project env (prod) before generating report drafts."
    )
  }

  const { data: submission, error: fetchError } = await adminClient
    .from("form_submissions")
    .select("answers_json, template_version_id")
    .eq("id", submissionId)
    .single()

  if (fetchError || !submission) {
    throw new Error("Submission not found or fetch failed")
  }

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

  const expandedAnswers = expandRepeatingSections(
    version.schema_json as Parameters<typeof expandRepeatingSections>[0],
    submission.answers_json as Record<string, unknown>
  )
  const pas79Summary = extractPAS79Summary(
    version.schema_json as Parameters<typeof extractPAS79Summary>[0],
    submission.answers_json as Record<string, unknown>
  )

  const openai = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  })

  const reportSchema = z.object({
    executiveSummary: z.string(),
    hazards: z.array(
      z.object({
        location: z.string(),
        description: z.string(),
        severity: z.enum(["Low", "Medium", "High", "Critical"]),
        recommendedAction: z.string(),
      })
    ),
    complianceStatus: z.enum(["Pass", "Action Required", "Fail"]),
  })

  try {
    const { object } = await generateObject({
      model: openai("openai/gpt-4o-mini"),
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

    const { error: updateError } = await adminClient
      .from("form_submissions")
      .update({
        draft_report_json: object,
        status: "draft_ready_for_review",
      })
      .eq("id", submissionId)

    if (updateError) {
      throw new Error(`Failed to update draft report: ${updateError.message}`)
    }

    revalidatePath("/admin/assessments")
    revalidatePath("/admin/review-queue")
    revalidatePath(`/admin/assessments/${submissionId}/review`)

    return { success: true, draft: object }
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err)
    const errStack = err instanceof Error ? err.stack : null

    // Both surfaces: Workflow Errors tells Matt a report needs re-running,
    // the diagnostics log keeps the provider response and stack that say why.
    await logAppError({
      area: "ai.report_draft",
      source: "job",
      error: err,
      context: { submissionId, model: "openrouter", stage: "generateObject" },
    })

    await adminClient.from("workflow_errors").insert({
      workflow_name: "ai_report_draft",
      error_message: errMessage,
      payload: {
        submission_id: submissionId,
        stack: errStack,
        severity: "high",
      },
    })

    await adminClient
      .from("form_submissions")
      .update({ status: "ai_draft_failed" })
      .eq("id", submissionId)

    revalidatePath("/admin/review-queue")
    revalidatePath(`/admin/assessments/${submissionId}/review`)

    throw new Error(`Failed to generate report draft via AI: ${errMessage}`)
  }
}

/**
 * Register report generation as post-response work. A failed generation is
 * visible in Workflow Errors and leaves the submission in a retryable state.
 */
export function scheduleReportDraftGeneration(submissionId: string): void {
  after(async () => {
    try {
      await runReportDraftGeneration(submissionId)
    } catch (err) {
      await logAppError({
        area: "ai.report_draft.scheduled",
        source: "job",
        error: err,
        context: { submissionId, note: "post-response draft generation failed" },
      })
      try {
        await adminClient
          .from("form_submissions")
          .update({ status: "ai_draft_failed" })
          .eq("id", submissionId)
          .eq("status", "submitted")
      } catch (flipErr) {
        // The submission is now stuck in 'submitted' with no draft and no
        // failure marker — invisible in the review queue without this record.
        await logAppError({
          area: "ai.report_draft.status_flip",
          source: "job",
          error: flipErr,
          context: {
            submissionId,
            note: "submission left in 'submitted' with no draft and no ai_draft_failed marker",
          },
        })
      }
    }
  })
}
