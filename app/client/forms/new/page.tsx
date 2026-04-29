"use client"

import React, { useState } from "react"
import { FormRenderer } from "@/components/forms/form-renderer"
import { useDraftSync } from "@/hooks/use-draft-sync"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Save, Send } from "lucide-react"
import Link from "next/link"

import { FormSchema } from "@/types/forms"
import { createClient } from "@/lib/supabase/client"

export default function NewAssessmentPage() {
  const [schema, setSchema] = useState<FormSchema | null>(null)
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submissionId, setSubmissionId] = useState<string | null>(null)

  React.useEffect(() => {
    async function loadTemplate() {
      const supabase = createClient()
      
      // For demo, we'll just get the latest Fire Risk template
      const { data: templates } = await supabase
        .from("form_templates")
        .select("id")
        .eq("template_type", "fire_risk")
        .limit(1)
        .single()

      if (templates) {
        const { data: version } = await supabase
          .from("template_versions")
          .select("schema_json")
          .eq("template_id", templates.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .single()

        if (version) {
          setSchema(version.schema_json as unknown as FormSchema)
        }
      }
      setLoading(false)
    }
    loadTemplate()
  }, [])

  // Cloud Draft Sync (interval set to 5s for demo verification)
  useDraftSync(submissionId, data, 5000)

  const handleFieldChange = (id: string, value: any) => {
    setData((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/client">
            <Button variant="ghost" size="icon" className="text-slate-400">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="h-6 w-[1px] bg-slate-800" />
          <h2 className="font-outfit font-medium text-slate-300 tracking-wide uppercase text-sm">
            Draft Assessment
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-slate-400 gap-2">
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Save Draft</span>
          </Button>
          <Button className="bg-amber-600 hover:bg-amber-500 text-white gap-2 px-6">
            <Send className="h-4 w-4" />
            Complete
          </Button>
        </div>
      </header>

      {/* Form Area */}
      <main className="container mx-auto px-6 py-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
             <div className="h-8 w-64 bg-slate-800 rounded mb-4" />
             <div className="h-4 w-48 bg-slate-900 rounded" />
          </div>
        ) : schema ? (
          <FormRenderer 
            schema={schema} 
            data={data} 
            onChange={handleFieldChange} 
          />
        ) : (
          <div className="text-center py-20 text-slate-500">
            No template found. Please check Admin settings.
          </div>
        )}
      </main>

      {/* Sync Status Footer */}
      <footer className="fixed bottom-6 right-6 pointer-events-none z-50">
        <div className="bg-slate-900/90 backdrop-blur border border-slate-800 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl pointer-events-auto">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[0.6rem] uppercase tracking-widest text-slate-400 font-bold">
            Cloud Sync Active
          </span>
        </div>
      </footer>
    </div>
  )
}
