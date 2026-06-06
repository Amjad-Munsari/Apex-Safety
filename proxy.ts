import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/session"

// Next.js 16: proxy.ts replaces middleware.ts
// Named export `proxy` (not `middleware`)
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run the proxy on every path EXCEPT:
     * - api            (API routes carry their own auth / service-role secrets)
     * - auth           (Supabase OAuth callback + signout under /auth/*)
     * - _next/static   (static build assets)
     * - _next/image    (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt, manifest (metadata files)
     * - any path with a static asset file extension (images, fonts, etc.)
     *
     * /login/* IS matched on purpose: the proxy lets unauthenticated users
     * through but redirects already-authenticated users to their home surface.
     */
    "/((?!api|auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|map)$).*)",
  ],
}
