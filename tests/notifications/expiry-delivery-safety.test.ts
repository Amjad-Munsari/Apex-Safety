import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const cron = readFileSync("app/api/cron/expiry/route.ts", "utf8")
// The provider call moved out of dispatch.ts into the Resend transport when the
// outbox landed; the idempotency guarantee this test protects lives there now.
const transport = readFileSync("lib/notifications/resend.ts", "utf8")

describe("expiry delivery safety", () => {
  it("uses the designated organisation contact", () => {
    expect(cron).toContain("contact_name, contact_email")
    expect(cron).not.toMatch(
      /from\("client_users"\)[\s\S]*select\("name, email"\)/
    )
  })

  it("uses provider idempotency and surfaces audit-log failures", () => {
    expect(cron).toContain(
      "idempotencyKey: `expiry-${doc.id}-${alertWindow}`"
    )
    expect(cron).toContain('workflow_name: "expiry_notification_audit"')
    expect(transport).toContain("{ idempotencyKey: options.idempotencyKey }")
  })
})
