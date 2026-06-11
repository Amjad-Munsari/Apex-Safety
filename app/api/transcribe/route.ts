import { NextResponse } from "next/server"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { getUser, isDemoMode } from "@/lib/auth-helpers"
import type { DictationContext } from "@/hooks/use-stt"

// Audio transcription for the form dictation mics (hooks/use-stt.ts).
// The client records, converts to 16 kHz mono WAV (lib/audio/wav.ts) and POSTs
// multipart form data here: an `audio` file plus an optional `context` JSON
// blob describing the field being dictated into.
//
// Two-stage pipeline, both stages on the existing OpenRouter key:
//   1. Hearing — OpenRouter's dedicated /audio/transcriptions endpoint with a
//      purpose-built ASR model (Whisper). Unlike a chat model fed audio, ASR
//      models don't complete from a prompt, so silence can't become invented
//      fire-safety prose.
//   2. Formatting — a cheap text model reshapes the verbatim transcript into
//      a value for the specific field (digits for numbers, single-line names,
//      spoken "new line" commands). Text-in/text-out: it can only work with
//      words Whisper actually heard. Best-effort — failures fall back to the
//      raw transcript.

const STT_MODEL = process.env.OPENROUTER_STT_MODEL || "openai/whisper-large-v3"
const FORMAT_MODEL = process.env.OPENROUTER_STT_FORMAT_MODEL || "google/gemini-2.5-flash"

// 2 min of 16 kHz mono 16-bit WAV is ~3.9 MB — anything bigger is not a clip
// from our recorder. Also keeps us under Vercel's 4.5 MB request body limit.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024

// The formatter must say this — not an empty string, which models resist —
// when the transcript holds nothing usable. Mapped to "" before returning.
const NO_SPEECH_SENTINEL = "NO_SPEECH"

// Confabulation guard: fast natural speech tops out near 4 words/sec, so a
// transcript meaningfully past that rate was invented, not heard (Whisper can
// loop on pure noise). The +8 floor keeps short clips from tripping it.
const MAX_WORDS_PER_SECOND = 5

// WAV layout produced by lib/audio/wav.ts — used to derive clip duration.
const WAV_HEADER_BYTES = 44
const WAV_BYTES_PER_SECOND = 16_000 * 2

// Transcribing a 2-minute clip can exceed the default function timeout.
export const maxDuration = 60

export async function POST(request: Request) {
  // Any signed-in user may dictate — the mic renders on both the admin and
  // client form surfaces. Demo mode (dev-only, see isDemoMode) has no user.
  const user = await getUser()
  if (!user && !(await isDemoMode())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "Transcription is not configured — OPENROUTER_API_KEY is missing." },
      { status: 503 }
    )
  }

  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Send multipart/form-data with an `audio` part." },
      { status: 415 }
    )
  }

  const form = await request.formData()
  // FormDataEntryValue is File | string — anything non-string is the upload.
  // (No instanceof: the File/Blob realm differs between runtimes and tests.)
  const audioPart = form.get("audio")
  if (!audioPart || typeof audioPart === "string" || audioPart.size === 0) {
    return NextResponse.json({ error: "Missing audio part." }, { status: 400 })
  }
  if (audioPart.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Recording too long — keep dictation under 2 minutes." }, { status: 413 })
  }

  const context = parseContext(form.get("context"))
  const audio = new Uint8Array(await audioPart.arrayBuffer())
  const durationSeconds = Math.max(0, (audio.byteLength - WAV_HEADER_BYTES) / WAV_BYTES_PER_SECOND)

  try {
    // Stage 1 — dedicated ASR. Empty transcript = nothing was said.
    const transcript = await transcribeAudio(audio, apiKey)
    if (!transcript) {
      return NextResponse.json({ text: "" })
    }

    // Stage 2 — field-aware formatting, best-effort.
    let value = transcript
    if (context) {
      try {
        value = await formatForField(transcript, context, apiKey)
      } catch (err) {
        console.error("Transcript formatting failed — returning raw transcript:", err)
      }
    }

    return NextResponse.json({ text: sanitizeTranscript(value, durationSeconds) })
  } catch (err) {
    console.error("Transcription failed:", err)
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 502 }
    )
  }
}

/** OpenRouter's dedicated speech-to-text endpoint (launched May 2026). */
async function transcribeAudio(audio: Uint8Array, apiKey: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: STT_MODEL,
      input_audio: {
        data: Buffer.from(audio).toString("base64"),
        format: "wav",
      },
      language: "en",
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`STT request failed (${res.status}): ${body.slice(0, 300)}`)
  }

  const json = (await res.json()) as { text?: string }
  return (json.text ?? "").trim()
}

/** Reshape the verbatim transcript into a value for the specific field. */
async function formatForField(
  transcript: string,
  context: DictationContext,
  apiKey: string
): Promise<string> {
  const openai = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  })

  // .chat() pins the chat-completions endpoint, matching the report pipeline.
  const { text } = await generateText({
    model: openai.chat(FORMAT_MODEL),
    temperature: 0,
    prompt: buildFormattingPrompt(transcript, context),
  })

  return text
}

function parseContext(raw: FormDataEntryValue | null): DictationContext | null {
  if (typeof raw !== "string" || !raw) return null
  try {
    const parsed = JSON.parse(raw) as DictationContext
    return typeof parsed === "object" && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

function buildFormattingPrompt(transcript: string, context: DictationContext): string {
  return [
    "Below is a verbatim speech-to-text transcript of someone dictating a value into a form field.",
    "Rewrite it as the final field value.",
    "",
    "Strict rules:",
    "- Use ONLY words from the transcript. NEVER add, infer, complete or embellish content — a wrong but plausible answer is worse than no answer.",
    `- If the transcript contains nothing usable for the field, output exactly: ${NO_SPEECH_SENTINEL}`,
    "- Drop filler words (um, er, you know) and false starts; when the speaker corrects themselves, keep only the correction.",
    "- Honour spoken editing commands: \"new line\" / \"next line\" → line break; \"comma\", \"full stop\" → punctuation.",
    "- Use British English spelling. Write numbers as digits (\"twenty five\" → 25).",
    "- Output the field value only — no quotes, labels, commentary or markdown.",
    "",
    describeField(context),
    "",
    "Transcript:",
    transcript,
  ].join("\n")
}

function describeField(context: DictationContext): string {
  const parts: string[] = []
  const label = context.label?.slice(0, 200)
  parts.push(label ? `The field being dictated into is "${label}".` : "Field details:")
  if (context.placeholder) parts.push(`Its placeholder reads: "${context.placeholder.slice(0, 200)}".`)
  if (context.helpText) parts.push(`Its help text reads: "${context.helpText.slice(0, 200)}".`)

  switch (context.kind) {
    case "number": {
      let rule = "It is a number field: output ONLY the numeric value as digits — no words, units or punctuation."
      if (typeof context.min === "number" && typeof context.max === "number") {
        rule += ` The value should be between ${context.min} and ${context.max}.`
      }
      parts.push(rule)
      break
    }
    case "text":
      parts.push(
        "It is a single-line input: output one line with no trailing punctuation, capitalising proper nouns (names, places, organisations) correctly."
      )
      break
    case "textarea":
      parts.push(
        "It is a multi-line input: output well-punctuated sentences, with line breaks only where the speaker dictates them."
      )
      break
  }

  return parts.join(" ")
}

function sanitizeTranscript(raw: string, durationSeconds: number): string {
  const text = raw.trim()
  if (!text) return ""

  // Sentinel, with or without the wrapping the model sometimes adds.
  if (text.replace(/[^A-Z_]/gi, "").toUpperCase() === NO_SPEECH_SENTINEL) return ""

  // Confabulation guard: more words than the clip could physically contain
  // means a model generated content instead of transcribing.
  const words = text.split(/\s+/).filter(Boolean).length
  if (words > Math.ceil(durationSeconds * MAX_WORDS_PER_SECOND) + 8) {
    console.warn(
      `Transcript rejected: ${words} words from a ${durationSeconds.toFixed(1)}s clip — likely hallucinated.`
    )
    return ""
  }

  return text
}
