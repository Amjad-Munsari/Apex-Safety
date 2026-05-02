"use client"

import React, { useState } from "react"
import { FormRenderer } from "@/components/forms/form-renderer"
import { useDraftSync } from "@/hooks/use-draft-sync"
import { Button } from "@/components/ui/button"
import { ChevronLeft, Save, Send } from "lucide-react"
import Link from "next/link"

import { FormSchema } from "@/types/forms"
import { createClient } from "@/lib/supabase/client"
import { HARDCODED_FRA_TEMPLATE } from "@/lib/forms/fra-template"

export default function NewAssessmentPage() {
  const [schema, setSchema] = useState<FormSchema | null>(null)
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submissionId, setSubmissionId] = useState<string | null>(null)

  React.useEffect(() => {
    async function loadTemplate() {
      const supabase = createClient()
      try {
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

          const dbSchema = version?.schema_json as unknown as FormSchema | undefined
          if (dbSchema && Array.isArray((dbSchema as any).sections)) {
            setSchema(dbSchema)
          } else {
            setSchema(HARDCODED_FRA_TEMPLATE)
          }
        } else {
          setSchema(HARDCODED_FRA_TEMPLATE)
        }
      } catch {
        setSchema(HARDCODED_FRA_TEMPLATE)
      } finally {
        setLoading(false)
      }
    }
    loadTemplate()
  }, [])

  useDraftSync(submissionId, data, 5000)

  const handleFieldChange = (id: string, value: any) => {
    setData((prev) => ({ ...prev, [id]: value }))
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Back link */}
      <Link
        href="/client"
        className="inline-flex items-center gap-2 text-[#999] hover:text-black transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
          Back to Dashboard
        </span>
      </Link>

      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-[#999] uppercase font-bold">
          <span className="text-amber-600">New Assessment</span>
          <span className="opacity-30">·</span>
          <span>Draft</span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="space-y-1">
            <h2 className="font-serif text-[32px] text-[#1a1a1a] font-medium tracking-tight leading-[1.05]">
              {schema?.title ?? "New Assessment"}.
            </h2>
            <p className="text-[#888] text-[13px] font-sans tracking-tight max-w-xl">
              Fill in each section. We'll auto-save your draft to the cloud every few seconds.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] text-[#1a1a1a] text-[10px] uppercase tracking-[0.2em] font-bold h-10 px-5 shadow-none"
            >
              <Save className="h-3.5 w-3.5 mr-2" />
              Save draft
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-500 text-white text-[10px] uppercase tracking-[0.2em] font-bold h-10 px-6 rounded-sm shadow-none">
              <Send className="h-3.5 w-3.5 mr-2" />
              Complete &rarr;
            </Button>
          </div>
        </div>
      </section>

      {/* Form */}
      <section>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="h-8 w-64 bg-[#ece8de] rounded-sm mb-4" />
            <div className="h-4 w-48 bg-[#f0ede6] rounded-sm" />
          </div>
        ) : schema ? (
          <FormRenderer
            schema={schema}
            data={data}
            onChange={handleFieldChange}
            surface="cream"
          />
        ) : (
          <div className="text-center py-20 font-mono text-[10px] uppercase tracking-widest text-[#999]">
            No template found. Please check Admin settings.
          </div>
        )}
      </section>

      {/* Sync status */}
      <div className="fixed bottom-6 right-6 pointer-events-none z-40">
        <div className="bg-white/95 backdrop-blur border border-[#e5e1d8] px-4 py-2 rounded-full flex items-center gap-3 shadow-sm pointer-events-auto">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#666] font-bold">
            Cloud sync active
          </span>
        </div>
      </div>
    </div>
  )
}
