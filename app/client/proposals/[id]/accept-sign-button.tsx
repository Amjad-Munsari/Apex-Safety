"use client";

import { useTransition } from "react";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import { beginProposalSigning } from "../actions";

interface AcceptSignButtonProps {
  proposalId: string;
}

/**
 * Client island that mints a signing token via beginProposalSigning then
 * navigates to /sign/[token].
 *
 * Lets NEXT_REDIRECT errors bubble to the framework (they are not real
 * errors). Toasts on actual errors so the user gets feedback.
 */
export function AcceptSignButton({ proposalId }: AcceptSignButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await beginProposalSigning(proposalId);
      } catch (err: unknown) {
        if (err instanceof Error && err.message?.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        const asErr = err as { digest?: string };
        if (asErr?.digest?.startsWith?.("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error(
          err instanceof Error
            ? err.message || "Could not start signing"
            : "Could not start signing"
        );
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="bg-teal hover:bg-teal/90 text-white text-[10px] uppercase tracking-[0.25em] font-bold h-12 rounded-sm shadow-none flex items-center gap-2 justify-center transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <PenLine className="w-3.5 h-3.5" />
      {pending ? "Preparing…" : "Accept & Sign"}
    </button>
  );
}
