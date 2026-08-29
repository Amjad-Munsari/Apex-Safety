import { readFileSync, readdirSync } from "node:fs"
import { extname, join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  PLATFORM_NAME,
  PUBLIC_CONTACT,
  PUBLIC_CONTACT_LINE,
} from "@/lib/public-identity"

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ps1",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
])

function collectTextFiles(path: string): string[] {
  const entries = readdirSync(path, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const child = join(path, entry.name)
    if (entry.isDirectory()) return collectTextFiles(child)
    return TEXT_EXTENSIONS.has(extname(entry.name)) ? [child] : []
  })
}

function repositoryIdentityCorpus(): string {
  const roots = [
    ".planning",
    "app",
    "components",
    "docs",
    "lib",
    "scripts",
    "supabase",
    "tests",
  ]
  const files = [
    ".env.example",
    "AGENTS.md",
    "HANDOFF.md",
    "package.json",
    ...roots.flatMap(collectTextFiles),
  ]
  return files.map((file) => readFileSync(file, "utf8")).join("\n")
}

describe("public identity", () => {
  it("keeps Apex as the platform brand and one canonical public contact", () => {
    expect(PLATFORM_NAME).toBe("Apex Safety OS")
    expect(PUBLIC_CONTACT.email).toBe("contact@apexsafety.demo")
    expect(PUBLIC_CONTACT.phone).toBe("+44 20 7946 0912")
    expect(PUBLIC_CONTACT_LINE).toBe(
      "contact@apexsafety.demo · +44 20 7946 0912"
    )
  })

  it("contains no retired mailbox or superseded public phone numbers", () => {
    const corpus = repositoryIdentityCorpus()
    const retiredMailboxProvider = ["pro", "ton"].join("")
    const supersededPdfPhone = ["0114", "555", "0188"].join(" ")
    const supersededPortalPhone = ["0161", "552", "0918"].join(" ")

    expect(corpus.toLowerCase()).not.toContain(retiredMailboxProvider)
    expect(corpus).not.toContain(supersededPdfPhone)
    expect(corpus).not.toContain(supersededPortalPhone)
  })
})
