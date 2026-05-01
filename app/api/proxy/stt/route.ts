import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const audioFile = formData.get("file") as File

  if (!audioFile) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY

  if (!openRouterKey || openRouterKey.includes("placeholder")) {
    return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 500 })
  }

  const openRouterFormData = new FormData()
  openRouterFormData.append("file", audioFile)
  openRouterFormData.append("model", "openai/whisper-large-v3-turbo")

  try {
    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
      },
      body: openRouterFormData,
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("STT Proxy Error:", error)
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 })
  }
}
