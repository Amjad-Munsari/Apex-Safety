import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { PLATFORM_NAME } from "@/lib/public-identity"

/**
 * Same cream layout as /login. Previously a hardcoded dark background with
 * light-theme text tokens drawn over it.
 */
export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-[#fbfaf5] px-6 py-10">
      <div className="w-full max-w-[360px] flex-1 flex flex-col justify-center animate-in-fade">
        <div className="text-center mb-10">
          <div className="w-12 h-12 mx-auto rounded-full border border-black/10 bg-white shadow-sm flex items-center justify-center mb-5">
            <ShieldCheck className="w-6 h-6 text-[#1a1a1a]" />
          </div>
          <h1 className="font-serif text-[32px] text-[#1a1a1a] tracking-tight leading-tight">
            Link expired
          </h1>
          <p className="font-mono text-[9px] tracking-[0.3em] text-[#3b8273] uppercase font-bold mt-3">
            Verification failed
          </p>
        </div>

        <p className="text-[13px] leading-relaxed text-[#1a1a1a] text-center mb-6">
          This sign-in or invite link couldn&apos;t be verified — it may have already been used or
          timed out. Ask your administrator to resend it, or try signing in again.
        </p>

        <Link
          href="/auth/login"
          className="group w-full h-12 bg-[#1a1a1a] hover:bg-black text-[#fbfaf5] rounded-sm text-[13px] font-bold tracking-tight transition-colors flex items-center justify-center gap-2"
        >
          Go to sign in
          <span
            aria-hidden
            className="transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[3px]"
          >
            →
          </span>
        </Link>
      </div>

      <div className="w-full flex items-center justify-between text-[11px] text-[#bbb]">
        <span>{PLATFORM_NAME}</span>
      </div>
    </div>
  )
}
