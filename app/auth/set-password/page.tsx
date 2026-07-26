import { SetPasswordForm } from "./set-password-form"
import { PLATFORM_NAME } from "@/lib/public-identity"

export default function SetPasswordPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950">
      {/* Background decorative elements (mirrors login) */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-red-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-slate-800 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="relative z-10 w-full max-w-md px-4">
        <SetPasswordForm />
      </div>

      <div className="absolute bottom-8 left-0 right-0 z-10 text-center">
        <p className="text-slate-500 text-sm font-medium tracking-widest uppercase">
          {PLATFORM_NAME}
        </p>
      </div>
    </div>
  )
}
