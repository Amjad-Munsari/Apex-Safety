import { notFound } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { ReviewClient } from "./review-client"

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: submission, error } = await adminClient
    .from("form_submissions")
    .select(`*`)
    .eq("id", id)
    .single()

  if (error || !submission) {
    notFound()
  }

  // Two-step pinned-template fetch (PATTERNS.md — never FK-join form_submissions → template_versions).
  // Tolerate a missing version row: Plan 06 renders an empty raw-answers panel when schemaJson == null.
  const { data: version } = await adminClient
    .from("template_versions")
    .select("schema_json")
    .eq("id", submission.template_version_id)
    .single()

  // STT transcripts for the D-04 raw-answers panel — REPORT-08.
  // Scoped by submission_id (admin-only route via /admin middleware; T-07-05-01 mitigation).
  const { data: audioMedia } = await adminClient
    .from("field_media")
    .select("field_id, storage_path, transcript")
    .eq("submission_id", id)
    .eq("media_type", "audio")

  // Plan 06 (Wave 2) widens ReviewClient's prop interface to accept schemaJson + audioMedia.
  // Transient cast keeps Plan 05 type-clean until Plan 06 lands.
  return (
    <ReviewClient
      {...({
        submission,
        schemaJson: version?.schema_json ?? null,
        audioMedia: audioMedia ?? [],
      } as any)}
    />
  )
}
