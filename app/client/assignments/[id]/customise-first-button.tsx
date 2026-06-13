"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { forkAssignedTemplate } from "@/app/client/assignments/actions";

interface CustomiseFirstButtonProps {
  assignmentId: string;
}

/**
 * Renders an outline "Customise first" button that opens an AlertDialog
 * confirmation before forking the assignment's pinned template into a
 * customer-owned copy and redirecting to the builder.
 *
 * UI-SPEC Route E — Customise first AlertDialog (locked copy):
 *   Title:       "Create your own copy?"
 *   Description: "This creates your organisation's version of this form.
 *                 Changes to the original won't carry over to your copy."
 *   Cancel:      "Keep original"
 *   Action:      "Create my copy" (black-fill primary — NOT destructive)
 *
 * Error toast: "Could not create your copy. Please try again."
 * Pending label: "Creating copy…"
 *
 * The redirect emitted by forkAssignedTemplate is the success signal —
 * no success toast is shown (RESEARCH Pattern 1 caller pattern).
 */
export function CustomiseFirstButton({ assignmentId }: CustomiseFirstButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await forkAssignedTemplate(assignmentId);
        // Unreachable — forkAssignedTemplate always redirects on success
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        const digest = (err as { digest?: string })?.digest ?? "";
        // Bubble NEXT_REDIRECT so Next.js can handle the navigation
        if (msg.includes("NEXT_REDIRECT") || digest.startsWith("NEXT_REDIRECT")) {
          throw err;
        }
        toast.error("Could not create your copy. Please try again.");
      }
    });
  }

  return (
    <>
      {/* Trigger: outline button on cream surface — UI-SPEC Route E */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="flex-1 rounded-sm border border-foreground bg-transparent text-foreground h-11 px-5 font-mono text-[9px] uppercase tracking-[0.25em] hover:bg-foreground/5 transition-colors"
      >
        Customise first
      </Button>

      {/* Confirmation dialog — UI-SPEC locked copy */}
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          {/* Corner close — dismisses the dialog (same as "Keep original"). */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Create your own copy?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates your organisation&apos;s version of this form. Changes
              to the original won&apos;t carry over to your copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={pending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {pending ? "Creating copy…" : "Create my copy"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
