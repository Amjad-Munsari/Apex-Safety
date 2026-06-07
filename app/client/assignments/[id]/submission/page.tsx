import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { SubmissionViewerClient } from "./submission-viewer-client";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Server route: IDOR-scoped submission fetch + pinned schema fetch.
 *
 * Security posture (threat register T-19-07, T-19-09, T-19-10):
 *  - UUID_RE guard: rejects non-UUID [id] before any DB query (T-19-10).
 *  - RLS is the primary access control (Supabase row-level security).
 *  - Defense-in-depth: explicit client_id ownership check on the submission row (T-19-07).
 *  - Only schema_json for the submission's own template_version_id is fetched (T-19-09).
 *
 * Fetch pattern mirrors fill/page.tsx (two-step pinned-schema fetch — never via join,
 * per Phase 13 RESEARCH Pitfall 2 and PATTERNS § "Pinned-version fetch").
 */
export default async function SubmissionViewerPage({ params }: Props) {
  const { id } = await params;

  // T-19-10: reject malformed IDs before any DB query
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const ctx = await getClientContext();

  // Step 1: Fetch the most-recent submitted submission for this assignment.
  // Scoped by assignment_id + status = "submitted"; order by submitted_at desc, limit 1.
  const { data: submission } = await supabase
    .from("form_submissions")
    .select("id, answers_json, template_version_id, client_id, submitted_at")
    .eq("assignment_id", id)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!submission) {
    notFound();
  }

  // Defense-in-depth ownership check (T-19-07): RLS is primary; this is belt-and-suspenders.
  // A foreign org's assignment_id either returns no row (RLS) or hits this guard.
  if (ctx && submission.client_id !== ctx.client_id) {
    notFound();
  }

  // Step 2: Fetch the pinned schema for the version this submission was filled against.
  // Two-step fetch (never via join) per Phase 13 RESEARCH Pitfall 2.
  const { data: version } = await supabase
    .from("template_versions")
    .select("schema_json")
    .eq("id", submission.template_version_id)
    .single();

  if (!version) {
    notFound();
  }

  return (
    <SubmissionViewerClient
      schemaJson={version.schema_json}
      answersJson={submission.answers_json}
      submittedAt={submission.submitted_at}
      clientId={submission.client_id}
      submissionId={submission.id}
    />
  );
}
