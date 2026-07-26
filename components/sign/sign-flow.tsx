"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, FileText, Loader2 } from "lucide-react"
import { SignatureField } from "@/components/forms/signature-field"
import { PUBLIC_CONTACT } from "@/lib/public-identity"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProposalService {
  name: string
  quantity: number
}

interface ProposalPayload {
  reference: string
  title: string
  clientName: string
  contactName: string | null
  contactEmail: string | null
  total: number
  serviceCount: number
  services: ProposalService[]
  createdDate: string
  pdfUrl: string | null
}

type FetchState =
  | { status: "loading" }
  | { status: "expired" }
  | { status: "already_signed" }
  | { status: "error"; message: string }
  | { status: "ready"; proposal: ProposalPayload }

type SignMode = "draw" | "type"

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; signerName: string; reference: string; title: string; timestamp: string }
  | { phase: "error"; message: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const SCRIPT_FONT = "'Segoe Script', 'Brush Script MT', cursive"
const CANVAS_FONT_SIZE = 64 // px at 1× scale
const CANVAS_PADDING_X = 40
const CANVAS_PADDING_Y = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function renderTypedSignatureToCanvas(text: string): string {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return ""

  // Measure at 1× first
  ctx.font = `${CANVAS_FONT_SIZE}px ${SCRIPT_FONT}`
  const measured = ctx.measureText(text)
  const width = Math.ceil(measured.width) + CANVAS_PADDING_X * 2
  const height = CANVAS_FONT_SIZE + CANVAS_PADDING_Y * 2

  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  // Clear to white
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Scale for retina
  ctx.scale(dpr, dpr)

  ctx.font = `${CANVAS_FONT_SIZE}px ${SCRIPT_FONT}`
  ctx.fillStyle = "#1a1a1a"
  ctx.textBaseline = "middle"
  ctx.fillText(text, CANVAS_PADDING_X, height / 2)

  return canvas.toDataURL("image/png")
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-5 py-5 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-bold">
            888
          </span>
          <span className="text-border select-none">|</span>
          <span className="font-serif text-[17px] text-foreground tracking-tight leading-none">
            Safety &amp; Training
          </span>
        </div>
      </header>
      {children}
    </div>
  )
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-16">
      <div className="bg-card border border-border rounded-sm shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-10 max-w-md w-full text-center space-y-4">
        {children}
      </div>
    </main>
  )
}

function LoadingView() {
  return (
    <PageShell>
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
            Loading proposal
          </span>
        </div>
      </main>
    </PageShell>
  )
}

function ExpiredView() {
  return (
    <PageShell>
      <StatusCard>
        <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center mx-auto">
          <FileText className="w-5 h-5 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-[22px] text-foreground tracking-tight">
          Link expired
        </h1>
        <p className="font-sans text-[13px] text-muted-foreground leading-relaxed">
          This signing link has expired. Ask for a new link at{" "}
          <a className="underline" href={PUBLIC_CONTACT.emailHref}>{PUBLIC_CONTACT.email}</a>
          {" "}or{" "}
          <a className="underline" href={PUBLIC_CONTACT.phoneHref}>{PUBLIC_CONTACT.phone}</a>.
        </p>
      </StatusCard>
    </PageShell>
  )
}

function AlreadySignedView() {
  return (
    <PageShell>
      <StatusCard>
        <div className="w-10 h-10 rounded-full bg-teal/10 border border-teal/20 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-5 h-5 text-teal" />
        </div>
        <h1 className="font-serif text-[22px] text-foreground tracking-tight">
          Already signed
        </h1>
        <p className="font-sans text-[13px] text-muted-foreground leading-relaxed">
          This proposal has already been signed. Thank you.
        </p>
      </StatusCard>
    </PageShell>
  )
}

function SuccessView({
  signerName,
  reference,
  title,
  timestamp,
}: {
  signerName: string
  reference: string
  title: string
  timestamp: string
}) {
  return (
    <PageShell>
      <main className="flex-1 flex items-center justify-center px-5 py-16">
        <div className="bg-card border border-border rounded-sm shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-10 max-w-md w-full space-y-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-teal/10 border border-teal/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-teal" />
            </div>
            <div>
              <h1 className="font-serif text-[28px] text-foreground tracking-tight leading-[1.1]">
                Proposal signed
              </h1>
              <p className="font-sans text-[13px] text-muted-foreground mt-2 leading-relaxed">
                Thank you, {signerName}. Your signature has been recorded.
              </p>
            </div>
          </div>
          <div className="border border-border rounded-sm p-5 space-y-3">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground block">
                Reference
              </span>
              <span className="font-sans text-[13px] text-foreground font-medium">
                {reference}
              </span>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground block">
                Proposal
              </span>
              <span className="font-sans text-[13px] text-foreground">{title}</span>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground block">
                Signed at
              </span>
              <span className="font-sans text-[13px] text-foreground">{timestamp}</span>
            </div>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground text-center">
            888 Safety &amp; Training will be in touch shortly.
          </p>
        </div>
      </main>
    </PageShell>
  )
}

// ── Main sign flow ─────────────────────────────────────────────────────────────

export function SignFlow({ token }: { token: string }) {
  const [fetchState, setFetchState] = useState<FetchState>({ status: "loading" })
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: "idle" })

  // Form fields
  const [signerName, setSignerName] = useState("")
  const [signerEmail, setSignerEmail] = useState("")
  const [signMode, setSignMode] = useState<SignMode>("draw")
  const [drawnSignature, setDrawnSignature] = useState<string | undefined>(undefined)
  const [typedText, setTypedText] = useState("")
  const [termsChecked, setTermsChecked] = useState(false)

  const typedPreviewRef = useRef<HTMLDivElement>(null)

  // Derived: recompute whenever typedText changes (no effect needed)
  const typedDataUrl = typedText.trim()
    ? renderTypedSignatureToCanvas(typedText)
    : ""

  // Fetch proposal on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch(`/api/sign/${token}`)
        if (cancelled) return

        if (res.status === 410) {
          setFetchState({ status: "expired" })
          return
        }
        if (res.status === 409) {
          setFetchState({ status: "already_signed" })
          return
        }
        if (!res.ok) {
          setFetchState({ status: "error", message: "Unable to load proposal." })
          return
        }

        const json = (await res.json()) as { proposal: ProposalPayload }

        if (!json.proposal) {
          setFetchState({ status: "error", message: "Malformed response from server." })
          return
        }

        const proposal = json.proposal

        // Prefill contact details
        setSignerName(proposal.contactName ?? "")
        setSignerEmail(proposal.contactEmail ?? "")
        setFetchState({ status: "ready", proposal })
      } catch {
        if (!cancelled) {
          setFetchState({ status: "error", message: "Network error. Please try again." })
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  function getSignatureImage(): string {
    if (signMode === "draw") return drawnSignature ?? ""
    return typedDataUrl
  }

  const canSubmit =
    signerName.trim().length > 0 &&
    isValidEmail(signerEmail) &&
    (signMode === "draw" ? !!drawnSignature : typedText.trim().length > 0) &&
    termsChecked &&
    submitState.phase === "idle"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitState({ phase: "submitting" })

    const signatureImage = getSignatureImage()

    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signer_email: signerEmail.trim(),
          signature_image: signatureImage,
        }),
      })

      if (res.status === 409) {
        setFetchState({ status: "already_signed" })
        return
      }
      if (res.status === 410) {
        setFetchState({ status: "expired" })
        return
      }

      if (res.status === 400) {
        const body = (await res.json()) as { error: string; message?: string }
        setSubmitState({
          phase: "error",
          message: body.message ?? "Please check your details and try again.",
        })
        return
      }

      if (!res.ok) {
        setSubmitState({ phase: "error", message: "Something went wrong. Please try again." })
        return
      }

      const proposal =
        fetchState.status === "ready" ? fetchState.proposal : null

      setSubmitState({
        phase: "success",
        signerName: signerName.trim(),
        reference: proposal?.reference ?? "",
        title: proposal?.title ?? "",
        timestamp: new Date().toLocaleString("en-GB"),
      })
    } catch {
      setSubmitState({ phase: "error", message: "Network error. Please try again." })
    }
  }

  // ── State routing ──────────────────────────────────────────────────────────

  if (fetchState.status === "loading") return <LoadingView />
  if (fetchState.status === "expired") return <ExpiredView />
  if (fetchState.status === "already_signed") return <AlreadySignedView />
  if (fetchState.status === "error") {
    return (
      <PageShell>
        <StatusCard>
          <h1 className="font-serif text-[22px] text-foreground">Something went wrong</h1>
          <p className="font-sans text-[13px] text-muted-foreground">{fetchState.message}</p>
        </StatusCard>
      </PageShell>
    )
  }

  if (submitState.phase === "success") {
    return (
      <SuccessView
        signerName={submitState.signerName}
        reference={submitState.reference}
        title={submitState.title}
        timestamp={submitState.timestamp}
      />
    )
  }

  const { proposal } = fetchState

  // ── Ready: render the signing experience ───────────────────────────────────

  return (
    <PageShell>
      <main className="flex-1 max-w-4xl mx-auto w-full px-5 py-10 space-y-10">
        {/* Proposal header */}
        <section className="space-y-3">
          <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-muted-foreground uppercase font-bold">
            <span className="text-teal">{proposal.reference}</span>
            <span className="opacity-50">·</span>
            <span>Sent {formatDate(proposal.createdDate)}</span>
          </div>
          <h1 className="font-serif text-[36px] sm:text-[44px] text-foreground font-normal tracking-tight leading-[1.05]">
            {proposal.title}.
          </h1>
          <p className="text-muted-foreground text-[13px] font-sans tracking-tight">
            £{Math.round(proposal.total).toLocaleString()} inc. VAT &nbsp;·&nbsp;{" "}
            {proposal.serviceCount} {proposal.serviceCount === 1 ? "service" : "services"} bundled
          </p>
        </section>

        {/* Two-column layout on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
          {/* Left: PDF */}
          <div className="bg-card rounded-sm overflow-hidden ring-1 ring-border shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            {proposal.pdfUrl ? (
              <iframe
                src={proposal.pdfUrl}
                title={`Proposal ${proposal.reference}`}
                className="w-full bg-muted"
                style={{ aspectRatio: "210 / 297", border: 0 }}
              />
            ) : (
              <div className="aspect-[210/297] w-full p-12 text-foreground flex flex-col items-center justify-center text-center">
                <FileText className="w-10 h-10 text-muted-foreground mb-4" />
                <h3 className="font-serif text-[22px] mb-2">Document preparing</h3>
                <p className="font-sans text-[13px] text-muted-foreground max-w-sm leading-relaxed">
                  The proposal PDF is still being prepared. You can still review the
                  scope below and sign using the form.
                </p>
              </div>
            )}
          </div>

          {/* Right: proposal summary + signing form */}
          <div className="lg:sticky lg:top-8 space-y-5">
            {/* Summary card */}
            <div className="bg-card border border-border rounded-sm p-6 space-y-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-bold">
                Scope
              </div>
              {proposal.services.length > 0 && (
                <ul className="space-y-2.5">
                  {proposal.services.map((item, idx) => (
                    <li
                      key={idx}
                      className="font-sans text-[12px] text-foreground/80 flex items-start gap-2"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground mt-0.5 w-5 shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span>
                        {item.name}{" "}
                        <span className="text-muted-foreground">× {item.quantity}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between items-baseline">
                  <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                    Total inc. VAT
                  </span>
                  <span className="font-serif text-[20px] text-foreground">
                    £{Math.round(proposal.total).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Signature form */}
            <form
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-sm p-6 space-y-5"
            >
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-bold">
                Sign this proposal
              </div>

              {/* Full name */}
              <div className="space-y-1.5">
                <label
                  htmlFor="signer-name"
                  className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground block"
                >
                  Full name
                </label>
                <input
                  id="signer-name"
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full h-10 px-3 bg-muted border border-border rounded-sm font-sans text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal/50 transition-colors"
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="signer-email"
                  className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground block"
                >
                  Email address
                </label>
                <input
                  id="signer-email"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-muted border border-border rounded-sm font-sans text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal/50 transition-colors"
                  placeholder="your@email.com"
                  autoComplete="email"
                />
              </div>

              {/* Mode toggle */}
              <div className="space-y-3">
                <div className="flex items-center gap-1 p-1 bg-muted rounded-sm border border-border">
                  {(["draw", "type"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSignMode(mode)}
                      className={[
                        "flex-1 h-7 rounded-[2px] font-mono text-[9px] uppercase tracking-[0.2em] font-bold transition-colors",
                        signMode === mode
                          ? "bg-card border border-border text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                          : "text-muted-foreground hover:text-foreground",
                      ].join(" ")}
                    >
                      {mode === "draw" ? "Draw" : "Type instead"}
                    </button>
                  ))}
                </div>

                {signMode === "draw" ? (
                  <SignatureField
                    surface="cream"
                    value={drawnSignature}
                    onChange={(v) => setDrawnSignature(v ?? undefined)}
                  />
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={typedText}
                      onChange={(e) => setTypedText(e.target.value)}
                      className="w-full h-10 px-3 bg-muted border border-border rounded-sm font-sans text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-teal/50 focus:border-teal/50 transition-colors"
                      placeholder="Type your name to sign"
                      autoComplete="off"
                    />
                    {/* Live cursive preview */}
                    {typedText.trim() && (
                      <div
                        ref={typedPreviewRef}
                        className="w-full min-h-[72px] px-4 py-3 bg-card border border-border rounded-sm flex items-center overflow-hidden"
                      >
                        <span
                          className="text-foreground leading-none select-none"
                          style={{
                            fontFamily: SCRIPT_FONT,
                            fontSize: "2.2rem",
                            display: "block",
                            width: "100%",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {typedText}
                        </span>
                      </div>
                    )}
                    {!typedText.trim() && (
                      <div className="w-full min-h-[72px] px-4 py-3 bg-card border border-border rounded-sm flex items-center">
                        <span className="text-muted-foreground font-sans text-[12px]">
                          Your signature preview will appear here
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    onChange={(e) => setTermsChecked(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={[
                      "w-4 h-4 rounded-[3px] border transition-colors flex items-center justify-center",
                      termsChecked
                        ? "bg-teal border-teal"
                        : "bg-muted border-border group-hover:border-teal/40",
                    ].join(" ")}
                  >
                    {termsChecked && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        viewBox="0 0 10 8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="1 4 3.5 6.5 9 1" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="font-sans text-[12px] text-muted-foreground leading-relaxed">
                  I agree to the terms and services outlined in this proposal
                </span>
              </label>

              {/* Inline error */}
              {submitState.phase === "error" && (
                <p className="font-sans text-[12px] text-danger bg-danger/10 border border-danger/20 rounded-sm px-3 py-2">
                  {submitState.message}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={[
                  "w-full h-12 rounded-sm font-mono text-[10px] uppercase tracking-[0.25em] font-bold transition-colors flex items-center justify-center gap-2",
                  canSubmit
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    : "bg-primary/30 text-primary-foreground/60 cursor-not-allowed",
                ].join(" ")}
              >
                {submitState.phase === "submitting" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Signing&hellip;
                  </>
                ) : (
                  "Sign Proposal"
                )}
              </button>
            </form>
          </div>
        </div>
      </main>
    </PageShell>
  )
}
