"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

export function useDraftSync(
  submissionId: string | null,
  formData: any,
  intervalMs: number = 30000
) {
  const supabase = createClient()
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedDataRef = useRef<string>("")

  const syncDraft = async () => {
    if (!submissionId) return

    const currentDataStr = JSON.stringify(formData)
    if (currentDataStr === lastSavedDataRef.current) return

    try {
      const { error } = await supabase
        .from("form_submissions")
        .update({
          answers_json: formData,
          status: "draft",
        })
        .eq("id", submissionId)

      if (!error) {
        lastSavedDataRef.current = currentDataStr
        console.log("Draft synced to cloud")
      } else {
        console.error("Draft sync error:", error)
      }
    } catch (error) {
      console.error("Draft sync failed:", error)
    }
  }

  useEffect(() => {
    if (submissionId) {
      timerRef.current = setInterval(syncDraft, intervalMs)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [submissionId, formData, intervalMs])

  return {
    syncDraft,
  }
}
