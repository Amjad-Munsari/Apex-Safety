"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { revokeAssignment } from "./actions";

interface RevokeAssignmentButtonProps {
  assignmentId: string;
}

export function RevokeAssignmentButton({ assignmentId }: RevokeAssignmentButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await revokeAssignment(assignmentId);
        toast.success("Assignment revoked");
        router.refresh();
      } catch {
        toast.error("Revoke failed — please try again");
      } finally {
        setOpen(false);
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="font-mono text-[10px] uppercase tracking-widest h-7 px-2 text-[#666] border-white/10 hover:border-white/30 hover:text-white"
      >
        Revoke
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              The client will no longer see this form in their Assigned Forms list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep assignment</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? "Revoking..." : "Revoke assignment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
