"use client"

import { useState } from "react"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { requestPasswordReset } from "./actions"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await requestPasswordReset(email)
    setSent(true)
    setSubmitting(false)
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
            Reset your password
          </h1>
          <p className="font-mono text-[9px] tracking-[0.3em] text-[#3b8273] uppercase font-bold mt-3">
            Client Portal
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-[14px] text-[#1a1a1a] leading-relaxed">
              If an account exists for <span className="font-bold">{email.trim()}</span>, we&apos;ve
              emailed it a link to choose a new password.
            </p>
            <p className="text-[12px] text-[#888] leading-relaxed">
              Nothing arrived after a few minutes? Check your spam folder, or try again.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-[13px] text-[#888] leading-relaxed -mt-4 mb-6 text-center">
              Enter the email you sign in with and we&apos;ll send you a reset link.
            </p>
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-[#1a1a1a] hover:bg-black text-[#fbfaf5] rounded-sm text-[13px] font-bold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center">
          <Link
            href="/login"
            className="text-[12px] text-[#888] border-b border-[#e5e1d8] transition-colors hover:text-[#1a1a1a] hover:border-[#1a1a1a]"
          >
            Back to sign in
          </Link>
        </p>
      </div>

      <div className="w-full flex items-center justify-between text-[11px] text-[#bbb]">
        <span>© {new Date().getFullYear()} 888 Safety &amp; Training Ltd</span>
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
