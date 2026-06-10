"use client"

import { FileDownloadMenu } from "./file-download-menu"

/**
 * Client wrapper around FileDownloadMenu for surfaces that already have a
 * pre-signed URL (server-rendered pages like contracts / proposal detail).
 * Pass a `downloadUrl` (signed with a download transform → force-save) and an
 * optional `viewUrl` (signed without → opens inline). Keeps these pages on the
 * same download control as the rest of the portal.
 */
export function FileDownloadUrl({
  downloadUrl,
  viewUrl,
  label,
  size,
}: {
  downloadUrl: string | null
  viewUrl?: string | null
  label?: string
  size?: "sm" | "md"
}) {
  if (!downloadUrl) {
    return <FileDownloadMenu label={label} size={size} disabled onDownload={() => {}} />
  }
  const open = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }
  return (
    <FileDownloadMenu
      label={label}
      size={size}
      onDownload={() => open(downloadUrl)}
      onView={viewUrl ? () => open(viewUrl) : undefined}
    />
  )
}
