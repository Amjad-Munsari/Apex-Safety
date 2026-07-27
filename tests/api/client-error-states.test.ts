import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Guards the client-page failure path end to end. In July 2026 the Billing
// page 42703'd in production for every client while /admin/diagnostics and
// /admin/errors both read healthy: each page caught its query error, wrote a
// console.error only Vercel could see, and rendered <ClientDataLoadError />.
// The fix routes every failed load through failedClientLoad(), which records
// the fault in app_error_log before returning the panel. These checks are
// static on purpose — they stop the next page added from regressing to the
// silent pattern.

const pages = [
  "app/client/page.tsx",
  "app/client/assignments/page.tsx",
  "app/client/assessments/page.tsx",
  "app/client/templates/page.tsx",
  "app/client/contracts/page.tsx",
  "app/client/billing/page.tsx",
  "app/client/directory/page.tsx",
  "app/client/compliance/page.tsx",
  "app/client/proposals/page.tsx",
  "app/client/reports/page.tsx",
]

function tsxFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...tsxFilesUnder(path))
    else if (/\.tsx?$/.test(entry.name)) out.push(path)
  }
  return out
}

describe("client data-load error states", () => {
  it.each(pages)("%s reports a failed query through failedClientLoad", (path) => {
    const source = readFileSync(path, "utf8")
    expect(source).toContain("failedClientLoad(")
  })

  it("no file under app/client renders ClientDataLoadError directly", () => {
    // The panel may only be reached via failedClientLoad, which logs first. A
    // direct render is a load failure Diagnostics will never see.
    for (const path of tsxFilesUnder("app/client")) {
      const source = readFileSync(path, "utf8")
      expect(source, `${path} must use failedClientLoad, not ClientDataLoadError`).not.toContain(
        "ClientDataLoadError"
      )
    }
  })

  it("failedClientLoad logs to app_error_log before returning the panel", () => {
    const helper = readFileSync("lib/observability/failed-client-load.tsx", "utf8")
    const logAt = helper.indexOf("logAppErrorAsync({")
    const panelAt = helper.indexOf("return <ClientDataLoadError")
    expect(logAt).toBeGreaterThan(-1)
    expect(panelAt).toBeGreaterThan(logAt)
    expect(helper).toContain('severity: "error"')
  })
})
