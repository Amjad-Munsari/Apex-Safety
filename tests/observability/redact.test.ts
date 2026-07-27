import { describe, it, expect } from "vitest"

import {
  redactString,
  redactValue,
  buildContext,
  safeHeaders,
  REDACTED,
  LIMITS,
} from "@/lib/observability/redact"

/**
 * The error log is the highest-risk place for a credential to escape: it is
 * written from catch blocks that dump whatever context was handy, and it is
 * readable by anyone with admin access. These tests are the guarantee that a
 * careless call site cannot leak.
 */

describe("redactString", () => {
  it("masks credentials that appear inside otherwise ordinary text", () => {
    const cases: Array<[string, string]> = [
      ["key sk-or-v1-abcdef0123456789abcdef fails", "OpenRouter"],
      ["Authorization: Bearer abcdefghij0123456789.token", "bearer header"],
      ["token sbp_0123456789abcdef0123 rejected", "Supabase management token"],
      ["re_0123456789abcdef0123 bounced", "Resend"],
    ]
    for (const [input, label] of cases) {
      const output = redactString(input)
      expect(output, label).toContain(REDACTED)
      expect(output, label).not.toMatch(/sk-or-v1-abcdef|sbp_0123456789|re_0123456789/)
    }
  })

  it("masks a JWT, which is what a leaked service-role key looks like", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnop1234"
    expect(redactString(`failed with ${jwt}`)).not.toContain(jwt)
  })

  it("masks a token carried in a URL query string", () => {
    const out = redactString("GET /callback?access_token=abc123secret&next=/admin")
    expect(out).not.toContain("abc123secret")
    expect(out).toContain("/callback")
  })

  it("leaves ordinary text untouched", () => {
    const message = "Failed to update proposal 42 for Hallam House"
    expect(redactString(message)).toBe(message)
  })

  it("is not stateful across calls despite using global regexes", () => {
    const input = "Bearer abcdefghij0123456789abcdef"
    expect(redactString(input)).toBe(redactString(input))
  })
})

describe("redactValue", () => {
  it("drops values under credential-shaped keys wholesale", () => {
    const out = redactValue({
      clientSecret: "whatever-this-is",
      password: "hunter2",
      apiKey: "abc",
      authorization: "xyz",
      cookie: "sb-token=1",
    }) as Record<string, unknown>

    for (const key of Object.keys(out)) {
      expect(out[key], key).toBe(REDACTED)
    }
  })

  it("keeps correlation fields that only sound secret", () => {
    const out = redactValue({ token_used: true, signing_token_used: false }) as Record<string, unknown>
    expect(out.token_used).toBe(true)
    expect(out.signing_token_used).toBe(false)
  })

  it("survives circular references instead of throwing", () => {
    const node: Record<string, unknown> = { name: "a" }
    node.self = node
    const out = redactValue(node) as Record<string, unknown>
    expect(out.name).toBe("a")
    expect(out.self).toBe("[circular]")
  })

  it("handles values JSON.stringify chokes on", () => {
    const out = redactValue({
      big: BigInt(10),
      fn: function namedFn() {},
      sym: Symbol("s"),
      nan: NaN,
      when: new Date("2026-07-27T10:00:00.000Z"),
    }) as Record<string, unknown>

    expect(out.big).toBe("10n")
    expect(out.fn).toBe("[function namedFn]")
    expect(String(out.sym)).toContain("Symbol")
    expect(out.nan).toBe("NaN")
    expect(out.when).toBe("2026-07-27T10:00:00.000Z")
  })

  it("caps arrays, objects and depth so one payload can't dominate the table", () => {
    const wide = Array.from({ length: LIMITS.arrayItems + 20 }, (_, i) => i)
    const cappedArray = redactValue(wide) as unknown[]
    expect(cappedArray.length).toBe(LIMITS.arrayItems + 1)
    expect(String(cappedArray.at(-1))).toContain("more items")

    let deep: Record<string, unknown> = { leaf: true }
    for (let i = 0; i < LIMITS.depth + 3; i += 1) deep = { nested: deep }
    expect(JSON.stringify(redactValue(deep))).toContain("[max depth]")
  })

  it("unwraps Error instances into a storable shape", () => {
    const out = redactValue(new TypeError("bad input")) as Record<string, unknown>
    expect(out.name).toBe("TypeError")
    expect(out.message).toBe("bad input")
    expect(typeof out.stack).toBe("string")
  })
})

describe("buildContext", () => {
  it("returns an empty object for absent context", () => {
    expect(buildContext(undefined)).toEqual({})
    expect(buildContext(null)).toEqual({})
  })

  it("wraps non-object input so the column always holds an object", () => {
    expect(buildContext("just a string")).toEqual({ value: "just a string" })
  })

  it("caps a single oversized string at the per-string limit", () => {
    // The per-string cap fires first, so one huge value never reaches the
    // whole-context guard.
    const out = buildContext({ blob: "x".repeat(LIMITS.totalContextBytes * 2) })
    expect(String(out.blob)).toContain("truncated")
    expect(String(out.blob).length).toBeLessThan(LIMITS.string + 200)
  })

  it("falls back to a truncated preview when many capped values still overflow", () => {
    // 60 keys × the 2,000-char string cap comfortably exceeds the 16KB budget,
    // which is the case the whole-context guard exists for.
    const wide: Record<string, string> = {}
    for (let i = 0; i < LIMITS.objectKeys; i += 1) {
      wide[`field_${i}`] = "y".repeat(LIMITS.string)
    }
    const out = buildContext(wide)
    expect(out.truncated).toBe(true)
    expect(JSON.stringify(out).length).toBeLessThan(LIMITS.totalContextBytes * 1.5)
  })

  it("redacts before size-capping, so a truncated preview cannot leak", () => {
    const out = buildContext({ clientSecret: "s".repeat(50), note: "sk-or-v1-abcdef0123456789abcdef" })
    const serialised = JSON.stringify(out)
    expect(serialised).not.toContain("sssssssss")
    expect(serialised).not.toContain("sk-or-v1-abcdef")
  })
})

describe("safeHeaders", () => {
  it("keeps only the allowlisted diagnostic headers", () => {
    const out = safeHeaders({
      "user-agent": "Mozilla/5.0",
      "x-vercel-id": "lhr1::abc",
      cookie: "sb-access-token=secret",
      authorization: "Bearer abcdefghij0123456789",
      "x-custom": "nope",
    })

    expect(out["user-agent"]).toBe("Mozilla/5.0")
    expect(out["x-vercel-id"]).toBe("lhr1::abc")
    expect(out.cookie).toBeUndefined()
    expect(out.authorization).toBeUndefined()
    expect(out["x-custom"]).toBeUndefined()
  })

  it("joins repeated header values and tolerates no headers at all", () => {
    expect(safeHeaders({ "accept-language": ["en-GB", "en"] })["accept-language"]).toBe("en-GB, en")
    expect(safeHeaders(undefined)).toEqual({})
  })
})
