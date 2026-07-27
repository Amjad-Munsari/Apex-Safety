"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ShieldCheck, CheckCircle2 } from "lucide-react"
import { PLATFORM_NAME } from "@/lib/public-identity"

/**
 * Styled to match /login — cream field, hairline inputs, near-black button.
 * The shadcn Card/Input/Button components were dropped in favour of the same
 * plain markup /login uses: those components read theme tokens, which resolve
 * light, and this page was drawing them over a hardcoded dark background.
 *
 * Only the presentation changed. The session check, validation rules, Supabase
 * call, and redirect timing are exactly as they were.
 */
export function SetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  // The invite link routes through /auth/confirm, which verifies the token_hash
  // (verifyOtp) and sets session cookies before redirecting here. If there's no
  // session, the link was already used or expired.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setHasSession(!!data.user))
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    setTimeout(() => {
      router.push("/")
      router.refresh()
    }, 1200)
  }

  const inputClass =
    "w-full h-12 border border-[#e5e1d8] bg-white rounded-sm px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#b6b0a6] outline-none focus:border-[#1a1a1a] transition-colors"

  const buttonClass =
    "group w-full h-12 bg-[#1a1a1a] hover:bg-black text-[#fbfaf5] rounded-sm text-[13px] font-bold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"

  return (
    <div>
      {/* Wordmark — same lockup as /login */}
      <div className="text-center mb-12">
        <div className="w-12 h-12 mx-auto rounded-full border border-black/10 bg-white shadow-sm flex items-center justify-center mb-5">
          <ShieldCheck className="w-6 h-6 text-[#1a1a1a]" />
        </div>
        <h1 className="font-serif text-[32px] text-[#1a1a1a] tracking-tight leading-tight">
          {PLATFORM_NAME}
        </h1>
        <p className="font-mono text-[9px] tracking-[0.3em] text-[#3b8273] uppercase font-bold mt-3">
          Set your password
        </p>
      </div>

      {done ? (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <CheckCircle2 className="h-9 w-9 text-[#3b8273]" />
          <p className="text-[14px] text-[#1a1a1a] font-medium">
            Password set — signing you in…
          </p>
        </div>
      ) : hasSession === false ? (
        <div className="space-y-5">
          <p className="text-[13px] leading-relaxed text-[#1a1a1a]">
            This link has expired or was already used. Ask your administrator to resend your
            invite.
          </p>
          <button type="button" onClick={() => router.push("/auth/login")} className={buttonClass}>
            Go to sign in
            <span
              aria-hidden
              className="transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[3px]"
            >
              →
            </span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="block text-[9px] font-mono uppercase tracking-[0.25em] text-[#888] font-bold"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="block text-[9px] font-mono uppercase tracking-[0.25em] text-[#888] font-bold"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          {error && <p className="text-[12px] text-[oklch(0.50_0.16_25)]">{error}</p>}

          <button type="submit" disabled={loading || hasSession === null} className={buttonClass}>
            {loading ? "Setting password…" : "Set password & continue"}
            {!loading && (
              <span
                aria-hidden
                className="transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[3px]"
              >
                →
              </span>
            )}
          </button>
        </form>
      )}
    </div>
  )
}
