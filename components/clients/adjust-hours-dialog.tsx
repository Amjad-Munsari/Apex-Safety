"use client"

import { useState } from "react"
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
import { Plus, Minus, Clock } from "lucide-react"
import { updateClientHours } from "@/app/admin/clients/actions"
import { useRouter } from "next/navigation"

interface AdjustHoursDialogProps {
  clientId: string
  currentBalance: number
}

export function AdjustHoursDialog({ clientId, currentBalance }: AdjustHoursDialogProps) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<string>("0")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
      <DialogContent className="sm:max-w-[425px] bg-[#1c1c1c] border-white/10 text-white">
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
                id="amount"
                type="number"
                step="0.5"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-black/40 border-white/10 pl-10 h-12 text-lg focus:ring-white/20"
                placeholder="0.0"
              />
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
