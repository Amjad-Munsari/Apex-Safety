"use client"

import * as React from "react"
import Image from "next/image"
import { Upload, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import ThemeSwitch from "@/components/ui/theme-switch"
import { applyBranding } from "@/lib/branding"
import { saveNotificationSettings, uploadBrandingLogo, removeBrandingLogo } from "@/app/admin/settings/actions"

export interface SettingsFormInitial {
  signOffName: string
  senderName: string
  expiryRemindersEnabled: boolean
  notifyOnUpload: boolean
  logoUrl: string | null
  creditsPerHour: number
  brandingPrimary: string
  brandingSecondary: string
}

export function SettingsForm({ initial }: { initial: SettingsFormInitial }) {
  const [primary, setPrimary] = React.useState(initial.brandingPrimary)
  const [secondary, setSecondary] = React.useState(initial.brandingSecondary)
  const [signOff, setSignOff] = React.useState(initial.signOffName)
  const [senderName, setSenderName] = React.useState(initial.senderName)
  const [expiryReminders, setExpiryReminders] = React.useState(initial.expiryRemindersEnabled)
  const [notifyUpload, setNotifyUpload] = React.useState(initial.notifyOnUpload)
  const [creditsPerHour, setCreditsPerHour] = React.useState(String(initial.creditsPerHour))
  const [logoUrl, setLogoUrl] = React.useState<string | null>(initial.logoUrl)
  const [uploadingLogo, setUploadingLogo] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    const fd = new FormData()
    fd.append("logo", file)
    const res = await uploadBrandingLogo(fd)
    setUploadingLogo(false)
    // Reset the input so re-selecting the same file fires onChange again.
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (res.ok && res.logoUrl) {
      setLogoUrl(res.logoUrl)
      toast.success("Logo updated", { description: "Your new mark is live on the client portal." })
    } else {
      toast.error(res.error || "Could not upload the logo.")
    }
  }

  async function handleRemoveLogo() {
    setUploadingLogo(true)
    const res = await removeBrandingLogo()
    setUploadingLogo(false)
    if (res.ok) {
      setLogoUrl(null)
      toast.success("Logo removed", { description: "The client portal no longer shows a logo." })
    } else {
      toast.error(res.error || "Could not remove the logo.")
    }
  }

  async function handleSave() {
    setSaving(true)
    const res = await saveNotificationSettings({
      signOffName: signOff,
      senderName,
      expiryRemindersEnabled: expiryReminders,
      notifyOnUpload: notifyUpload,
      creditsPerHour: Number(creditsPerHour),
      brandingPrimary: primary,
      brandingSecondary: secondary,
    })
    setSaving(false)

    if (res.ok) {
      applyBranding({ primary, secondary })
      toast.success("Settings saved", { description: "Brand colours and notification defaults applied." })
    } else {
      toast.error(res.error || "Could not save settings.")
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Branding */}
      <Card className="bg-card border-border rounded-sm p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">01</div>
            <h3 className="font-serif text-[22px] text-foreground leading-tight">Branding</h3>
            <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
              Colours apply across both portals. The uploaded logo also appears on generated documents.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {/* Logo */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Logo</span>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                    className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-danger transition-colors disabled:opacity-50"
                  >
                    <X className="w-3 h-3" /> Remove logo
                  </button>
                )}
              </div>
              <div
                onClick={() => !uploadingLogo && fileInputRef.current?.click()}
                className="border border-dashed border-border rounded-sm h-32 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-gold/40 hover:bg-muted/30 transition-all"
              >
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Current logo"
                    width={180}
                    height={48}
                    unoptimized
                    className="max-h-16 w-auto object-contain"
                  />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {uploadingLogo ? "Uploading…" : logoUrl ? "Click to replace" : "Click to upload PNG, JPEG or WebP"}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground tracking-[0.2em]">
                  Recommended 240×60 · max 2MB
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoSelect}
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-6">
              <ColorPicker label="Primary Colour" value={primary} onChange={setPrimary} />
              <ColorPicker label="Secondary Colour" value={secondary} onChange={setSecondary} />
            </div>

            {/* Preview */}
            <div className="bg-background rounded-sm p-4 ring-1 ring-border">
              <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Preview</div>
              <div className="flex items-center gap-2">
                <div className="h-8 px-4 rounded-sm flex items-center font-mono text-[10px] uppercase tracking-[0.2em]" style={{ background: primary, color: "#fff" }}>
                  Primary CTA
                </div>
                <div className="h-8 px-4 rounded-sm flex items-center font-mono text-[10px] uppercase tracking-[0.2em]" style={{ background: secondary, color: "#fff" }}>
                  Secondary
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="bg-card border-border rounded-sm p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">02</div>
            <h3 className="font-serif text-[22px] text-foreground leading-tight">Notifications</h3>
            <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
              Defaults applied to every email the platform sends on your behalf.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <TextField label="Saved Sign-off Name" value={signOff} onChange={setSignOff} hint="Stored for the planned email-brand cutover; current emails use deployment settings." />
            <TextField label="Saved Sender Name" value={senderName} onChange={setSenderName} hint="Stored for the planned email-brand cutover; current From: name uses deployment settings." />
            <div className="flex items-center justify-between bg-background rounded-sm p-4 ring-1 ring-border">
              <div>
                <div className="text-sm text-foreground">Send expiry reminders</div>
                <div className="text-muted-foreground text-xs mt-1">Email the primary contact as their documents approach expiry.</div>
              </div>
              <Toggle on={expiryReminders} onChange={setExpiryReminders} />
            </div>
            <div className="flex items-center justify-between bg-background rounded-sm p-4 ring-1 ring-border">
              <div>
                <div className="text-sm text-foreground">Notify on document upload</div>
                <div className="text-muted-foreground text-xs mt-1">Tell the client whenever a new document lands in their portal.</div>
              </div>
              <Toggle on={notifyUpload} onChange={setNotifyUpload} />
            </div>
          </div>
        </div>
      </Card>

      {/* Billing */}
      <Card className="bg-card border-border rounded-sm p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">03</div>
            <h3 className="font-serif text-[22px] text-foreground leading-tight">Billing</h3>
            <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
              The reference rate used to convert hours to credits when adjusting a client&apos;s balance.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <label className="flex flex-col gap-2 max-w-[220px]">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Credits per Hour</span>
              <input
                type="number"
                min="1"
                step="1"
                value={creditsPerHour}
                onChange={(e) => setCreditsPerHour(e.target.value)}
                className="bg-background border border-border rounded-sm h-9 px-3 text-sm text-foreground outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
              />
              <span className="text-muted-foreground text-xs">Whole number, 1 or more. Existing balances are unaffected.</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Appearance */}
      <Card className="bg-card border-border rounded-sm p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">04</div>
            <h3 className="font-serif text-[22px] text-foreground leading-tight">Appearance</h3>
            <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
              Display preferences for the admin interface.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between bg-background rounded-sm p-4 ring-1 ring-border">
              <div>
                <div className="text-sm text-foreground">Theme</div>
                <div className="text-muted-foreground text-xs mt-1">Switch between light and dark mode.</div>
              </div>
              <ThemeSwitch />
            </div>
          </div>
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gold hover:bg-gold/90 disabled:opacity-40 text-gold-foreground rounded-sm px-6 font-medium text-[11px] h-10 tracking-wide border-none flex gap-2"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3 bg-background border border-border rounded-sm h-10 px-3 focus-within:border-gold/50">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded-sm cursor-pointer border-none bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground outline-none font-mono uppercase tracking-wider"
        />
      </div>
    </label>
  )
}

function TextField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background border border-border rounded-sm h-9 px-3 text-sm text-foreground outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
      />
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </label>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
        on ? "bg-gold" : "bg-muted"
      }`}
      aria-pressed={on}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </button>
  )
}
