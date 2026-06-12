"use client"

import { useState } from "react"
import { UserPlus, Copy, Check, Loader2, Trash2, KeyRound, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { inviteClientUser, revokeClientUser } from "../actions"

export interface ClientUserRow {
  id: string
  name: string | null
  email: string
  role: string
  created_at: string
}

interface ClientAccessTabProps {
  clientId: string
  clientName: string
  users: ClientUserRow[]
  /** When false the client is deactivated — inviting new portal users is disabled. */
  active?: boolean
}

function CopyLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-stretch gap-2">
      <code className="flex-1 min-w-0 truncate bg-background border border-border rounded-sm px-3 py-2.5 font-mono text-[11px] text-foreground/80">
        {link}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            /* clipboard blocked — user can still select the text manually */
          }
        }}
        className="shrink-0 inline-flex items-center gap-2 px-3 rounded-sm bg-muted hover:bg-muted text-foreground font-mono text-[10px] uppercase tracking-widest transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}

export function ClientAccessTab({ clientId, clientName, users, active = true }: ClientAccessTabProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ link: string; status: string; name: string; emailed: boolean } | null>(null)
  const [busyUser, setBusyUser] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    const res = await inviteClientUser(clientId, { name, email, role })
    setLoading(false)
    if (res.ok) {
      setResult({ link: res.link, status: res.status, name: res.name, emailed: res.emailed })
      setName("")
      setEmail("")
      setRole("member")
    } else {
      setError(res.error)
    }
  }

  async function handleResend(user: ClientUserRow) {
    setBusyUser(user.id)
    setError(null)
    setResult(null)
    const res = await inviteClientUser(clientId, { name: user.name || user.email, email: user.email, role: user.role })
    setBusyUser(null)
    if (res.ok) setResult({ link: res.link, status: res.status, name: res.name, emailed: res.emailed })
    else setError(res.error)
  }

  async function handleRevoke(user: ClientUserRow) {
    if (!confirm(`Revoke portal access for ${user.email}? They will no longer be able to sign in to ${clientName}.`)) return
    setBusyUser(user.id)
    setError(null)
    const res = await revokeClientUser(clientId, user.id)
    setBusyUser(null)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Invite form */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-border">
          <UserPlus className="w-4 h-4 text-foreground/40" />
          <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Invite portal user</h3>
        </div>
        <form onSubmit={handleInvite} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">Full name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground h-10"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="bg-background border-border text-foreground placeholder:text-muted-foreground h-10"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-background border border-border text-foreground h-10 rounded-md px-3 text-sm"
              >
                <option value="member">Member</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-danger font-medium">{error}</p>}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={loading || !active}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium font-mono text-[11px] uppercase tracking-widest h-10 px-5 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-3.5 h-3.5 mr-2" /> Send invite</>}
            </Button>
            {!active && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Client deactivated
              </span>
            )}
          </div>

          {result && (
            <div className="flex flex-col gap-2 bg-gold/5 border border-gold/20 rounded-sm p-4 mt-1">
              <div className="flex items-center gap-2 text-gold font-mono text-[10px] uppercase tracking-widest">
                <KeyRound className="w-3.5 h-3.5" />
                {result.emailed
                  ? `Invite emailed to ${result.name}`
                  : result.status === "resent"
                    ? "New set-password link"
                    : `Invite link for ${result.name}`}
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {result.emailed
                  ? "We've emailed the user a sign-in link to set their password. The copy below is a backup you can send manually if it doesn't arrive — it's single-use and expires."
                  : "Email delivery is unavailable right now — send this link to the user manually. It signs them in and lets them set a password. The link is single-use and expires — generate a new one with “Resend” if it lapses."}
              </p>
              <CopyLinkBox link={result.link} />
            </div>
          )}
        </form>
      </Card>

      {/* Existing users */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-border">
          <ShieldCheck className="w-4 h-4 text-foreground/40" />
          <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">Portal users</h3>
          {users.length > 0 && (
            <span className="px-2.5 py-1 bg-muted border border-border rounded-full text-[9px] font-mono uppercase tracking-widest text-muted-foreground ml-1 leading-none">
              {users.length}
            </span>
          )}
        </div>
        {users.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center">
            <UserPlus className="w-8 h-8 text-foreground/20 mb-3" />
            <p className="text-muted-foreground text-sm">No one can sign in to this client yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Invite a contact above to grant portal access.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-foreground text-sm font-medium truncate">{u.name || "—"}</div>
                  <div className="font-mono text-[11px] text-muted-foreground truncate">{u.email}</div>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground bg-muted px-2 py-1 rounded-sm">
                  {u.role}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleResend(u)}
                    disabled={busyUser === u.id}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-muted hover:bg-muted text-foreground/80 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50"
                  >
                    {busyUser === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(u)}
                    disabled={busyUser === u.id}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-danger/10 hover:bg-danger/20 text-danger font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
