import { LoginForm } from "./login-form"
import { PLATFORM_NAME } from "@/lib/public-identity"

/**
 * Same cream layout as /login. Previously used the older dark treatment
 * (hardcoded slate background plus red/yellow blur blobs) with light-theme
 * card tokens drawn over it.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center bg-[#fbfaf5] px-6 py-10">
      <div className="w-full max-w-[360px] flex-1 flex flex-col justify-center animate-in-fade">
        <LoginForm />
      </div>

      <div className="w-full flex items-center justify-between text-[11px] text-[#bbb]">
        <span>{PLATFORM_NAME}</span>
      </div>
    </div>
  )
}
