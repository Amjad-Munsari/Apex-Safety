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
      <code className="flex-1 min-w-0 truncate bg-black/40 border border-white/10 rounded-sm px-3 py-2.5 font-mono text-[11px] text-white/80">
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
        className="shrink-0 inline-flex items-center gap-2 px-3 rounded-sm bg-white/10 hover:bg-white/15 text-white font-mono text-[10px] uppercase tracking-widest transition-colors"
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
  const [result, setResult] = useState<{ link: string; status: string; name: string } | null>(null)
  const [busyUser, setBusyUser] = useState<string | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    const res = await inviteClientUser(clientId, { name, email, role })
    setLoading(false)
    if (res.ok) {
      setResult({ link: res.link, status: res.status, name: res.name })
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
    if (res.ok) setResult({ link: res.link, status: res.status, name: res.name })
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
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-white/5">
          <UserPlus className="w-4 h-4 text-white/40" />
          <h3 className="font-sans font-medium text-white tracking-wide text-lg">Invite portal user</h3>
        </div>
        <form onSubmit={handleInvite} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Full name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                className="bg-black/30 border-white/10 text-white placeholder:text-white/30 h-10"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="bg-black/30 border-white/10 text-white placeholder:text-white/30 h-10"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-black/30 border border-white/10 text-white h-10 rounded-md px-3 text-sm"
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
              className="bg-[#c0a66d] hover:bg-[#c0a66d]/90 text-black font-medium font-mono text-[11px] uppercase tracking-widest h-10 px-5 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><UserPlus className="w-3.5 h-3.5 mr-2" /> Generate invite link</>}
            </Button>
            {!active && (
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                Client deactivated
              </span>
            )}
          </div>

          {result && (
            <div className="flex flex-col gap-2 bg-[#c0a66d]/5 border border-[#c0a66d]/20 rounded-sm p-4 mt-1">
              <div className="flex items-center gap-2 text-[#d8c08a] font-mono text-[10px] uppercase tracking-widest">
                <KeyRound className="w-3.5 h-3.5" />
                {result.status === "resent" ? "New set-password link" : `Invite link for ${result.name}`}
              </div>
              <p className="text-white/50 text-xs leading-relaxed">
                Send this link to the user. It signs them in and lets them set a password. The link is
                single-use and expires — generate a new one with &ldquo;Resend&rdquo; if it lapses.
              </p>
              <CopyLinkBox link={result.link} />
            </div>
          )}
        </form>
      </Card>

      {/* Existing users */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <div className="px-6 py-4 flex items-center gap-3 border-b border-white/5">
          <ShieldCheck className="w-4 h-4 text-white/40" />
          <h3 className="font-sans font-medium text-white tracking-wide text-lg">Portal users</h3>
          {users.length > 0 && (
            <span className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-mono uppercase tracking-widest text-white/50 ml-1 leading-none">
              {users.length}
            </span>
          )}
        </div>
        {users.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center">
            <UserPlus className="w-8 h-8 text-white/20 mb-3" />
            <p className="text-white/50 text-sm">No one can sign in to this client yet.</p>
            <p className="text-white/30 text-xs mt-1">Invite a contact above to grant portal access.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {users.map((u) => (
              <div key={u.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{u.name || "—"}</div>
                  <div className="font-mono text-[11px] text-white/50 truncate">{u.email}</div>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-white/50 bg-white/5 px-2 py-1 rounded-sm">
                  {u.role}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleResend(u)}
                    disabled={busyUser === u.id}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-white/5 hover:bg-white/10 text-white/80 font-mono text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50"
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
