"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PLATFORM_NAME } from "@/lib/public-identity"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }

    // Operator accounts don't belong on the client portal: same admin_users
    // membership check the middleware uses, enforced here so the wrong-surface
    // session never sticks.
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle()

    if (adminRow) {
      await supabase.auth.signOut()
      setError("This is the client portal — operator accounts sign in via Operator access below.")
      setSubmitting(false)
      return
    }

    startTransition(() => {
      router.push("/client")
      router.refresh()
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#fbfaf5] px-6 py-10">
      <div className="w-full max-w-[360px] flex-1 flex flex-col justify-center animate-in-fade">

        {/* Wordmark */}
        <div className="text-center mb-12">
          <div className="w-12 h-12 mx-auto rounded-full border border-black/10 bg-white shadow-sm flex items-center justify-center mb-5">
            <ShieldCheck className="w-6 h-6 text-[#1a1a1a]" />
          </div>
          <h1 className="font-serif text-[32px] text-[#1a1a1a] tracking-tight leading-tight">
            {PLATFORM_NAME}
          </h1>
          <p className="font-mono text-[9px] tracking-[0.3em] text-[#3b8273] uppercase font-bold mt-3">
            Client Portal
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-[9px] font-mono uppercase tracking-[0.25em] text-[#888] font-bold"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="w-full h-12 border border-[#e5e1d8] bg-white rounded-sm px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#b6b0a6] outline-none focus:border-[#1a1a1a] transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="password"
                className="block text-[9px] font-mono uppercase tracking-[0.25em] text-[#888] font-bold"
              >
                Password
              </label>
              <Link
                href="/login/forgot"
                className="text-[12px] text-[#888] border-b border-[#e5e1d8] transition-colors hover:text-[#1a1a1a] hover:border-[#1a1a1a]"
              >
                Forgot?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-12 border border-[#e5e1d8] bg-white rounded-sm px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#b6b0a6] outline-none focus:border-[#1a1a1a] transition-colors"
            />
          </div>

          {error && <p className="text-[12px] text-[oklch(0.50_0.16_25)]">{error}</p>}

          <button
            type="submit"
            disabled={submitting || isPending}
            className="group w-full h-12 bg-[#1a1a1a] hover:bg-black text-[#fbfaf5] rounded-sm text-[13px] font-bold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting || isPending ? "Signing in…" : "Sign in"}
            {!(submitting || isPending) && (
              <span
                aria-hidden
                className="transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[3px]"
              >
                →
              </span>
            )}
          </button>
        </form>

        {/* Prototype Demo Banner */}
        <div className="mt-8 pt-6 border-t border-[#e5e1d8] space-y-3">
          <div className="text-center">
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#3b8273] font-bold">
              Portfolio Prototype Access
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                document.cookie = "demo_mode=1; path=/; max-age=86400"
                router.push("/admin")
                router.refresh()
              }}
              className="py-2.5 px-3 bg-[#1a1a1a] text-white text-[11px] font-medium rounded-sm hover:bg-black transition-colors"
            >
              Demo Admin →
            </button>
            <button
              type="button"
              onClick={() => {
                document.cookie = "demo_mode=1; path=/; max-age=86400"
                router.push("/client")
                router.refresh()
              }}
              className="py-2.5 px-3 bg-[#3b8273] text-white text-[11px] font-medium rounded-sm hover:bg-[#2e685c] transition-colors"
            >
              Demo Client →
            </button>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="w-full flex items-center justify-between text-[11px] text-[#bbb]">
        <span>{PLATFORM_NAME}</span>
        <Link
          href="/login/admin"
          className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#bbb] transition-colors hover:text-[#1a1a1a]"
        >
          Operator access
        </Link>
      </div>
    </div>
  )
}
