import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { createAssignmentDraftSubmission } from "@/app/client/assignments/actions";
import { FillAssignmentClient } from "./fill-assignment-client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FillAssignmentPage({ params }: Props) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const supabase = await createClient();
  const ctx = await getClientContext();

  // Step 1: Fetch the assignment row.
  // Defense-in-depth: filter by client_id on top of RLS (T-16-01).
  const { data: assignment } = await supabase
    .from("form_assignments")
    .select(
      "id, client_id, template_version_id, status, deleted_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!assignment || assignment.deleted_at !== null) {
    notFound();
  }

  // Defense-in-depth ownership check
  if (ctx && assignment.client_id !== ctx.client_id) {
    notFound();
  }

  // Already-completed: redirect back to the landing page
  if (assignment.status === "completed") {
    redirect(`/client/assignments/${id}`);
  }

  if (!assignment.template_version_id) {
    notFound();
  }

  // Step 2: Fetch the pinned template version (two-step fetch — never via join,
  // per Phase 13 RESEARCH Pitfall 2 and PATTERNS § "Pinned-version fetch").
  const { data: version } = await supabase
    .from("template_versions")
    .select("schema_json, template_id")
    .eq("id", assignment.template_version_id)
    .single();

  if (!version) {
    notFound();
  }

  // Step 3: Pre-create the draft submission row so specialty renderers
  // (signature, multi-photo, geolocation) have a real submissionId at mount time.
  // createAssignmentDraftSubmission also transitions the assignment pending → in_progress.
  const draft = await createAssignmentDraftSubmission(id);

  return (
    <FillAssignmentClient
      schemaJson={version.schema_json}
      assignmentId={id}
      clientId={ctx?.client_id ?? assignment.client_id}
      submissionId={draft.id}
    />
  );
}
