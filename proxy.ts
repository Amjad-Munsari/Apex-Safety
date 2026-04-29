import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/session"

// Next.js 16: proxy.ts replaces middleware.ts
// Named export `proxy` (not `middleware`)
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
