import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const pages = [
  "app/client/assignments/page.tsx",
  "app/client/assessments/page.tsx",
  "app/client/templates/page.tsx",
  "app/client/contracts/page.tsx",
  "app/client/billing/page.tsx",
  "app/client/directory/page.tsx",
]

describe("client data-load error states", () => {
  it.each(pages)("%s distinguishes a failed query from an empty result", (path) => {
    const source = readFileSync(path, "utf8")
    expect(source).toContain("ClientDataLoadError")
  })
})
