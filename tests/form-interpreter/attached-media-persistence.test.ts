import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const component = readFileSync(
  "components/form-interpreter/attach-photos-affordance.tsx",
  "utf8"
)
const actions = readFileSync("app/admin/assessments/actions.ts", "utf8")

describe("per-field photo attachment persistence", () => {
  it("reloads saved attachments and deletes them through the server action", () => {
    expect(component).toContain("getAttachedMediaAction(submissionId, entityId)")
    expect(component).toContain(
      "deleteMediaAction(submissionId, entityId, entry.path)"
    )
    expect(actions).toMatch(
      /function getAttachedMediaAction[\s\S]*from\("field_media"\)[\s\S]*createSignedUrls/
    )
  })

  it("checks image bytes and cleans storage when the audit insert fails", () => {
    expect(actions).toContain("detectAllowedDocumentType(buffer)")
    expect(actions).toMatch(
      /if \(insertError\)[\s\S]*from\("form-media"\)[\s\S]*remove\(\[storagePath\]\)/
    )
  })
})
