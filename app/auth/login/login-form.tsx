"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ShieldCheck } from "lucide-react"
import { PLATFORM_NAME } from "@/lib/public-identity"

/**
 * Styled to match /login. The shadcn Card/Input/Button/Tabs components were
 * dropped for the same plain markup /login uses — those read theme tokens that
 * resolve light, and this page was drawing them over a hardcoded dark
 * background.
 *
 * The password and magic-link modes are unchanged; the tab control is now a
 * two-item segmented switch instead of the shadcn Tabs component, so the whole
 * page has one visual language. Auth calls, redirect targets and error handling
 * are untouched.
 */
export function LoginForm() {
  const [mode, setMode] = useState<"password" | "magic">("password")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/")
      router.refresh()
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage("Check your email for the login link!")
    }
    setLoading(false)
  }

  const inputClass =
    "w-full h-12 border border-[#e5e1d8] bg-white rounded-sm px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#b6b0a6] outline-none focus:border-[#1a1a1a] transition-colors"

  const labelClass =
    "block text-[9px] font-mono uppercase tracking-[0.25em] text-[#888] font-bold"

  return (
    <div>
      {/* Wordmark — same lockup as /login */}
      <div className="text-center mb-10">
        <div className="w-12 h-12 mx-auto rounded-full border border-black/10 bg-white shadow-sm flex items-center justify-center mb-5">
          <ShieldCheck className="w-6 h-6 text-[#1a1a1a]" />
        </div>
        <h1 className="font-serif text-[32px] text-[#1a1a1a] tracking-tight leading-tight">
          {PLATFORM_NAME}
        </h1>
        <p className="font-mono text-[9px] tracking-[0.3em] text-[#3b8273] uppercase font-bold mt-3">
          Sign in
        </p>
      </div>

      {/* Mode switch */}
      <div
        role="tablist"
        aria-label="Sign-in method"
        className="inline-flex w-full rounded-sm border border-[#e5e1d8] overflow-hidden mb-6"
      >
        {(["password", "magic"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => {
              setMode(value)
              setError(null)
              setMessage(null)
            }}
            className={`flex-1 h-9 font-mono text-[9px] uppercase tracking-[0.2em] font-bold transition-colors ${
              mode === value
                ? "bg-[#1a1a1a] text-[#fbfaf5]"
                : "bg-white text-[#888] hover:text-[#1a1a1a]"
            }`}
          >
            {value === "password" ? "Password" : "Magic link"}
          </button>
        ))}
      </div>

      <form
        onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink}
        className="space-y-5"
      >
        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="name@company.com"
            className={inputClass}
          />
        </div>

        {mode === "password" && (
          <div className="space-y-1.5">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
        )}

        {error && <p className="text-[12px] text-[oklch(0.50_0.16_25)]">{error}</p>}
        {message && <p className="text-[12px] text-[#3b8273]">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="group w-full h-12 bg-[#1a1a1a] hover:bg-black text-[#fbfaf5] rounded-sm text-[13px] font-bold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading
            ? mode === "password"
              ? "Signing in…"
              : "Sending…"
            : mode === "password"
              ? "Sign in"
              : "Send magic link"}
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

      <p className="mt-8 text-center text-[12px] text-[#888]">
        First time here? Contact your administrator for an invite.
      </p>
    </div>
  )
}
