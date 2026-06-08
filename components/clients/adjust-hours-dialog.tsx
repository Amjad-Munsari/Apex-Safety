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
import { Plus, Minus, Clock, ChevronUp, ChevronDown } from "lucide-react"
import { updateClientHours } from "@/app/admin/clients/actions"
import { useRouter } from "next/navigation"

const STEP = 0.5

interface AdjustHoursDialogProps {
  clientId: string
  currentBalance: number
}

export function AdjustHoursDialog({ clientId, currentBalance }: AdjustHoursDialogProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<string>("0")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Reset to 0 each time the dialog opens, so a reopen never shows a stale value.
  // The input's autoFocus + onFocus-select then leaves the 0 highlighted, so the
  // first digit typed replaces it rather than appending.
  useEffect(() => {
    if (open) setAmount("0")
  }, [open])

  // Custom stepper (the native spinner is hidden globally in globals.css).
  // Rounds to one decimal so 0.5 steps don't accumulate float noise.
  const step = (dir: 1 | -1) => {
    const cur = parseFloat(amount) || 0
    const next = Math.max(0, Math.round((cur + dir * STEP) * 10) / 10)
    setAmount(String(next))
  }

  async function handleAdjust(type: "add" | "deduct") {
    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) return
    if (type === "deduct" && val > currentBalance) return

    setLoading(true)
    try {
      const adjustment = type === "add" ? val : -val
      await updateClientHours(clientId, adjustment)
      setOpen(false)
      setAmount("0")
      router.refresh()
    } catch (error) {
      console.error("Failed to adjust hours:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-white/70 text-[10px] uppercase tracking-wider font-mono h-7">
          Adjust Balance
        </Button>
      } />
      <DialogContent
        className="sm:max-w-[425px] bg-[#1c1c1c] border-white/10 text-white"
        initialFocus={inputRef}
      >
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Adjust Hours Balance</DialogTitle>
          <DialogDescription className="text-white/40">
            Add or deduct hours from this client's retained balance. Current: <span className="text-white font-mono">{currentBalance} hrs</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount" className="text-xs uppercase tracking-widest text-[#888] font-mono">Amount (Hours)</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              <Input
                ref={inputRef}
                id="amount"
                type="number"
                step="0.5"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="bg-black/40 border-white/10 pl-10 pr-12 h-12 text-lg focus:ring-white/20"
                placeholder="0.0"
              />
              {/* Custom stepper — themed to the dark dialog, replacing the hidden native arrows. */}
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-px">
                <button
                  type="button"
                  aria-label="Increase hours"
                  onClick={() => step(1)}
                  className="flex h-[18px] w-7 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-white/50 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  aria-label="Decrease hours"
                  onClick={() => step(-1)}
                  className="flex h-[18px] w-7 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-white/50 hover:bg-white/15 hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-white/50"
                  disabled={(parseFloat(amount) || 0) <= 0}
                >
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-3 sm:justify-center">
          <Button
            onClick={() => handleAdjust("deduct")}
            disabled={loading || (parseFloat(amount) || 0) > currentBalance || (parseFloat(amount) || 0) <= 0}
            variant="destructive"
            className="flex-1 rounded-sm gap-2 uppercase text-[10px] font-mono tracking-widest"
          >
            <Minus className="w-3 h-3" /> Deduct
          </Button>
          <Button
            onClick={() => handleAdjust("add")}
            disabled={loading || (parseFloat(amount) || 0) <= 0}
            className="flex-1 bg-white hover:bg-white/90 text-black rounded-sm gap-2 uppercase text-[10px] font-mono tracking-widest"
          >
            <Plus className="w-3 h-3" /> Add Hours
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
