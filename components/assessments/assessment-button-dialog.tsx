"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AssessmentSelectorDialog } from "./assessment-selector-dialog"

export function AssessmentButtonDialog() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button 
        variant="secondary" 
        className="bg-amber-500 hover:bg-amber-400 text-black rounded-sm px-4 font-medium text-[11px] h-8 tracking-wide border-none transition-colors"
        onClick={() => setOpen(true)}
      >
        New Assessment
      </Button>
      <AssessmentSelectorDialog 
        open={open} 
        onOpenChange={setOpen} 
      />
    </>
  )
}
