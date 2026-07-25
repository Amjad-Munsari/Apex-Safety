import { beforeEach, describe, expect, it, vi } from "vitest"

const rpcSpy = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: {
    rpc: (...args: unknown[]) => rpcSpy(...args),
  },
}))

import {
  clientIpFrom,
  consumeRateLimit,
  rateLimitKey,
} from "@/lib/rate-limit"

describe("rate limit helper", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("stores a digest rather than the raw email or IP", () => {
    const key = rateLimitKey("password-reset-account", "sarah@example.com")
    expect(key).toMatch(/^password-reset-account:[a-f0-9]{64}$/)
    expect(key).not.toContain("sarah@example.com")
  })

  it("returns the database decision and passes fixed-window bounds", async () => {
    rpcSpy.mockResolvedValue({ data: false, error: null })
    await expect(consumeRateLimit("key", 3, 3600)).resolves.toEqual({
      allowed: false,
    })
    expect(rpcSpy).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "key",
      p_max: 3,
      p_window_seconds: 3600,
    })
  })

  it("fails open when the limiter database call fails", async () => {
    rpcSpy.mockResolvedValue({ data: null, error: { message: "unavailable" } })
    await expect(consumeRateLimit("key", 3, 3600)).resolves.toEqual({
      allowed: true,
      degraded: true,
    })
  })

  it("uses the first forwarded address", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
    })
    expect(clientIpFrom(headers)).toBe("203.0.113.7")
  })
})
