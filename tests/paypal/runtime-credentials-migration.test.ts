import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/036_paypal_runtime_credentials.sql"),
  "utf8"
)

describe("036_paypal_runtime_credentials", () => {
  it("stores only safe PayPal metadata in app_settings and uses Vault for the credential pair", () => {
    expect(migration).toContain("vault.create_secret")
    expect(migration).toContain("vault.decrypted_secrets")
    expect(migration).not.toMatch(/add column[^;]*(client_secret|paypal_client_secret)/i)
  })

  it("versions credentials, pins checkouts, and protects all secret-bearing functions", () => {
    expect(migration).toContain("pg_advisory_xact_lock")
    expect(migration).toContain("paypal_runtime_credential_versions")
    expect(migration).toContain("paypal_pending_checkouts")
    expect(migration).toMatch(
      /client_id uuid not null references public\.clients\(id\) on delete cascade/i
    )
    expect(migration).toContain("paypal_config_version")
    expect(migration).toContain("app_settings_paypal_config_version_fkey")
    expect(migration).toMatch(/security definer\s+set search_path = ''/i)
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/i)
    expect(migration).toMatch(/grant execute on function[\s\S]*to service_role/i)
    expect(migration).toContain("set_paypal_payments_enabled")
    expect(migration).toContain("mark_paypal_pending_checkout_credited")
  })
})
