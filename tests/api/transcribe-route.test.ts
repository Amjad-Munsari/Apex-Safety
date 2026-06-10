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

const WAV_HEADER_BYTES = 44
const WAV_BYTES_PER_SECOND = 16_000 * 2

/** Build a WAV-shaped payload representing `seconds` of audio. */
function makeAudioBytes(seconds: number): Uint8Array {
  const bytes = new Uint8Array(WAV_HEADER_BYTES + Math.round(seconds * WAV_BYTES_PER_SECOND))
  bytes.set([0x52, 0x49, 0x46, 0x46]) // "RIFF"
  return bytes
}

// jsdom's FormData is not compatible with undici's Request (request.formData()
// hangs), so build the multipart body by hand — which is also exactly what
// goes over the wire in production.
function makeRequest(
  audio: Uint8Array | null,
  context?: Record<string, unknown>
): Request {
  const boundary = "----vitest-boundary-1748"
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  if (audio) {
    parts.push(
      enc.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="dictation.wav"\r\nContent-Type: audio/wav\r\n\r\n`
      )
    )
    parts.push(audio)
    parts.push(enc.encode("\r\n"))
  }
  if (context) {
    parts.push(
      enc.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="context"\r\n\r\n${JSON.stringify(context)}\r\n`
      )
    )
  }
  parts.push(enc.encode(`--${boundary}--\r\n`))

  const body = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0))
  let offset = 0
  for (const p of parts) {
    body.set(p, offset)
    offset += p.byteLength
  }

  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: body as unknown as BodyInit,
  })
}

function promptOfLastCall(): string {
  const call = generateTextSpy.mock.calls[0][0] as {
    messages: Array<{ content: Array<{ type: string; text?: string }> }>
  }
  return call.messages[0].content[0].text ?? ""
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    getUserSpy.mockResolvedValue({ id: "user-1" })
    isDemoModeSpy.mockResolvedValue(false)
    generateTextSpy.mockResolvedValue({ text: "  Fire warden count is 3.  " })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 401 when there is no user and demo mode is off", async () => {
    getUserSpy.mockResolvedValue(null)

    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(401)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("allows demo mode without a user", async () => {
    getUserSpy.mockResolvedValue(null)
    isDemoModeSpy.mockResolvedValue(true)

    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(200)
  })

  it("returns 503 when OPENROUTER_API_KEY is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "")

    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(503)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("returns 415 for non-multipart bodies", async () => {
    const res = await POST(
      new Request("http://localhost/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: makeAudioBytes(2) as unknown as BodyInit,
      })
    )

    expect(res.status).toBe(415)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("returns 400 when the audio part is missing", async () => {
    const res = await POST(makeRequest(null, { label: "Premises name" }))

    expect(res.status).toBe(400)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("returns 413 for oversized payloads", async () => {
    const res = await POST(makeRequest(new Uint8Array(4 * 1024 * 1024 + 1)))

    expect(res.status).toBe(413)
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("transcribes via an audio file part and returns trimmed text", async () => {
    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: "Fire warden count is 3." })

    expect(generateTextSpy).toHaveBeenCalledTimes(1)
    const call = generateTextSpy.mock.calls[0][0] as {
      model: { modelId: string }
      temperature: number
      messages: Array<{ role: string; content: Array<Record<string, unknown>> }>
    }
    expect(call.model.modelId).toBe("google/gemini-2.5-flash")
    expect(call.temperature).toBe(0)
    const filePart = call.messages[0].content[1] as { type: string; mediaType: string; data: Uint8Array }
    expect(filePart.type).toBe("file")
    expect(filePart.mediaType).toBe("audio/wav")
    expect(Array.from(filePart.data.slice(0, 4))).toEqual([0x52, 0x49, 0x46, 0x46])
  })

  it("includes field context in the prompt when provided", async () => {
    await POST(
      makeRequest(makeAudioBytes(2), {
        label: "Responsible person",
        kind: "text",
        placeholder: "Name of duty holder",
      })
    )

    const prompt = promptOfLastCall()
    expect(prompt).toContain('"Responsible person"')
    expect(prompt).toContain("Name of duty holder")
    expect(prompt).toContain("single-line input")
  })

  it("adds number-field rules including bounds", async () => {
    await POST(
      makeRequest(makeAudioBytes(2), {
        label: "Number of trained fire wardens",
        kind: "number",
        min: 0,
        max: 999,
      })
    )

    const prompt = promptOfLastCall()
    expect(prompt).toContain("ONLY the numeric value as digits")
    expect(prompt).toContain("between 0 and 999")
  })

  it("never primes the model with domain phrases it could parrot", async () => {
    await POST(makeRequest(makeAudioBytes(2)))

    const prompt = promptOfLastCall()
    // Regression: an earlier prompt listed example fire-safety terms, and the
    // model echoed them back as hallucinated transcripts of silent audio.
    expect(prompt).not.toMatch(/fire warden|compartmentation|PAS 79|means of escape/i)
    expect(prompt).toContain("NO_SPEECH")
  })

  it("maps the NO_SPEECH sentinel to empty text", async () => {
    generateTextSpy.mockResolvedValue({ text: " NO_SPEECH. " })

    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: "" })
  })

  it("rejects transcripts longer than the clip could physically contain", async () => {
    // ~1.5s of audio cannot hold a 40-word paragraph — that's confabulation.
    generateTextSpy.mockResolvedValue({
      text: Array.from({ length: 40 }, (_, i) => `word${i}`).join(" "),
    })

    const res = await POST(makeRequest(makeAudioBytes(1.5)))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: "" })
  })

  it("keeps plausible transcripts for their clip length", async () => {
    const fifteenWords = Array.from({ length: 15 }, (_, i) => `word${i}`).join(" ")
    generateTextSpy.mockResolvedValue({ text: fifteenWords })

    const res = await POST(makeRequest(makeAudioBytes(6)))

    expect(await res.json()).toEqual({ text: fifteenWords })
  })

  it("honours the OPENROUTER_STT_MODEL override", async () => {
    vi.stubEnv("OPENROUTER_STT_MODEL", "openai/gpt-4o-audio-preview")
    vi.resetModules()
    const { POST: freshPOST } = await import("@/app/api/transcribe/route")

    const res = await freshPOST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(200)
    const call = generateTextSpy.mock.calls[0][0] as { model: { modelId: string } }
    expect(call.model.modelId).toBe("openai/gpt-4o-audio-preview")
  })

  it("returns 502 when the model call fails", async () => {
    generateTextSpy.mockRejectedValue(new Error("upstream boom"))

    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: string }).error).toMatch(/try again/i)
  })
})
