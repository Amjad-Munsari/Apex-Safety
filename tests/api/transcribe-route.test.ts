// Tests for POST /api/transcribe — the dictation transcription route.
//
// Mock strategy: spies declared BEFORE vi.mock factories (hoisting-safe
// pattern, same as tests/proposals/sign-route.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ── Spies (declared before vi.mock so hoisting can close over them) ───────────

const generateTextSpy = vi.fn()
const getUserSpy = vi.fn()
const isDemoModeSpy = vi.fn()

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateTextSpy(...args),
}))

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: () => ({
    chat: (modelId: string) => ({ modelId }),
  }),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getUser: () => getUserSpy(),
  isDemoMode: () => isDemoModeSpy(),
}))

import { POST } from "@/app/api/transcribe/route"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: BodyInit | null, contentType = "audio/wav"): Request {
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: contentType ? { "Content-Type": contentType } : undefined,
    body,
  })
}

const WAV_BYTES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]) // "RIFF"...

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    getUserSpy.mockResolvedValue({ id: "user-1" })
    isDemoModeSpy.mockResolvedValue(false)
    generateTextSpy.mockResolvedValue({ text: "  Fire warden count is three.  " })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 401 when there is no user and demo mode is off", async () => {
    getUserSpy.mockResolvedValue(null)

    const res = await POST(makeRequest(WAV_BYTES))

    expect(res.status).toBe(401)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("allows demo mode without a user", async () => {
    getUserSpy.mockResolvedValue(null)
    isDemoModeSpy.mockResolvedValue(true)

    const res = await POST(makeRequest(WAV_BYTES))

    expect(res.status).toBe(200)
  })

  it("returns 503 when OPENROUTER_API_KEY is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")

    const res = await POST(makeRequest(WAV_BYTES))

    expect(res.status).toBe(503)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("returns 415 for non-WAV content types", async () => {
    const res = await POST(makeRequest(WAV_BYTES, "audio/webm"))

    expect(res.status).toBe(415)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("returns 400 for an empty payload", async () => {
    const res = await POST(makeRequest(new Uint8Array(0)))

    expect(res.status).toBe(400)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("returns 413 for oversized payloads", async () => {
    const res = await POST(makeRequest(new Uint8Array(4 * 1024 * 1024 + 1)))

    expect(res.status).toBe(413)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("transcribes via an audio file part and returns trimmed text", async () => {
    const res = await POST(makeRequest(WAV_BYTES))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: "Fire warden count is three." })

    expect(generateTextSpy).toHaveBeenCalledTimes(1)
    const call = generateTextSpy.mock.calls[0][0] as {
      model: { modelId: string }
      temperature: number
      messages: Array<{ role: string; content: Array<Record<string, unknown>> }>
    }
    expect(call.model.modelId).toBe("google/gemini-2.5-flash")
    expect(call.temperature).toBe(0)
    const parts = call.messages[0].content
    expect(parts[0].type).toBe("text")
    const filePart = parts[1] as { type: string; mediaType: string; data: Uint8Array }
    expect(filePart.type).toBe("file")
    expect(filePart.mediaType).toBe("audio/wav")
    expect(Array.from(filePart.data.slice(0, 4))).toEqual([0x52, 0x49, 0x46, 0x46])
  })

  it("honours the OPENROUTER_STT_MODEL override", async () => {
    vi.stubEnv("OPENROUTER_STT_MODEL", "openai/gpt-4o-audio-preview")
    vi.resetModules()
    const { POST: freshPOST } = await import("@/app/api/transcribe/route")

    const res = await freshPOST(makeRequest(WAV_BYTES))

    expect(res.status).toBe(200)
    const call = generateTextSpy.mock.calls[0][0] as { model: { modelId: string } }
    expect(call.model.modelId).toBe("openai/gpt-4o-audio-preview")
  })

  it("returns 502 when the model call fails", async () => {
    generateTextSpy.mockRejectedValue(new Error("upstream boom"))

    const res = await POST(makeRequest(WAV_BYTES))

    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: string }).error).toMatch(/try again/i)
  })
})
