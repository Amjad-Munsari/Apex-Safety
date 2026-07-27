"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteAssessment } from "@/app/admin/assessments/actions"
import { errorMessage } from "@/lib/utils"

interface AssessmentFormHeaderProps {
  submissionId: string
  clientName: string
  templateName: string
  progress: number
  onSaveDraft: () => void
  onSubmit: () => void
  isSubmitting: boolean
  isSaving: boolean
}

/**
 * Sticky header bar for the assessment form-fill page. Styled to match the
 * proposal wizard surface (--p-bg / --p-surface / --p-gold) so the journey
 * from "New Assessment" wizard → form-fill feels visually continuous.
 */
export function AssessmentFormHeader({
  submissionId,
  clientName,
  templateName,
  progress,
  onSaveDraft,
  onSubmit,
  isSubmitting,
  isSaving,
}: AssessmentFormHeaderProps) {
  const router = useRouter()
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleConfirmDelete() {
    setIsDeleting(true)
    try {
      const { clientId } = await deleteAssessment(submissionId)
      toast.success("Assessment deleted")
      router.push(clientId ? `/admin/clients/${clientId}` : "/admin")
    } catch (err) {
      setIsDeleting(false)
      toast.error(errorMessage(err) || "Failed to delete assessment")
    }
  }

  return (
    <>
      <div
        className="sticky top-0 z-30 py-5 -mx-8 px-8 mb-10"
        style={{
          background: "var(--p-bg)",
          borderBottom: "1px solid var(--p-border-subtle)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link
              href="/admin"
              className="transition-colors"
              style={{ color: "var(--p-text-muted)" }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h2
                className="text-xl"
                style={{ fontFamily: "var(--p-font-serif)", color: "var(--p-text)" }}
              >
                {clientName}
              </h2>
              <div className="flex items-center gap-3 mt-1.5">
                <span
                  className="text-[10px] uppercase font-medium"
                  style={{
                    fontFamily: "var(--p-font-mono)",
                    letterSpacing: "0.18em",
                    color: "var(--p-text-muted)",
                  }}
                >
                  {templateName}
                </span>
                <span style={{ color: "var(--p-border)" }}>·</span>
                <span
                  className="text-[10px] uppercase font-bold"
                  style={{
                    fontFamily: "var(--p-font-mono)",
                    letterSpacing: "0.18em",
                    color: "var(--p-gold)",
                  }}
                >
                  Draft
                </span>
                {isSaving && (
                  <Loader2
                    className="h-3 w-3 animate-spin ml-2"
                    style={{ color: "var(--p-text-muted)" }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            {/* Progress */}
            <div className="hidden sm:flex flex-col items-end gap-1.5 w-36">
              <div
                className="text-[10px] font-medium"
                style={{
                  fontFamily: "var(--p-font-mono)",
                  letterSpacing: "0.18em",
                  color: "var(--p-text-muted)",
                }}
              >
                {Math.round(progress)}% COMPLETE
              </div>
              <div
                className="h-1 w-full rounded-full overflow-hidden"
                style={{ background: "var(--p-surface-raised)" }}
              >
                <div
                  className="h-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%`, background: "var(--p-gold)" }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsDeleteOpen(true)}
                disabled={isSubmitting || isDeleting}
                className="rounded-sm px-4 font-medium text-[11px] h-9"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(197, 90, 90, 0.3)",
                  color: "#c55a5a",
                  fontFamily: "var(--p-font-mono)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete
              </Button>
              <Button
                variant="outline"
                onClick={onSaveDraft}
                disabled={isSubmitting}
                className="rounded-sm px-5 font-medium text-[11px] h-9"
                style={{
                  background: "transparent",
                  border: "1px solid var(--p-border)",
                  color: "var(--p-text)",
                  fontFamily: "var(--p-font-mono)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Save draft
              </Button>
              <Button
                onClick={onSubmit}
                disabled={progress < 100 || isSubmitting}
                className="rounded-sm px-5 font-medium text-[11px] h-9 disabled:opacity-40"
                style={{
                  background: "var(--p-gold)",
                  color: "var(--p-bg)",
                  border: "1px solid var(--p-gold)",
                  fontFamily: "var(--p-font-mono)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Submitting
                  </>
                ) : (
                  "Submit assessment"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-base">
              Delete this assessment?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Permanently removes the assessment for{" "}
              <span className="text-foreground">{clientName}</span> ({templateName})
              including any saved answers and generated report PDF.{" "}
              <strong>This cannot be undone.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {isDeleting ? "Deleting…" : "Delete assessment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
