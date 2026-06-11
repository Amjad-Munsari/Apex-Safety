// Tests for POST /api/transcribe — the dictation transcription route.
//
// Two-stage pipeline: OpenRouter's /audio/transcriptions endpoint (mocked via
// global fetch) does the hearing, then a text model (mocked via generateText)
// formats the transcript for the field.
//
// Mock strategy: spies declared BEFORE vi.mock factories (hoisting-safe
// pattern, same as tests/proposals/sign-route.test.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// ── Spies (declared before vi.mock so hoisting can close over them) ───────────

const generateTextSpy = vi.fn()
const getUserSpy = vi.fn()
const isDemoModeSpy = vi.fn()
const fetchSpy = vi.fn()

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

/** Minimal Response-shaped object — avoids jsdom/undici realm issues. */
function sttResponse(text: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ text }),
    text: async () => JSON.stringify({ text }),
  }
}

function sttBodyOfLastCall(): { model: string; input_audio: { data: string; format: string }; language: string } {
  return JSON.parse((fetchSpy.mock.calls[0][1] as { body: string }).body)
}

function formatterPromptOfLastCall(): string {
  return (generateTextSpy.mock.calls[0][0] as { prompt: string }).prompt
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    vi.stubGlobal("fetch", fetchSpy)
    getUserSpy.mockResolvedValue({ id: "user-1" })
    isDemoModeSpy.mockResolvedValue(false)
    fetchSpy.mockResolvedValue(sttResponse("  fire warden count is three  "))
    generateTextSpy.mockResolvedValue({ text: "Fire warden count is 3." })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("returns 401 when there is no user and demo mode is off", async () => {
    getUserSpy.mockResolvedValue(null)

    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
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
    expect(fetchSpy).not.toHaveBeenCalled()
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
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns 400 when the audio part is missing", async () => {
    const res = await POST(makeRequest(null, { label: "Premises name" }))

    expect(res.status).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns 413 for oversized payloads", async () => {
    const res = await POST(makeRequest(new Uint8Array(4 * 1024 * 1024 + 1)))

    expect(res.status).toBe(413)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("sends the WAV to OpenRouter's transcription endpoint as base64", async () => {
    const audio = makeAudioBytes(2)

    const res = await POST(makeRequest(audio))

    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/audio/transcriptions")
    const init = fetchSpy.mock.calls[0][1] as { headers: Record<string, string> }
    expect(init.headers.Authorization).toBe("Bearer test-key")

    const body = sttBodyOfLastCall()
    expect(body.model).toBe("openai/whisper-large-v3")
    expect(body.language).toBe("en")
    expect(body.input_audio.format).toBe("wav")
    expect(body.input_audio.data).toBe(Buffer.from(audio).toString("base64"))
  })

  it("returns the raw transcript without a formatting pass when no context is sent", async () => {
    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(await res.json()).toEqual({ text: "fire warden count is three" })
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("formats the transcript for the field when context is sent", async () => {
    const res = await POST(
      makeRequest(makeAudioBytes(2), {
        label: "Number of trained fire wardens",
        kind: "number",
        min: 0,
        max: 999,
      })
    )

    expect(await res.json()).toEqual({ text: "Fire warden count is 3." })
    expect(generateTextSpy).toHaveBeenCalledTimes(1)
    const call = generateTextSpy.mock.calls[0][0] as { model: { modelId: string }; temperature: number }
    expect(call.model.modelId).toBe("google/gemini-2.5-flash")
    expect(call.temperature).toBe(0)

    const prompt = formatterPromptOfLastCall()
    expect(prompt).toContain('"Number of trained fire wardens"')
    expect(prompt).toContain("ONLY the numeric value as digits")
    expect(prompt).toContain("between 0 and 999")
    expect(prompt).toContain("fire warden count is three") // the transcript itself
  })

  it("gives the formatter only the transcript — no domain phrases it could parrot", async () => {
    fetchSpy.mockResolvedValue(sttResponse("the premises name is hallam house"))

    await POST(makeRequest(makeAudioBytes(2), { label: "Premises name", kind: "text" }))

    const prompt = formatterPromptOfLastCall()
    // Regression: an earlier prompt listed example fire-safety terms, and the
    // model echoed them back as hallucinated transcripts of silent audio.
    expect(prompt).not.toMatch(/fire warden|compartmentation|PAS 79|means of escape/i)
    expect(prompt).toContain("Use ONLY words from the transcript")
  })

  it("returns empty text when the ASR hears nothing, skipping the formatter", async () => {
    fetchSpy.mockResolvedValue(sttResponse("   "))

    const res = await POST(makeRequest(makeAudioBytes(2), { label: "Premises name" }))

    expect(await res.json()).toEqual({ text: "" })
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it("maps the formatter's NO_SPEECH sentinel to empty text", async () => {
    generateTextSpy.mockResolvedValue({ text: " NO_SPEECH. " })

    const res = await POST(makeRequest(makeAudioBytes(2), { label: "Premises name" }))

    expect(await res.json()).toEqual({ text: "" })
  })

  it("falls back to the raw transcript when the formatter fails", async () => {
    generateTextSpy.mockRejectedValue(new Error("formatter down"))

    const res = await POST(makeRequest(makeAudioBytes(2), { label: "Premises name" }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: "fire warden count is three" })
  })

  it("rejects transcripts longer than the clip could physically contain", async () => {
    // ~1.5s of audio cannot hold a 40-word paragraph — that's confabulation.
    fetchSpy.mockResolvedValue(
      sttResponse(Array.from({ length: 40 }, (_, i) => `word${i}`).join(" "))
    )

    const res = await POST(makeRequest(makeAudioBytes(1.5)))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: "" })
  })

  it("keeps plausible transcripts for their clip length", async () => {
    const fifteenWords = Array.from({ length: 15 }, (_, i) => `word${i}`).join(" ")
    fetchSpy.mockResolvedValue(sttResponse(fifteenWords))

    const res = await POST(makeRequest(makeAudioBytes(6)))

    expect(await res.json()).toEqual({ text: fifteenWords })
  })

  it("honours the OPENROUTER_STT_MODEL override", async () => {
    vi.stubEnv("OPENROUTER_STT_MODEL", "openai/gpt-4o-mini-transcribe")
    vi.resetModules()
    const { POST: freshPOST } = await import("@/app/api/transcribe/route")

    const res = await freshPOST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(200)
    expect(sttBodyOfLastCall().model).toBe("openai/gpt-4o-mini-transcribe")
  })

  it("returns 502 when the STT request fails", async () => {
    fetchSpy.mockResolvedValue(sttResponse("", 500))

    const res = await POST(makeRequest(makeAudioBytes(2)))

    expect(res.status).toBe(502)
    expect(((await res.json()) as { error: string }).error).toMatch(/try again/i)
  })
})
