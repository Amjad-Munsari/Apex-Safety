import { NextResponse } from "next/server"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { getUser, isDemoMode } from "@/lib/auth-helpers"
import type { DictationContext } from "@/hooks/use-stt"

// Audio transcription for the form dictation mics (hooks/use-stt.ts).
// The client records, converts to 16 kHz mono WAV (lib/audio/wav.ts) and POSTs
// multipart form data here: an `audio` file plus an optional `context` JSON
// blob describing the field being dictated into. We forward the audio to an
// audio-capable model on OpenRouter and return a value formatted for that field.

// Dictation clips are short (capped at 2 min client-side) so a flash-tier
// Gemini model is effectively free. Override without a deploy if needed.
const STT_MODEL = process.env.OPENROUTER_STT_MODEL || "google/gemini-2.5-flash"

// 2 min of 16 kHz mono 16-bit WAV is ~3.9 MB — anything bigger is not a clip
// from our recorder. Also keeps us under Vercel's 4.5 MB request body limit.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024

// The model must say this — not an empty string, which models resist — when
// there is nothing intelligible to transcribe. Mapped to "" before returning.
const NO_SPEECH_SENTINEL = "NO_SPEECH"

// Confabulation guard: fast natural speech tops out near 4 words/sec, so a
// transcript meaningfully past that rate was invented, not heard. The +8
// floor keeps very short clips ("John Smith") from tripping it.
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

  if (!process.env.OPENROUTER_API_KEY) {
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

  const openai = createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  })

  try {
    // .chat() pins the chat-completions endpoint — the only OpenRouter path
    // where the AI SDK maps audio file parts to `input_audio`.
    const { text } = await generateText({
      model: openai.chat(STT_MODEL),
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(context) },
            { type: "file", data: audio, mediaType: "audio/wav" },
          ],
        },
      ],
    })

    return NextResponse.json({ text: sanitizeTranscript(text, durationSeconds) })
  } catch (err) {
    console.error("Transcription failed:", err)
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 502 }
    )
  }
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

function buildPrompt(context: DictationContext | null): string {
  const lines = [
    "You are the speech-to-text engine behind a form field's dictation button.",
    "Convert the attached audio into the final value for that field.",
    "",
    "Strict rules:",
    "- Output ONLY words the speaker actually says. NEVER invent, infer, complete or embellish content — a wrong but plausible answer is worse than no answer.",
    `- If the audio is silent, only background noise, or unintelligible, output exactly: ${NO_SPEECH_SENTINEL}`,
    "- Drop filler words (um, er, you know) and false starts; when the speaker corrects themselves, keep only the correction.",
    "- Honour spoken editing commands: \"new line\" / \"next line\" → line break; \"comma\", \"full stop\" → punctuation.",
    "- Use British English spelling. Write numbers as digits (\"twenty five\" → 25).",
    "- Output the field value only — no quotes, labels, commentary or markdown.",
  ]

  if (context) {
    lines.push("", describeField(context))
  }

  return lines.join("\n")
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
  // means the model generated content instead of transcribing.
  const words = text.split(/\s+/).filter(Boolean).length
  if (words > Math.ceil(durationSeconds * MAX_WORDS_PER_SECOND) + 8) {
    console.warn(
      `Transcript rejected: ${words} words from a ${durationSeconds.toFixed(1)}s clip — likely hallucinated.`
    )
    return ""
  }

  return text
}
