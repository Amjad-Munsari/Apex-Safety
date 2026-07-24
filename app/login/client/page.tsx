import { redirect } from "next/navigation"

// /login is the client sign-in since the 2026-07 redesign; this route only
// survives for old bookmarks.
export default function LegacyClientLoginPage() {
  redirect("/login")
}
