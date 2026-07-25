import { beforeEach, describe, expect, it, vi } from "vitest"

const consumeRateLimitSpy = vi.fn()
const generateLinkSpy = vi.fn()
const dispatchNotificationSpy = vi.fn()
const headersSpy = vi.fn()

vi.mock("server-only", () => ({}))

vi.mock("next/headers", () => ({
  headers: () => headersSpy(),
}))

vi.mock("@/lib/rate-limit", () => ({
  clientIpFrom: (headers: Headers) =>
    headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
  consumeRateLimit: (...args: unknown[]) => consumeRateLimitSpy(...args),
  rateLimitKey: (namespace: string, value: string) => `${namespace}:hashed:${value}`,
}))

vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    auth: {
      admin: {
        generateLink: (...args: unknown[]) => generateLinkSpy(...args),
      },
    },
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchNotification: (...args: unknown[]) =>
    dispatchNotificationSpy(...args),
}))

vi.mock("@/lib/site-url", () => ({
  getSiteUrl: () => "https://test.example.com",
}))

import { requestPasswordReset } from "@/app/login/forgot/actions"

describe("requestPasswordReset rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    headersSpy.mockResolvedValue(
      new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })
    )
    consumeRateLimitSpy.mockResolvedValue({ allowed: true })
    generateLinkSpy.mockResolvedValue({
      data: { properties: { hashed_token: "reset-token-hash" } },
      error: null,
    })
    dispatchNotificationSpy.mockResolvedValue({ ok: true, status: 200 })
  })

  it("consumes both account and IP windows before generating a link", async () => {
    await requestPasswordReset(" Sarah@Example.com ")

    expect(consumeRateLimitSpy).toHaveBeenNthCalledWith(
      1,
      "password-reset-account:hashed:sarah@example.com",
      3,
      3600
    )
    expect(consumeRateLimitSpy).toHaveBeenNthCalledWith(
      2,
      "password-reset-ip:hashed:203.0.113.7",
      20,
      3600
    )
    expect(generateLinkSpy).toHaveBeenCalledTimes(1)
    expect(dispatchNotificationSpy).toHaveBeenCalledTimes(1)
  })

  it("returns the same success shape but sends no email when either limit is exhausted", async () => {
    consumeRateLimitSpy
      .mockResolvedValueOnce({ allowed: false })
      .mockResolvedValueOnce({ allowed: true })

    await expect(requestPasswordReset("sarah@example.com")).resolves.toEqual({
      ok: true,
    })
    expect(generateLinkSpy).not.toHaveBeenCalled()
    expect(dispatchNotificationSpy).not.toHaveBeenCalled()
  })

  it("does not spend a limiter call for syntactically invalid input", async () => {
    await expect(requestPasswordReset("not-an-email")).resolves.toEqual({
      ok: true,
    })
    expect(consumeRateLimitSpy).not.toHaveBeenCalled()
    expect(generateLinkSpy).not.toHaveBeenCalled()
  })
})
