"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { startAssignmentFill } from "../actions";

interface FillAsIsButtonProps {
  assignmentId: string;
}

/**
 * Client island that calls startAssignmentFill then navigates.
 *
 * Lets NEXT_REDIRECT errors bubble to the framework (they are not real errors).
 * Toasts on actual errors so the user gets feedback.
 */
export function FillAsIsButton({ assignmentId }: FillAsIsButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await startAssignmentFill(assignmentId);
      } catch (err: unknown) {
        // NEXT_REDIRECT throws an object with { digest: "NEXT_REDIRECT;..." }
        // Let it propagate so the router handles the redirect.
        if (
          err instanceof Error &&
          err.message?.startsWith("NEXT_REDIRECT")
        ) {
          throw err;
        }
        const asErr = err as { digest?: string };
        if (asErr?.digest?.startsWith?.("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error(
          err instanceof Error
            ? err.message || "Could not start fill"
            : "Could not start fill"
        );
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex-1 rounded-sm bg-[#1a1a1a] text-white h-11 px-5 font-mono text-[9px] uppercase tracking-[0.25em] hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Opening…" : "Fill as-is"}
    </button>
  );
}
