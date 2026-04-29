"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { ArrowRight, ShieldCheck } from "lucide-react"

const ADMIN_EMAILS = ["admin@test.com"]

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const destination = ADMIN_EMAILS.includes(email) ? "/admin" : "/client"
    router.push(destination)
    router.refresh()
  }

  function handleDemoMode() {
    setLoading(true)
    // Set a session cookie for demo mode bypass
    document.cookie = "demo_mode=1; path=/; max-age=3600"
    router.push("/client")
  }

  return (
    <div className="min-h-screen flex bg-[#fbfaf5]">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-[#1a1a1a] p-12 shrink-0">
        <div>
          <span className="font-mono text-[9px] tracking-[0.3em] text-white/30 uppercase font-bold">
            888 Safety & Training
          </span>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white/60" />
            </div>
            <h1 className="font-serif text-[38px] text-white leading-[1.1] tracking-tight">
              Client<br />Compliance<br />Portal.
            </h1>
          </div>
          <p className="text-white/40 text-[13px] font-sans leading-relaxed">
            Your statutory safety documentation, assessment reports, and consulting hours — all in one place.
          </p>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[9px] tracking-widest text-white/20 uppercase font-bold">Your consultant</p>
          <p className="text-white/60 text-[13px] font-sans">Matt Dineen</p>
          <p className="text-white/30 text-[11px] font-mono">matt@dineen-fire.co.uk</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-10">

          {/* Header */}
          <div className="space-y-2">
            <h2 className="font-serif text-[28px] text-[#1a1a1a] tracking-tight">Sign in</h2>
            <p className="text-[#999] text-[13px] font-sans">
              Use your email and password, or enter demo mode.
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
                className="w-full h-12 border border-[#e5e1d8] bg-white rounded-sm px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#bbb] outline-none focus:border-[#1a1a1a] transition-colors font-sans"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[9px] font-mono uppercase tracking-[0.25em] text-[#999] font-bold"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full h-12 border border-[#e5e1d8] bg-white rounded-sm px-4 text-[14px] text-[#1a1a1a] placeholder:text-[#bbb] outline-none focus:border-[#1a1a1a] transition-colors font-sans"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[12px] text-[#c0392b] font-sans">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#1a1a1a] hover:bg-black text-white rounded-sm font-sans text-[13px] font-bold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-[#e5e1d8]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#fbfaf5] px-4 text-[9px] font-mono uppercase tracking-[0.2em] text-[#bbb] font-bold">
                Demo access
              </span>
            </div>
          </div>

          {/* Demo Mode CTA */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDemoMode}
              disabled={loading}
              className="w-full h-14 border-2 border-[#1a1a1a] bg-transparent hover:bg-[#1a1a1a] text-[#1a1a1a] hover:text-white rounded-sm font-sans text-[13px] font-bold tracking-tight transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex items-center justify-center gap-3"
            >
              <span>Enter Demo Mode</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-[10px] text-[#bbb] font-sans leading-relaxed">
              Explore the portal using sample data. No account needed.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
