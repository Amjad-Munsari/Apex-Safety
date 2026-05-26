/**
 * tests/e2e/helpers/answers-json.ts
 * 888 Safety & Training Platform
 *
 * Helper to read `form_submissions.answers_json` for a given submission
 * via the Supabase service-role client.
 *
 * Used by the Phase 15 smoke spec to verify the server-side hidden-subtree
 * scrub contract (D-01): entities that were hidden at submit time MUST NOT
 * appear as keys in answers_json.
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service-role key (admin read access)
 */

import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Read the `answers_json` column for a given form submission.
 *
 * @param submissionId - The UUID of the form_submissions row.
 * @returns The parsed answers_json object, or an empty object if not found.
 * @throws If the Supabase environment variables are not set, or if a DB error occurs.
 */
export async function readAnswersJson(
  submissionId: string
): Promise<Record<string, unknown>> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "readAnswersJson: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
    )
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await admin
    .from("form_submissions")
    .select("answers_json")
    .eq("id", submissionId)
    .single()

  if (error) {
    throw new Error(`readAnswersJson(${submissionId}): ${error.message}`)
  }

  if (!data || data.answers_json === null || data.answers_json === undefined) {
    return {}
  }

  return data.answers_json as Record<string, unknown>
}

/**
 * Read the most recently inserted form_submissions row for a given template name.
 * Useful when a test submits via the UI and does not have a submissionId yet.
 *
 * @param templateName - The `form_templates.name` to match against.
 * @returns The submission row (id + answers_json), or null if not found.
 */
export async function readLatestSubmissionForTemplate(
  templateName: string
): Promise<{ id: string; answers_json: Record<string, unknown> } | null> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "readLatestSubmissionForTemplate: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
    )
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: template, error: templateErr } = await admin
    .from("form_templates")
    .select("id")
    .eq("name", templateName)
    .limit(1)
    .single()

  if (templateErr || !template) return null

  const { data, error } = await admin
    .from("form_submissions")
    .select("id, answers_json")
    .eq("template_id", template.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  return {
    id: data.id as string,
    answers_json: (data.answers_json ?? {}) as Record<string, unknown>,
  }
}
