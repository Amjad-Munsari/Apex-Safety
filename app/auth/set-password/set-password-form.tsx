"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Loader2, CheckCircle2 } from "lucide-react"

export function SetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  // The invite link routes through /auth/callback, which exchanges the code for
  // a session before redirecting here. If there's no session, the link was
  // already used or expired.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setHasSession(!!data.user))
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
    setTimeout(() => {
      router.push("/")
      router.refresh()
    }, 1200)
  }

  return (
    <Card className="w-full max-w-md border-0 bg-card/80 backdrop-blur-xl text-foreground shadow-2xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-3xl font-bold tracking-tight">Set your password</CardTitle>
        <CardDescription className="text-muted-foreground">
          Choose a password to finish setting up your 888 Safety portal access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-foreground font-medium">Password set — signing you in…</p>
          </div>
        ) : hasSession === false ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-danger">
              This link has expired or was already used. Ask your administrator to resend your invite.
            </p>
            <Button
              onClick={() => router.push("/auth/login")}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg font-semibold"
            >
              Go to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary h-12"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="pl-10 bg-muted border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary h-12"
                required
              />
            </div>
            {error && <p className="text-sm text-danger font-medium">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg font-semibold"
              disabled={loading || hasSession === null}
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Set password & continue"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
