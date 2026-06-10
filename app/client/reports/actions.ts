"use server"

import { adminClient } from "@/lib/supabase/admin"
import { getClientContext } from "@/lib/auth-helpers"

/**
 * Mint a short-lived signed URL for a client's completed assessment report.
 *
 * The report PDF is produced by the admin AI pipeline and stored at
 * form_submissions.report_storage_path in the `reports` bucket. This is the only
 * in-app path to that file — the previous UI served a hardcoded demo mock.
 *
 * Security: the `.eq("client_id", ctx.client_id)` scope is the IDOR boundary — a
 * client can only ever sign a URL for a submission their own org owns, even
 * though we query via the service-role adminClient (which bypasses RLS).
 */
export async function getReportSignedUrl(
  submissionId: string,
  opts: { mode?: "view" | "download" } = {}
): Promise<{ url: string | null; error?: string }> {
  const ctx = await getClientContext()
  if (!ctx?.client_id) return { url: null, error: "Sign in to view your reports." }

  const { data: sub } = await adminClient
    .from("form_submissions")
    .select("report_storage_path")
    .eq("id", submissionId)
    .eq("client_id", ctx.client_id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!sub?.report_storage_path) {
    return { url: null, error: "This report isn't ready to download yet." }
  }

  const mode = opts.mode ?? "download"
  const signOpts = mode === "download" ? { download: true } : undefined

  const { data: signed, error } = await adminClient.storage
    .from("reports")
    .createSignedUrl(sub.report_storage_path, 60 * 5, signOpts)

  if (error || !signed?.signedUrl) {
    return { url: null, error: "Could not generate the download link. Please try again." }
  }

  return { url: signed.signedUrl }
}
