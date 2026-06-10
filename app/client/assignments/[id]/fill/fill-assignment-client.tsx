"use client";

import { useRef, useState } from "react";
import {
  InterpreterRenderer,
  type InterpreterRendererHandle,
} from "@/components/form-interpreter/interpreter-renderer";
import { submitAssignedFillByIdAction } from "@/app/client/assignments/actions";
import type { FormBuilderSchema } from "@/lib/form-builder";

interface FillAssignmentClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaJson: any;
  assignmentId: string;
  clientId: string;
  submissionId: string;
  /**
   * Previously-saved draft answers (form_submissions.answers_json) for the
   * resumed draft this submissionId points at. Threaded into InterpreterRenderer's
   * initialValues so a resumed draft rehydrates every field — including
   * repeatingSection rows ({ instances: [...] }). Without this the store mounts
   * empty and a user who filled a section, left, and returned sees their rows
   * gone (the post-idempotency-fix draft reuse made this a data-loss bug).
   *
   * Optional: if the RSC does not yet thread answers_json the store simply
   * mounts empty (prior behaviour) — no regression.
   */
  initialValues?: Record<string, unknown>;
}

/**
 * Client component: thin wrapper around InterpreterRenderer for the assigned-fill route.
 *
 * Surface: data-surface="client" (cream) — matches UI-SPEC Route F.
 * Submit button: "Submit form" black fill full-width (UI-SPEC Route F).
 *
 * Architecture (Plan 16-08 gap closure):
 *   - InterpreterRenderer owns the fill state, validation, and specialty renderers.
 *   - The RSC pre-creates a form_submissions draft (status='draft') before mounting
 *     this component so specialty renderers have a real submissionId at mount time.
 *   - onSubmit prop routes the final submit to submitAssignedFillByIdAction (UPDATE path).
 *   - No FormRenderer, no normalizeFormSchema, no parallel value store.
 *
 * T-16-04: client_id never flows from this component to any server action —
 * both createAssignmentDraftSubmission and submitAssignedFillByIdAction derive
 * client_id exclusively from requireClientContext() server-side.
 */
export function FillAssignmentClient({
  schemaJson,
  clientId,
  submissionId,
  initialValues,
}: FillAssignmentClientProps) {
  const interpreterRef = useRef<InterpreterRendererHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const schema = schemaJson as FormBuilderSchema;

  return (
    <div className="min-h-screen pb-32" data-surface="client">
      {/* Progress bar */}
      <div className="max-w-3xl mx-auto pt-6 pb-2 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">
            Progress
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">
            {progress}% complete
          </span>
        </div>
        <div className="h-0.5 bg-[#e5e1d8] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1a1a1a] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* InterpreterRenderer owns fill state, validation, and specialty renderers */}
      <InterpreterRenderer
        ref={interpreterRef}
        schema={schema}
        submissionId={submissionId}
        clientId={clientId}
        surface="cream"
        initialValues={initialValues}
        onProgressChange={setProgress}
        onSubmittingChange={setIsSubmitting}
        onSubmit={async (values) => {
          await submitAssignedFillByIdAction(submissionId, values);
        }}
      />

      {/* Submit button — black fill, full-width per UI-SPEC Route F */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#faf9f6] border-t border-[#e5e1d8] p-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => interpreterRef.current?.submit()}
            disabled={isSubmitting}
            className="w-full rounded-sm bg-[#1a1a1a] text-white h-12 font-mono text-[9px] uppercase tracking-[0.25em] hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting…" : "Submit form"}
          </button>
        </div>
      </div>
    </div>
  );
}
