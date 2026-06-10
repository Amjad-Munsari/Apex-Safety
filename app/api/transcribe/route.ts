import { NextResponse } from "next/server"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { getUser, isDemoMode } from "@/lib/auth-helpers"

// Audio transcription for the form dictation mics (hooks/use-stt.ts).
// The client records, converts to 16 kHz mono WAV (lib/audio/wav.ts) and POSTs
// the raw bytes here; we forward them to an audio-capable model on OpenRouter
// and return the verbatim transcript.

// Dictation clips are short (capped at 2 min client-side) so a flash-tier
// Gemini model is effectively free. Override without a deploy if needed.
const STT_MODEL = process.env.OPENROUTER_STT_MODEL || "google/gemini-2.5-flash"

// 2 min of 16 kHz mono 16-bit WAV is ~3.9 MB — anything bigger is not a clip
// from our recorder. Also keeps us under Vercel's 4.5 MB request body limit.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024

const TRANSCRIBE_PROMPT = [
  "Transcribe the spoken audio verbatim into British English text.",
  "The speaker is dictating an answer on a fire-safety / risk-assessment form, so expect terms like fire warden, compartmentation, FRA, PAS 79, means of escape.",
  "Return ONLY the transcribed words — no quotes, no commentary, no markdown.",
  "If the audio contains no intelligible speech, return an empty response.",
].join(" ")

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

  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()
  if (contentType !== "audio/wav") {
    return NextResponse.json(
      { error: `Unsupported audio type "${contentType ?? "unknown"}" — send audio/wav.` },
      { status: 415 }
    )
  }

  const audio = new Uint8Array(await request.arrayBuffer())
  if (audio.byteLength === 0) {
    return NextResponse.json({ error: "Empty audio payload." }, { status: 400 })
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Recording too long — keep dictation under 2 minutes." }, { status: 413 })
  }

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
            { type: "text", text: TRANSCRIBE_PROMPT },
            { type: "file", data: audio, mediaType: "audio/wav" },
          ],
        },
      ],
    })

    return NextResponse.json({ text: text.trim() })
  } catch (err) {
    console.error("Transcription failed:", err)
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 502 }
    )
  }
}
