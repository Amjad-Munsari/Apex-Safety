"use client";

import { useRef, useState } from "react";
import {
  InterpreterRenderer,
  type InterpreterRendererHandle,
} from "@/components/form-interpreter/interpreter-renderer";
import { submitCustomerTemplateFillByIdAction } from "@/app/client/templates/actions";
import type { FormBuilderSchema } from "@/lib/form-builder";

interface FillCustomerTemplateClientProps {
  templateId: string;
  templateName: string;
  schemaJson: FormBuilderSchema;
  submissionId: string;
  clientId: string;
}

/**
 * Client component: thin wrapper around InterpreterRenderer for the customer template fill route.
 *
 * Surface: data-surface="client" (cream) — matches UI-SPEC Route G / D-16.
 * Submit button: "Submit form" black fill full-width (UI-SPEC client surface contract).
 *
 * Architecture (Plan 16-08 gap closure):
 *   - InterpreterRenderer owns the fill state, validation, and specialty renderers.
 *   - The RSC pre-creates a form_submissions draft (status='draft', assignment_id=NULL)
 *     before mounting this component so specialty renderers have a real submissionId.
 *   - onSubmit prop routes the final submit to submitCustomerTemplateFillByIdAction (UPDATE path).
 *   - No FormRenderer, no normalizeFormSchema, no parallel value store.
 *
 * T-16-04: client_id never flows from this component to any server action —
 * both createCustomerTemplateDraftSubmission and submitCustomerTemplateFillByIdAction
 * derive client_id exclusively from requireClientContext() server-side.
 */
export function FillCustomerTemplateClient({
  schemaJson,
  submissionId,
  clientId,
}: FillCustomerTemplateClientProps) {
  const interpreterRef = useRef<InterpreterRendererHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const schema = schemaJson as FormBuilderSchema;

  return (
    <div className="min-h-screen pb-32">
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
        onProgressChange={setProgress}
        onSubmittingChange={setIsSubmitting}
        onSubmit={async (values) => {
          await submitCustomerTemplateFillByIdAction(submissionId, values);
        }}
      />

      {/* Submit button — black fill, full-width per UI-SPEC client surface contract */}
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
