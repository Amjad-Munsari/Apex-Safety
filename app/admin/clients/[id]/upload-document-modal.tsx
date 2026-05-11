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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { uploadClientDocumentAction } from "./actions"
import { UploadCloud, Loader2 } from "lucide-react"

export function UploadDocumentModal({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!file) return

    setIsUploading(true)
    const formData = new FormData(e.currentTarget)
    formData.append("clientId", clientId)
    formData.append("file", file) // Explicitly append file to ensure it's captured

    try {
      await uploadClientDocumentAction(formData)
      setOpen(false)
      setFile(null)
    } catch (error) {
      console.error("Upload failed", error)
      alert("Failed to upload document. See console for details.")
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
        <UploadCloud className="w-4 h-4 mr-2" /> Upload document
      </Button>
      <DialogContent className="bg-[#1c1c1c] border-white/10 text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl font-normal">Upload Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">
          
          <div className="flex flex-col gap-2">
            <Label htmlFor="file" className="text-white/70 font-mono text-xs uppercase tracking-widest">File</Label>
            <Input 
              id="file" 
              type="file" 
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="bg-black/50 border-white/10 text-white file:text-white file:bg-white/10 file:border-0 file:rounded-sm file:px-3 file:py-1 file:mr-4 file:text-xs file:font-mono file:uppercase file:tracking-widest"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="category" className="text-white/70 font-mono text-xs uppercase tracking-widest">Category</Label>
            <Select name="category" required defaultValue="Fire Risk Assessment">
              <SelectTrigger className="bg-black/50 border-white/10 text-white">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-[#1c1c1c] border-white/10 text-white">
                <SelectItem value="Fire Risk Assessment" className="text-white focus:bg-[#3b8273]/20 focus:text-[#d4af6e]">Fire Risk Assessment</SelectItem>
                <SelectItem value="Site Risk Assessment" className="text-white focus:bg-[#3b8273]/20 focus:text-[#d4af6e]">Site Risk Assessment</SelectItem>
                <SelectItem value="Health & Safety Policy" className="text-white focus:bg-[#3b8273]/20 focus:text-[#d4af6e]">Health & Safety Policy</SelectItem>
                <SelectItem value="Insurance Certificate" className="text-white focus:bg-[#3b8273]/20 focus:text-[#d4af6e]">Insurance Certificate</SelectItem>
                <SelectItem value="Training Certificate" className="text-white focus:bg-[#3b8273]/20 focus:text-[#d4af6e]">Training Certificate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expiryDate" className="text-white/70 font-mono text-xs uppercase tracking-widest">Expiry Date (Optional)</Label>
            <Input 
              id="expiryDate" 
              name="expiryDate" 
              type="date" 
              className="bg-black/50 border-white/10 text-white css-invert-calendar" 
              style={{ colorScheme: "dark" }}
            />
          </div>

          <div className="pt-4 flex justify-end">
            <Button 
              type="submit" 
              disabled={!file || isUploading}
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
