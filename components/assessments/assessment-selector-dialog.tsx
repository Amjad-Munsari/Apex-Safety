"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react"

export function AssessmentSelectorDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const supabase = createClient()
  
  const [step, setStep] = React.useState<1 | 2>(1)
  const [clients, setClients] = React.useState<any[]>([])
  const [templates, setTemplates] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  
  const [selectedClientId, setSelectedClientId] = React.useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setStep(1)
      setSelectedClientId(null)
      setSelectedTemplateId(null)
      fetchClients()
      fetchTemplates()
    }
  }, [open])

  async function fetchClients() {
    setLoading(true)
    const { data } = await supabase.from("clients").select("id, name").order("name")
    setClients(data || [])
    setLoading(false)
  }

  async function fetchTemplates() {
    const { data } = await supabase
      .from("template_versions")
      .select("id, name, version")
      .not("published_at", "is", null)
      .order("created_at", { ascending: false })
    // In a real scenario we'd group by template_id and get the latest published version.
    // Assuming these are all valid choices.
    setTemplates(data || [])
  }

  const handleNext = () => {
    if (step === 1 && selectedClientId) {
      setStep(2)
    }
  }

  const handleStart = () => {
    if (selectedClientId && selectedTemplateId) {
      router.push(`/admin/assessments/new?clientId=${selectedClientId}&templateVersionId=${selectedTemplateId}`)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-slate-800 bg-slate-950 text-slate-200">
        <DialogHeader>
          <div className="text-xs font-bold tracking-widest text-slate-500 mb-1">
            STEP {step} OF 2
          </div>
          <DialogTitle className="text-xl font-serif">
            {step === 1 ? "Select Client" : "Select Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading && step === 1 ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : step === 1 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-md border transition-all ${
                    selectedClientId === client.id
                      ? "border-amber-500 bg-amber-500/10 text-amber-500"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <span className="font-medium">{client.name}</span>
                  {selectedClientId === client.id && <div className="h-2 w-2 rounded-full bg-amber-500" />}
                </button>
              ))}
              {clients.length === 0 && (
                <div className="text-center text-slate-500 py-8">No clients found.</div>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full text-left p-4 rounded-md border transition-all ${
                    selectedTemplateId === template.id
                      ? "border-amber-500 bg-amber-500/10 text-amber-500"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="text-xs mt-1 opacity-70">Version {template.version}</div>
                </button>
              ))}
              {templates.length === 0 && (
                <div className="text-center text-slate-500 py-8">No published templates found.</div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-2">
          {step === 2 ? (
            <Button variant="ghost" onClick={() => setStep(1)} className="text-slate-400 hover:text-white">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          ) : (
            <div></div> // Spacer
          )}

          {step === 1 ? (
            <Button 
              onClick={handleNext} 
              disabled={!selectedClientId}
              className="bg-amber-500 text-black hover:bg-amber-400 font-medium"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button 
              onClick={handleStart} 
              disabled={!selectedTemplateId}
              className="bg-amber-500 text-black hover:bg-amber-400 font-medium"
            >
              Start Assessment
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
