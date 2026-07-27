import { describe, it, expect } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Regression guard for the mail-scanner problem.
 *
 * Supabase's emailed token is single-use, so whatever fetches the link first
 * spends it. Gmail and Outlook prefetch every URL they deliver in order to scan
 * it, which consumed invite and password-reset tokens before the recipient
 * clicked: they saw "Link expired" while a scanner silently held the session.
 * It was reproduced against production on 27 July 2026 — the account showed
 * confirmed_at and a live session at the moment the human was looking at the
 * error page.
 *
 * The fix is structural: /auth/confirm must never verify on GET. It renders a
 * button, and only the POST behind a real click calls verifyOtp. These tests
 * assert that shape at the file level, because the failure is invisible in
 * normal use — everything looks fine until a real inbox is involved, which is
 * exactly when it matters.
 */

const CONFIRM_DIR = join(process.cwd(), "app/auth/confirm")

/**
 * Strips comments before asserting. The files explain *why* they must not call
 * verifyOtp, so a naive substring search matches the explanation rather than
 * any code — which is how the first version of this test failed.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

describe("/auth/confirm cannot be consumed by a prefetch", () => {
  it("has no route handler — a GET must not be able to spend the token", () => {
    // A route.ts here would serve GET and, historically, called verifyOtp on it.
    expect(existsSync(join(CONFIRM_DIR, "route.ts"))).toBe(false)
    expect(existsSync(join(CONFIRM_DIR, "route.tsx"))).toBe(false)
  })

  it("renders a page that does not verify anything", () => {
    const page = codeOnly(readFileSync(join(CONFIRM_DIR, "page.tsx"), "utf8"))
    expect(page).not.toContain("verifyOtp")
    // It must submit to the action rather than link onward.
    expect(page).toContain("confirmEmailLink")
    expect(page).toContain("<form")
    expect(page).toContain('type="submit"')
  })

  it("keeps the token out of search engines", () => {
    const page = readFileSync(join(CONFIRM_DIR, "page.tsx"), "utf8")
    expect(page).toContain("robots")
    expect(page).toMatch(/index:\s*false/)
  })

  it("verifies only inside a server action", () => {
    const actions = readFileSync(join(CONFIRM_DIR, "actions.ts"), "utf8")
    expect(actions.startsWith('"use server"')).toBe(true)
    expect(codeOnly(actions)).toContain("verifyOtp")
  })

  it("re-validates the hidden fields instead of trusting its own form", () => {
    const actions = readFileSync(join(CONFIRM_DIR, "actions.ts"), "utf8")
    // The hidden inputs are as attacker-controlled as the query string was.
    expect(actions).toContain("ALLOWED_TYPES")
    expect(actions).toContain("safeNextPath")
    // Open-redirect guards must survive the move to POST.
    expect(actions).toContain('startsWith("//")')
  })
})
