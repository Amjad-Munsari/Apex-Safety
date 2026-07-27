import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"

import { PLATFORM_NAME } from "@/lib/public-identity"
import { confirmEmailLink } from "./actions"

/**
 * Interstitial for every emailed auth link (invite, password reset, magic link).
 *
 * This replaced a GET route handler that called `verifyOtp` the moment the URL
 * was fetched. Because the token is single-use, any mail scanner that prefetched
 * the link consumed it, and the recipient — clicking seconds later — got "Link
 * expired" while the session went to the scanner. Gmail does this to every link
 * it delivers.
 *
 * Rendering a button instead is the fix: this page touches nothing, and the
 * token is only spent by the POST behind a real click. The URL stays identical,
 * so links already sitting in inboxes keep working.
 */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Confirm your link",
  // Belt and braces: this URL carries a credential, so it must never be indexed
  // or archived even though it is unguessable and short-lived.
  robots: { index: false, follow: false, nocache: true },
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>
}) {
  const params = await searchParams
  const tokenHash = params.token_hash ?? ""
  const type = params.type ?? ""
  const next = params.next ?? "/"

  const missing = !tokenHash || !type

  const isInvite = type === "invite"
  const heading = isInvite ? "Confirm your invitation" : "Confirm it's you"
  const caption = isInvite ? "One step left" : "Secure link"
  const blurb = isInvite
    ? `Select the button below to finish setting up your ${PLATFORM_NAME} access.`
    : `Select the button below to continue to ${PLATFORM_NAME}.`

  return (
    <div className="min-h-screen flex flex-col items-center bg-[#fbfaf5] px-6 py-10">
      <div className="w-full max-w-[360px] flex-1 flex flex-col justify-center animate-in-fade">
        <div className="text-center mb-10">
          <div className="w-12 h-12 mx-auto rounded-full border border-black/10 bg-white shadow-sm flex items-center justify-center mb-5">
            <ShieldCheck className="w-6 h-6 text-[#1a1a1a]" />
          </div>
          <h1 className="font-serif text-[32px] text-[#1a1a1a] tracking-tight leading-tight">
            {missing ? "Link incomplete" : heading}
          </h1>
          <p className="font-mono text-[9px] tracking-[0.3em] text-[#3b8273] uppercase font-bold mt-3">
            {missing ? "Nothing to confirm" : caption}
          </p>
        </div>

        {missing ? (
          <p className="text-[13px] leading-relaxed text-[#1a1a1a] text-center">
            This address is missing the details needed to confirm it. Open the link directly from
            your email, or ask your consultant to resend it.
          </p>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-[#1a1a1a] text-center mb-6">{blurb}</p>

            <form action={confirmEmailLink}>
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next} />
              <button
                type="submit"
                className="group w-full h-12 bg-[#1a1a1a] hover:bg-black text-[#fbfaf5] rounded-sm text-[13px] font-bold tracking-tight transition-colors flex items-center justify-center gap-2"
              >
                {isInvite ? "Continue" : "Confirm and continue"}
                <span
                  aria-hidden
                  className="transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-[3px]"
                >
                  →
                </span>
              </button>
            </form>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-[#888]">
              This link works once and expires 24 hours after it was sent.
            </p>
          </>
        )}
      </div>

      <div className="w-full flex items-center justify-between text-[11px] text-[#bbb]">
        <span>{PLATFORM_NAME}</span>
      </div>
    </div>
  )
}
