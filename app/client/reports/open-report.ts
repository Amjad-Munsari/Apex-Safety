"use client"

import { toast } from "sonner"
import { getReportSignedUrl } from "./actions"

/**
 * Resolve a real signed URL for an assessment report and either download it or
 * open it in a new tab. Shared by every client surface that offers a report
 * download (reports list, assessments list + detail, dashboard). Replaces the
 * old hardcoded demo-preview dialog.
 */
export async function openReport(submissionId: string, mode: "view" | "download") {
  const res = await getReportSignedUrl(submissionId, { mode })
  if (!res.url) {
    toast.error(res.error || "Report not available yet.")
    return
  }
  if (mode === "download") {
    // The signed URL carries Content-Disposition: attachment, so an anchor
    // click triggers a save rather than a navigation.
    const a = document.createElement("a")
    a.href = res.url
    a.rel = "noopener noreferrer"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } else {
    window.open(res.url, "_blank", "noopener,noreferrer")
  }
}
