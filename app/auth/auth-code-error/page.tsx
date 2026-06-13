import Link from "next/link"

export default function AuthCodeErrorPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="relative z-10 w-full max-w-md text-center text-foreground space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Link expired or invalid</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          This sign-in or invite link couldn&apos;t be verified — it may have already been used or
          timed out. Ask your administrator to resend it, or try signing in again.
        </p>
        <Link
          href="/auth/login"
          className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-md px-6 py-3 transition-colors"
        >
          Go to sign in
        </Link>
      </div>
    </div>
  )
}
