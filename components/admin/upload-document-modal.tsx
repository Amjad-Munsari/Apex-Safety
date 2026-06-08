"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { uploadClientDocumentAction } from "@/lib/documents/actions"
import { UploadCloud, Loader2 } from "lucide-react"

export interface ClientOption {
  id: string
  name: string
}

interface UploadDocumentModalProps {
  /** Preselect a client (client detail page case). When unset, the modal renders a client picker. */
  clientId?: string
  /** Required when clientId is unset — list of clients shown in the picker. */
  clients?: ClientOption[]
  /** Visual variant for the trigger button. */
  triggerLabel?: string
}

const CATEGORY_OPTIONS = [
  "Fire Risk Assessment",
  "Site Risk Assessment",
  "Health & Safety Policy",
  "Insurance Certificate",
  "Training Certificate",
] as const

export function UploadDocumentModal({
  clientId,
  clients,
  triggerLabel = "Upload document",
}: UploadDocumentModalProps) {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const effectiveClientId = clientId ?? selectedClientId

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!file) return
    if (!effectiveClientId) {
      setError("Please select a client.")
      return
    }

    setIsUploading(true)
    const formData = new FormData(e.currentTarget)
    formData.set("clientId", effectiveClientId)
    formData.set("file", file)

    try {
      await uploadClientDocumentAction(formData)
      setOpen(false)
      setFile(null)
      setSelectedClientId("")
    } catch (err) {
      console.error("Upload failed", err)
      setError(err instanceof Error ? err.message : "Failed to upload document.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="secondary"
        className="bg-white hover:bg-white/90 text-black rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none"
        onClick={() => setOpen(true)}
      >
        <UploadCloud className="w-4 h-4 mr-2" /> {triggerLabel}
      </Button>
      <DialogContent className="bg-[#1c1c1c] border-white/10 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal">Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
          {!clientId && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="clientPicker" className="text-white/70 font-mono text-xs uppercase tracking-widest">
                Client
              </Label>
              <Select
                value={selectedClientId}
                onValueChange={(v) => setSelectedClientId(v ?? "")}
                required
              >
                <SelectTrigger className="w-full bg-black/50 border-white/10 text-white">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent className="bg-[#1c1c1c] border-white/10 text-white">
                  {(clients ?? []).map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      className="text-white focus:bg-teal/20 focus:text-[#d4af6e]"
                    >
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="file" className="text-white/70 font-mono text-xs uppercase tracking-widest">
              File
            </Label>
            <Input
              id="file"
              type="file"
              required
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="bg-black/50 border-white/10 text-white file:text-white file:bg-white/10 file:border-0 file:rounded-sm file:px-3 file:py-1 file:mr-4 file:text-xs file:font-mono file:uppercase file:tracking-widest"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category" className="text-white/70 font-mono text-xs uppercase tracking-widest">
              Category
            </Label>
            <Select name="category" required defaultValue={CATEGORY_OPTIONS[0]}>
              <SelectTrigger className="w-full bg-black/50 border-white/10 text-white">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-[#1c1c1c] border-white/10 text-white">
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem
                    key={cat}
                    value={cat}
                    className="text-white focus:bg-teal/20 focus:text-[#d4af6e]"
                  >
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expiryDate" className="text-white/70 font-mono text-xs uppercase tracking-widest">
              Expiry Date (Optional)
            </Label>
            <Input
              id="expiryDate"
              name="expiryDate"
              type="date"
              className="bg-black/50 border-white/10 text-white css-invert-calendar"
              style={{ colorScheme: "dark" }}
            />
          </div>

          {error && (
            <div className="text-[#e06050] text-xs font-mono">{error}</div>
          )}

          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              disabled={!file || !effectiveClientId || isUploading}
              className="bg-white hover:bg-white/90 text-black rounded-sm px-6 font-medium text-sm h-10 tracking-wide border-none w-full"
            >
              {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {isUploading ? "Uploading..." : "Upload & Notify"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
