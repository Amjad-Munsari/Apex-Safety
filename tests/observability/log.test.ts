import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const insertMock = vi.fn()
const fromMock = vi.fn(() => ({ insert: insertMock }))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    from: (table: string) => fromMock(table),
  },
}))

import {
  buildErrorRow,
  buildFingerprint,
  normaliseMessageForFingerprint,
  logAppError,
  logAppErrorAsync,
  runLogged,
  withLogging,
} from "@/lib/observability/log"

/**
 * The logger's contract is narrow but absolute: it always emits, it never
 * throws, and it never blocks a fix on the log write succeeding. Every test
 * here defends one of those three.
 */

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  insertMock.mockReset().mockResolvedValue({ error: null })
  fromMock.mockClear()
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
  process.env.VERCEL_ENV = "production"
  process.env.VERCEL_GIT_COMMIT_SHA = "abcdef1234567890"
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  process.env = { ...ORIGINAL_ENV }
})

describe("fingerprinting", () => {
  it("collapses the same fault with different ids into one group", () => {
    const a = "Client 8f14e45f-ceea-467a-9c4b-2f0b9e1a0000 not found"
    const b = "Client 1a2b3c4d-0000-4444-8888-999999999999 not found"
    expect(buildFingerprint("clients.load", "Error", a)).toBe(
      buildFingerprint("clients.load", "Error", b)
    )
  })

  it("keeps genuinely different faults apart", () => {
    expect(buildFingerprint("a.b", "Error", "disk full")).not.toBe(
      buildFingerprint("a.b", "Error", "permission denied")
    )
    expect(buildFingerprint("area.one", "Error", "same")).not.toBe(
      buildFingerprint("area.two", "Error", "same")
    )
  })

  it("normalises the parts that vary between occurrences", () => {
    const normalised = normaliseMessageForFingerprint(
      'row "abc" failed at 2026-07-27T10:00:00Z after 42 retries'
    )
    expect(normalised).not.toContain("2026-07-27")
    expect(normalised).not.toContain("42")
    expect(normalised).not.toContain("abc")
  })
})

describe("buildErrorRow", () => {
  it("narrows an Error into the stored shape", () => {
    const row = buildErrorRow({
      area: "signing.redeem",
      source: "route",
      error: new TypeError("token expired"),
    })
    expect(row.error_name).toBe("TypeError")
    expect(row.message).toBe("token expired")
    expect(row.stack).toContain("TypeError")
    expect(row.severity).toBe("error")
    expect(row.environment).toBe("production")
    expect(row.release).toBe("abcdef123456")
  })

  it("handles the shapes callers actually throw, not just Error", () => {
    // Supabase returns plain objects; a thrown string is common in older code.
    const supabaseish = buildErrorRow({
      area: "db.read",
      source: "render",
      error: { message: "permission denied", code: "42501" },
    })
    expect(supabaseish.message).toBe("permission denied")
    expect(supabaseish.error_name).toBe("42501")

    expect(buildErrorRow({ area: "a", source: "job", error: "plain string" }).message).toBe(
      "plain string"
    )
    expect(buildErrorRow({ area: "a", source: "job", error: null, message: "explicit" }).message).toBe(
      "explicit"
    )
    expect(buildErrorRow({ area: "a", source: "job", error: undefined }).message).toBeTruthy()
  })

  it("carries the Next.js digest so a user-visible reference resolves to a stack", () => {
    const err = Object.assign(new Error("boom"), { digest: "2158489109" })
    expect(buildErrorRow({ area: "a", source: "render", error: err }).digest).toBe("2158489109")
  })

  it("redacts secrets reaching it through the message or context", () => {
    const row = buildErrorRow({
      area: "paypal.capture",
      source: "external",
      error: new Error("auth failed for sk-or-v1-abcdef0123456789abcdef"),
      context: { clientSecret: "super-secret-value", orderId: "5X9" },
    })
    expect(row.message).not.toContain("sk-or-v1-abcdef")
    expect(JSON.stringify(row.context)).not.toContain("super-secret-value")
    expect(JSON.stringify(row.context)).toContain("5X9")
  })
})

describe("logAppError", () => {
  it("writes the row to app_error_log", async () => {
    await logAppError({ area: "test.area", source: "job", error: new Error("boom") })
    expect(fromMock).toHaveBeenCalledWith("app_error_log")
    const row = insertMock.mock.calls[0][0]
    expect(row.area).toBe("test.area")
    expect(row.message).toBe("boom")
  })

  it("emits to the console before attempting the insert", async () => {
    await logAppError({ area: "test.area", source: "job", error: new Error("boom") })
    expect(console.error).toHaveBeenCalled()
    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => String(call[0]))
      .join("\n")
    expect(logged).toContain("app-error")
    expect(logged).toContain("boom")
  })

  it("still logs to the console when the database insert fails", async () => {
    insertMock.mockResolvedValue({ error: { message: "relation does not exist" } })
    await expect(
      logAppError({ area: "test.area", source: "job", error: new Error("boom") })
    ).resolves.toBeUndefined()
    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map((call) => String(call[0]))
      .join("\n")
    expect(logged).toContain("boom")
    expect(logged).toContain("insert failed")
  })

  it("does not throw when the insert itself throws", async () => {
    insertMock.mockRejectedValue(new Error("network down"))
    await expect(
      logAppError({ area: "test.area", source: "job", error: new Error("boom") })
    ).resolves.toBeUndefined()
  })

  it("attempts the insert regardless of environment configuration", async () => {
    // Deliberately unconditional: gating the write on env vars would silently
    // drop records in any environment configured differently from the one this
    // check assumed. A genuinely unavailable client fails inside the try/catch.
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await logAppError({ area: "test.area", source: "job", error: new Error("boom") })
    expect(insertMock).toHaveBeenCalled()
  })

  it("never throws even when handed a hostile value", async () => {
    const hostile = {
      get message() {
        throw new Error("getter explodes")
      },
    }
    await expect(
      logAppError({ area: "test.area", source: "job", error: hostile })
    ).resolves.toBeUndefined()
  })

  it("logAppErrorAsync does not reject, so a render path cannot inherit an unhandled rejection", async () => {
    insertMock.mockRejectedValue(new Error("network down"))
    expect(() => logAppErrorAsync({ area: "a", source: "render", error: new Error("x") })).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

describe("wrappers", () => {
  it("withLogging records the failure and rethrows", async () => {
    await expect(
      withLogging({ area: "a", source: "action" }, async () => {
        throw new Error("inner")
      })
    ).rejects.toThrow("inner")
    expect(insertMock).toHaveBeenCalled()
  })

  it("withLogging stays out of the way on success", async () => {
    await expect(withLogging({ area: "a", source: "action" }, async () => 42)).resolves.toBe(42)
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("runLogged swallows the failure, records it as a warning, and returns the fallback", async () => {
    const result = await runLogged(
      { area: "a", source: "job" },
      async () => {
        throw new Error("best effort failed")
      },
      "fallback"
    )
    expect(result).toBe("fallback")
    expect(insertMock.mock.calls[0][0].severity).toBe("warning")
  })
})
