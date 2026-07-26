"use client"

import { useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { PLATFORM_NAME } from "@/lib/public-identity"

export default function AdminLoginPage() {
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

    // Only admin_users members belong on the console; client accounts are
    // signed straight back out so the wrong-surface session never sticks.
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle()

    if (!adminRow) {
      await supabase.auth.signOut()
      setError("This account doesn't have operator access. Use the client portal sign in.")
      setSubmitting(false)
      return
    }

    startTransition(() => {
      router.push("/admin")
      router.refresh()
    })
  }


  return (
    <div data-surface="admin" className="dark min-h-screen flex bg-background w-full text-foreground antialiased">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-[#111] p-12 shrink-0 border-r border-white/5">
        <div>
          <span className="font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase font-bold">
            {PLATFORM_NAME}
          </span>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
              <ShieldCheck className="w-5 h-5 text-white/60" />
            </div>
            <h1 className="font-serif text-[38px] text-white leading-[1.1] tracking-tight">
              Admin<br />Control<br />Center.
            </h1>
          </div>
          <p className="text-white/40 text-[13px] font-sans leading-relaxed">
            Manage your clients, track expiring documents, and generate comprehensive PDF reports seamlessly.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[9px] tracking-widest text-white/20 uppercase font-bold">Operator Access</p>
          <div className="flex items-center gap-2 text-white/60 text-[13px] font-sans">
             <div className="w-2 h-2 rounded-full bg-success"></div> Secure sign-in
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0a0a0a]">
        <div className="w-full max-w-sm space-y-10">

          {/* Header */}
          <div className="space-y-2">
            <h2 className="font-serif text-[28px] text-white tracking-tight">Admin Sign in</h2>
            <p className="text-[#999] text-[13px] font-sans">
              Enter your administrator credentials to access the console.
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[9px] font-mono uppercase tracking-[0.25em] text-[#999] font-bold"
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
                className="w-full h-12 border border-white/10 bg-[#151515] rounded-sm px-4 text-[14px] text-white placeholder:text-[#555] outline-none focus:border-white/30 transition-colors font-sans"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="password"
                  className="block text-[9px] font-mono uppercase tracking-[0.25em] text-[#999] font-bold"
                >
                  Password
                </label>
                <a
                  href="/login/forgot"
                  className="text-[12px] text-[#999] border-b border-white/10 transition-colors hover:text-white hover:border-white/40"
                >
                  Forgot?
                </a>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-12 border border-white/10 bg-[#151515] rounded-sm px-4 text-[14px] text-white placeholder:text-[#555] outline-none focus:border-white/30 transition-colors font-sans"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[12px] text-danger font-sans">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || isPending}
              className="w-full h-12 bg-white hover:bg-white/90 text-black rounded-sm font-sans text-[13px] font-bold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting || isPending ? "Authenticating…" : "Sign in to console"}
            </button>
          </form>


        </div>
      </div>
    </div>
  )
}
