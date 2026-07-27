import { SetPasswordForm } from "./set-password-form"
import { PLATFORM_NAME } from "@/lib/public-identity"

/**
 * Layout mirrors /login exactly — same cream field, same 360px column, same
 * quiet footer.
 *
 * It previously carried the older dark treatment (a hardcoded slate background
 * with red and yellow blur blobs). That stranded the page visually once /login
 * was redesigned, and it put light-theme card tokens on a hand-painted dark
 * background, so the card rendered pale grey on navy. Nothing here hardcodes a
 * background any more, so the page cannot drift out of step with the theme.
 */
export default function SetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-[#fbfaf5] px-6 py-10">
      <div className="w-full max-w-[360px] flex-1 flex flex-col justify-center animate-in-fade">
        <SetPasswordForm />
      </div>

      <div className="w-full flex items-center justify-between text-[11px] text-[#bbb]">
        <span>{PLATFORM_NAME}</span>
      </div>
    </div>
  )
}
