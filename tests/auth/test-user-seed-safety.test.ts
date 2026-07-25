import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const seedScript = readFileSync("scripts/ensure-client-test-user.mjs", "utf8")

describe("client test-user seed safety", () => {
  it("requires an explicit opt-in and a caller-supplied password", () => {
    expect(seedScript).toMatch(/ALLOW_TEST_USER_SEED !== 'true'/)
    expect(seedScript).toMatch(/TEST_CLIENT_PASSWORD/)
    expect(seedScript).not.toMatch(/TEST_PASSWORD\s*=.*\|\|/)
    expect(seedScript).not.toContain("'test123'")
  })
})
