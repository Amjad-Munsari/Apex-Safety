import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/036_paypal_runtime_credentials.sql"),
  "utf8"
)
const expiryCron = readFileSync(resolve(process.cwd(), "app/api/cron/expiry/route.ts"), "utf8")

describe("PayPal runtime retention cleanup", () => {
  it("cleans only credited history after 90 days, preserving uncredited recovery mappings and their versions", () => {
    expect(migration).toContain("cleanup_paypal_runtime_records")
    expect(migration).toContain("default 90")
    expect(migration).toMatch(/p\.created_at < v_cutoff\s+and p\.credited_at is not null/i)
    expect(migration).toContain("every uncredited mapping remains")
    expect(migration).toContain("v.config_version is distinct from v_current_version")
    expect(migration).toContain("not exists")
    expect(migration).toContain("from vault.secrets")
    expect(migration).toMatch(/security definer\s+set search_path = ''/i)
    expect(migration).toMatch(/cleanup_paypal_runtime_records\(integer\)[\s\S]*to service_role/i)
  })

  it("runs best-effort cleanup before the expiry-reminder early exit", () => {
    const cleanup = expiryCron.indexOf('rpc("cleanup_paypal_runtime_records")')
    const remindersDisabled = expiryCron.indexOf("!settings.expiryRemindersEnabled")
    expect(cleanup).toBeGreaterThan(-1)
    expect(cleanup).toBeLessThan(remindersDisabled)
    expect(expiryCron).toContain('paypalCleanupError.code !== "PGRST202"')
    expect(expiryCron).toContain('paypalCleanupError.code !== "42883"')
  })
})
