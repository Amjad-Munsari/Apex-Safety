"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormRenderer } from "@/components/forms/form-renderer";
import { normalizeFormSchema, type FormSchema } from "@/types/forms";
import { submitAssignedFillAction } from "../../actions";

interface FillAssignmentClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaJson: any;
  assignmentId: string;
  clientId: string;
  templateVersionId: string;
}

/**
 * Client component: renders the form interpreter against the pinned template
 * version and submits via submitAssignedFillAction.
 *
 * Surface: data-surface="client" (cream) — matches UI-SPEC Route F.
 * Submit button: "Submit form" black fill full-width (UI-SPEC Route F).
 *
 * Mirrors app/admin/assessments/[id]/assessment-client.tsx but:
 *   - cream surface (no dark tokens)
 *   - no autosave (assigned fill is simpler — submit on completion)
 *   - submit action is submitAssignedFillAction
 */
export function FillAssignmentClient({
  schemaJson,
  assignmentId,
  clientId: _clientId,
  templateVersionId: _templateVersionId,
}: FillAssignmentClientProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [pending, startTransition] = useTransition();

  const schema: FormSchema = normalizeFormSchema(schemaJson);

  // Calculate progress: count non-empty answers vs. total fields
  const allFields = schema.sections.flatMap((s) => s.fields);
  const filledCount = allFields.filter((f) => {
    const val = answers[f.id];
    return val !== undefined && val !== null && val !== "" &&
      (!Array.isArray(val) || val.length > 0);
  }).length;
  const totalFields = allFields.length;
  const progress = totalFields === 0 ? 100 : Math.round((filledCount / totalFields) * 100);

  function handleFieldChange(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handleSubmit() {
    startTransition(async () => {
      try {
        await submitAssignedFillAction(assignmentId, answers);
        // submitAssignedFillAction calls redirect() internally — this line is
        // only reached if something went wrong (redirect throws NEXT_REDIRECT
        // which bubbles up through the framework before reaching here).
        toast.success("Form submitted");
        router.push(`/client/assignments/${assignmentId}`);
      } catch (err: unknown) {
        // NEXT_REDIRECT is the normal success path — let it bubble
        const asErr = err as { digest?: string };
        if (asErr?.digest?.startsWith?.("NEXT_REDIRECT")) {
          throw err;
        }
        if (err instanceof Error && err.message?.includes("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error(
          err instanceof Error ? err.message || "Could not submit form" : "Could not submit form"
        );
      }
    });
  }

  return (
    <div className="min-h-screen pb-32 px-4">
      {/* Progress bar */}
      <div className="max-w-3xl mx-auto pt-6 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">
            {schema.title}
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

      {/* Form renderer — cream surface */}
      <FormRenderer
        schema={schema}
        data={answers}
        onChange={handleFieldChange}
        surface="cream"
      />

      {/* Submit button — black fill, full-width per UI-SPEC Route F */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#faf9f6] border-t border-[#e5e1d8] p-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="w-full rounded-sm bg-[#1a1a1a] text-white h-12 font-mono text-[9px] uppercase tracking-[0.25em] hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Submitting…" : "Submit form"}
          </button>
        </div>
      </div>
    </div>
  );
}
