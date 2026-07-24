"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Minus, Coins, ChevronUp, ChevronDown } from "lucide-react"
import { updateClientHours } from "@/app/admin/clients/actions"
import { hoursToCredits } from "@/lib/billing/credits"
import { useRouter } from "next/navigation"

type Unit = "credits" | "hours"

// Credits are whole integers; hours convert at the reference rate and round to
// whole credits, so the hours picker keeps the existing 0.5 granularity.
const STEP: Record<Unit, number> = { credits: 1, hours: 0.5 }

interface AdjustHoursDialogProps {
  clientId: string
  currentBalance: number
  /** Reference rate for the hours → credits convenience conversion. */
  creditsPerHour: number
}

export function AdjustHoursDialog({ clientId, currentBalance, creditsPerHour }: AdjustHoursDialogProps) {
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState<Unit>("credits")
  const [amount, setAmount] = useState<string>("0")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Reset to a clean state each time the dialog opens, so a reopen never shows a
  // stale value or error. The input's autoFocus + onFocus-select then leaves the
  // 0 highlighted, so the first digit typed replaces it rather than appending.
  useEffect(() => {
    if (open) {
      setUnit("credits")
      setAmount("0")
      setError(null)
    }
  }, [open])

  // Validate the typed value BEFORE deriving credits. The sign comes from the
  // Add/Deduct button, never from the input — so a negative entry is invalid, not
  // flipped. Credits must be whole; only the hours→credits conversion is allowed
  // to round (a fractional hours entry is a legitimate convenience).
  const parsed = Number(amount)
  const isNumeric = amount.trim() !== "" && Number.isFinite(parsed)
  let validationError: string | null = null
  if (isNumeric && parsed < 0) {
    validationError = "Enter a positive amount — use Deduct to remove credits."
  } else if (unit === "credits" && isNumeric && !Number.isInteger(parsed)) {
    validationError = "Credits must be a whole number."
  }

  const magnitudeCredits =
    !isNumeric || validationError
      ? 0
      : unit === "hours"
        ? hoursToCredits(parsed, creditsPerHour)
        : parsed

  // Custom stepper (the native spinner is hidden globally in globals.css).
  // Rounds to one decimal so 0.5 hour steps don't accumulate float noise.
  const step = (dir: 1 | -1) => {
    const cur = parseFloat(amount) || 0
    const next = Math.max(0, Math.round((cur + dir * STEP[unit]) * 10) / 10)
    setAmount(String(next))
  }

  const switchUnit = (next: Unit) => {
    if (next === unit) return
    setUnit(next)
    setAmount("0")
    setError(null)
  }

  // Client-side deduct guard against the rendered balance — UX only; the RPC is
  // the authoritative overdraft gate under concurrency.
  const overdraft = magnitudeCredits > currentBalance

  async function handleAdjust(type: "add" | "deduct") {
    if (magnitudeCredits <= 0 || validationError) return
    if (type === "deduct" && overdraft) return

    setLoading(true)
    setError(null)
    const adjustment = type === "add" ? magnitudeCredits : -magnitudeCredits
    try {
      const res = await updateClientHours(clientId, adjustment)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      setAmount("0")
      router.refresh()
    } catch {
      // Unexpected throw (auth boundary, transport failure) — the typed union
      // only covers expected errors, so surface a generic message here.
      setError("Something went wrong. Please try again.")
    } finally {
      // Always clear loading so an unexpected throw can't leave the dialog stuck.
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="bg-muted border-border hover:bg-muted/80 text-muted-foreground text-[10px] uppercase tracking-wider font-mono h-7">
          Adjust Balance
        </Button>
      } />
      <DialogContent
        className="sm:max-w-[425px] bg-card border-border text-foreground"
        initialFocus={inputRef}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Adjust Credit Balance</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Add or deduct credits from this client&apos;s retained balance. Current: <span className="text-foreground font-mono">{currentBalance} credits</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Unit toggle — enter the amount in credits (default) or hours. */}
          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-mono">Enter in</Label>
            <div className="flex gap-2">
              {(["credits", "hours"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => switchUnit(u)}
                  className={`flex-1 rounded-sm border px-3 py-1.5 text-[10px] uppercase tracking-widest font-mono transition-colors ${
                    unit === u
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount" className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
              Amount ({unit === "hours" ? "Hours" : "Credits"})
            </Label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                ref={inputRef}
                id="amount"
                type="number"
                step={unit === "hours" ? "0.5" : "1"}
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="bg-muted border-border pl-10 pr-12 h-12 text-lg focus:ring-border"
                placeholder="0"
              />
              {/* Custom stepper — themed to the dialog, replacing the hidden native arrows. */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-px">
                <button
                  type="button"
                  aria-label={`Increase ${unit}`}
                  onClick={() => step(1)}
                  className="flex h-[18px] w-7 items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                >
                  <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  aria-label={`Decrease ${unit}`}
                  onClick={() => step(-1)}
                  className="flex h-[18px] w-7 items-center justify-center rounded-sm border border-border bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-muted disabled:hover:text-muted-foreground"
                  disabled={(parseFloat(amount) || 0) <= 0}
                >
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
            {/* Inline validation for an invalid typed value. */}
            {validationError && (
              <p className="text-danger text-[11px] font-medium">{validationError}</p>
            )}
            {/* Live conversion preview when entering valid hours. */}
            {unit === "hours" && !validationError && parsed > 0 && (
              <p className="font-mono text-[11px] text-muted-foreground">
                {parsed}h &rarr; {magnitudeCredits} credit{magnitudeCredits === 1 ? "" : "s"} at {creditsPerHour}/hour
              </p>
            )}
          </div>

          {error && (
            <p className="text-danger text-xs font-medium">{error}</p>
          )}
        </div>
        <DialogFooter className="gap-3 sm:justify-center">
          <Button
            onClick={() => handleAdjust("deduct")}
            disabled={loading || !!validationError || overdraft || magnitudeCredits <= 0}
            variant="destructive"
            className="flex-1 rounded-sm gap-2 uppercase text-[10px] font-mono tracking-widest"
          >
            <Minus className="w-3 h-3" /> Deduct
          </Button>
          <Button
            onClick={() => handleAdjust("add")}
            disabled={loading || !!validationError || magnitudeCredits <= 0}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm gap-2 uppercase text-[10px] font-mono tracking-widest"
          >
            <Plus className="w-3 h-3" /> Add Credits
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
