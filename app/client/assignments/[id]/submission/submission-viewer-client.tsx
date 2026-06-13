"use client";

import Link from "next/link";
import { InterpreterRenderer } from "@/components/form-interpreter/interpreter-renderer";
import type { FormBuilderSchema } from "@/lib/form-builder";

interface SubmissionViewerClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaJson: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  answersJson: any;
  submittedAt: string | null;
  clientId: string;
  submissionId: string;
}

/**
 * Read-only submission viewer client component.
 *
 * Belt-and-suspenders read-only affordance:
 *   1. CSS overlay: pointer-events-none + select-none (no mouse/touch input accepted)
 *   2. No onSubmit, onProgressChange, onValuesChange, or any ref wired
 *   3. No submit button rendered
 *
 * Renders the pinned submission against the schema version it was filled against.
 * T-19-08: Tampering is blocked — the viewer cannot mutate or re-submit the submission.
 */
export function SubmissionViewerClient({
  schemaJson,
  answersJson,
  submittedAt,
  clientId,
  submissionId,
}: SubmissionViewerClientProps) {
  const schema = schemaJson as FormBuilderSchema;

  const formattedDate = submittedAt
    ? new Date(submittedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen pb-16" data-surface="client">
      {/* Header */}
      <div className="max-w-3xl mx-auto pt-6 pb-4 px-4 space-y-3">
        <Link
          href="/client/assignments"
          className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to Assessments
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h2 className="font-serif text-[22px] text-foreground font-medium tracking-tight leading-[1.15]">
            Submitted form
          </h2>
          {formattedDate && (
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">
              Submitted {formattedDate}
            </span>
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-success/10 border border-success/20">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-success">
            Read-only &middot; Submitted
          </span>
        </div>
      </div>

      {/* Read-only renderer — pointer-events-none wrapper prevents all interaction */}
      <div className="pointer-events-none select-none opacity-90">
        <InterpreterRenderer
          schema={schema}
          submissionId={submissionId}
          clientId={clientId}
          surface="cream"
          initialValues={answersJson ?? {}}
        />
      </div>
    </div>
  );
}
