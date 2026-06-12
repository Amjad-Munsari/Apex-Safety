"use client"

import Link from "next/link"
import { ArrowLeft, FileText } from "lucide-react"
import { InterpreterRenderer } from "@/components/form-interpreter/interpreter-renderer"
import type { FormBuilderSchema } from "@/lib/form-builder"

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaJson: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answersJson: any
  submittedAt: string | null
  clientId: string
  clientName: string
  submissionId: string
  templateName: string
  backHref: string
}

/**
 * Read-only view of a submitted assessment's ANSWERS (the filled form). The
 * report draft lives separately in the client's Reports tab. Read-only is
 * enforced the same way as the client submission viewer: no callbacks/ref wired
 * + a pointer-events-none/select-none wrapper, so nothing can be edited or saved.
 */
export function AssessmentAnswersView({
  schemaJson,
  answersJson,
  submittedAt,
  clientId,
  clientName,
  submissionId,
  templateName,
  backHref,
}: Props) {
  const schema = schemaJson as FormBuilderSchema
  const notes = (answersJson?.__appendix_notes as string) || ""
  const media = Array.isArray(answersJson?.__appendix_media)
    ? (answersJson.__appendix_media as string[])
    : []

  const formatted = submittedAt
    ? new Date(submittedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <div className="flex flex-col gap-6 pt-8 pb-20 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {clientName}
        </Link>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            <FileText className="w-3.5 h-3.5" /> Assessment answers
          </div>
          <h2 className="font-serif text-[30px] leading-tight text-foreground">{templateName}</h2>
          <div className="flex items-center gap-3 flex-wrap mt-1">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full ring-1 ring-border text-foreground/70 font-mono text-[10px] uppercase tracking-widest leading-none">
              <span className="size-1.5 rounded-full bg-muted-foreground/40" />
              Read-only
            </span>
            {formatted && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Submitted {formatted}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Read-only form render — pointer-events-none blocks all interaction. */}
      <div className="pointer-events-none select-none opacity-90">
        <InterpreterRenderer
          schema={schema}
          submissionId={submissionId}
          clientId={clientId}
          surface="dark"
          initialValues={answersJson ?? {}}
        />
      </div>

      {/* Appendix (notes + media), read-only — not part of the schema fields. */}
      {(notes || media.length > 0) && (
        <div className="flex flex-col gap-4 border-t border-border pt-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Appendix</span>
          {notes && (
            <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{notes}</p>
          )}
          {media.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {media.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] uppercase tracking-widest text-gold hover:underline"
                >
                  Attachment {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
