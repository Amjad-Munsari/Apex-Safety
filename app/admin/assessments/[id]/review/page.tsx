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
  // field_media table does not exist in the live DB; the D-04 panel renders
  // the "(audio attached, no transcript yet)" placeholder until the audio-
  // capture feature ships an intentional schema.
  const audioMedia: { field_id: string; storage_path: string; transcript: string | null }[] = []

  return (
    <ReviewClient
      submission={submission}
      schemaJson={(version?.schema_json as Record<string, unknown> | undefined) ?? null}
      audioMedia={audioMedia}
    />
  )
}
