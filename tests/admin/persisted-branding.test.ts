import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const settings = readFileSync("lib/settings/app-settings.ts", "utf8")
const adminLayout = readFileSync("app/admin/layout.tsx", "utf8")
const clientLayout = readFileSync("app/client/layout.tsx", "utf8")
const branding = readFileSync("lib/branding.ts", "utf8")
const settingsActions = readFileSync("app/admin/settings/actions.ts", "utf8")

describe("practice-wide branding", () => {
  it("loads and applies persisted colours on both portal layouts", () => {
    expect(settings).toContain("branding_primary")
    expect(adminLayout).toContain('"--teal": brandingPrimary')
    expect(clientLayout).toContain('"--teal": brandingPrimary')
  })

  it("does not use per-browser localStorage as the source of truth", () => {
    expect(branding).not.toContain("localStorage")
  })

  it("rejects executable SVG branding and checks image bytes", () => {
    expect(settingsActions).not.toContain('"image/svg+xml"')
    expect(settingsActions).toContain("detectAllowedDocumentType(bytes)")
    expect(settingsActions).toContain("mimeMatchesDetectedType(file.type, detected.mime)")
  })
})
