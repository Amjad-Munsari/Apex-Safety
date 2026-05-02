"use client"

import React from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MicButton } from "./mic-button"
import { MediaField } from "./media-field"
import { cn } from "@/lib/utils"

import { FormSchema } from "@/types/forms"

export type FormSurface = "dark" | "cream"

interface FormRendererProps {
  readonly schema: FormSchema
  readonly data: Record<string, any>
  readonly onChange: (id: string, value: any) => void
  /** Visual surface. Admin uses "dark" (default). Client portal uses "cream". */
  readonly surface?: FormSurface
}

const surfaceTokens = {
  dark: {
    title: "text-slate-100",
    sectionRule: "border-slate-800/50",
    sectionTitle: "text-slate-200",
    sectionDesc: "text-slate-500",
    card: "bg-slate-900 border-slate-800 shadow-lg",
    cardHeader: "bg-slate-900/50 border-b border-slate-800/30",
    fieldLabel: "text-slate-500",
    input: "bg-slate-950 border-slate-800 focus:ring-amber-500/20 focus:border-amber-500",
    select: "bg-slate-950 border border-slate-800 text-slate-100 focus:border-amber-500",
  },
  cream: {
    title: "text-[#1a1a1a]",
    sectionRule: "border-[#e5e1d8]",
    sectionTitle: "text-[#1a1a1a]",
    sectionDesc: "text-[#888]",
    card: "bg-white border-[#e5e1d8] shadow-sm",
    cardHeader: "bg-[#faf9f6] border-b border-[#f0ede6]",
    fieldLabel: "text-[#999]",
    input: "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#bbb] focus:ring-amber-500/20 focus:border-amber-500",
    select: "bg-white border border-[#e5e1d8] text-[#1a1a1a] focus:border-amber-500",
  },
} as const

export function FormRenderer({ schema, data, onChange, surface = "dark" }: FormRendererProps) {
  const t = surfaceTokens[surface]

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <h1 className={cn("text-3xl font-bold tracking-tight mb-8 font-outfit", t.title)}>
        {schema.title}
      </h1>

      {schema.sections.map((section) => (
        <div key={section.id} className="space-y-6">
          <div className={cn("pt-8 pb-2 border-b", t.sectionRule)}>
            <h3 className={cn("text-xl font-medium font-outfit uppercase tracking-wider", t.sectionTitle)}>{section.title}</h3>
            {section.description && <p className={cn("text-sm mt-1", t.sectionDesc)}>{section.description}</p>}
          </div>

          {section.fields.map((field) => (
            <Card key={field.id} className={cn("overflow-hidden", t.card)}>
              <CardHeader className={cn("pb-2", t.cardHeader)}>
                <Label className={cn("uppercase text-[0.65rem] tracking-[0.1em] font-bold", t.fieldLabel)}>
                  {field.label}
                </Label>
              </CardHeader>
              <CardContent className="pt-6">
                {field.type === "text" && (
                  <div className="relative group">
                    <Input
                      className={cn("pr-12 h-12 rounded-sm", t.input)}
                      placeholder={field.placeholder}
                      value={data[field.id] || ""}
                      onChange={(e) => onChange(field.id, e.target.value)}
                    />
                    <MicButton
                      surface={surface}
                      onTranscript={(text) => {
                        const current = data[field.id] || "";
                        const updated = current.trim() ? `${current.trim()} ${text}` : text;
                        onChange(field.id, updated);
                      }}
                    />
                  </div>
                )}

                {field.type === "textarea" && (
                  <div className="relative group">
                    <Textarea
                      className={cn("pr-12 min-h-[140px] rounded-sm", t.input)}
                      placeholder={field.placeholder}
                      value={data[field.id] || ""}
                      onChange={(e) => onChange(field.id, e.target.value)}
                    />
                    <MicButton
                      surface={surface}
                      className="top-3 translate-y-0"
                      onTranscript={(text) => {
                        const current = data[field.id] || "";
                        const updated = current.trim() ? `${current.trim()} ${text}` : text;
                        onChange(field.id, updated);
                      }}
                    />
                  </div>
                )}

                {field.type === "media" && (
                  <MediaField
                    surface={surface}
                    value={data[field.id] || []}
                    onChange={(urls) => onChange(field.id, urls)}
                  />
                )}

                {field.type === "dropdown" && (
                  surface === "cream" ? (
                    <Select
                      value={data[field.id] || ""}
                      onValueChange={(value) => onChange(field.id, value)}
                    >
                      <SelectTrigger
                        className="w-full h-12 px-4 rounded-sm bg-white border border-[#e5e1d8] text-[#1a1a1a] text-sm font-sans data-placeholder:text-[#bbb] focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/20 hover:bg-[#faf9f6]"
                      >
                        <SelectValue placeholder={field.placeholder || "Select option..."} />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-white text-[#1a1a1a] ring-1 ring-[#e5e1d8] shadow-md rounded-sm"
                      >
                        {field.options?.map(opt => (
                          <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className="text-sm text-[#1a1a1a] focus:bg-[#faf9f6] focus:text-[#1a1a1a] focus:[&_*]:text-[#1a1a1a] data-[highlighted]:bg-[#faf9f6] data-[highlighted]:text-[#1a1a1a] data-[highlighted]:[&_*]:text-[#1a1a1a] data-[selected]:text-amber-700 data-[selected]:[&_*]:text-amber-700"
                          >
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <select
                      className={cn("w-full h-12 px-4 rounded-sm outline-none transition-colors", t.select)}
                      value={data[field.id] || ""}
                      onChange={(e) => onChange(field.id, e.target.value)}
                    >
                      <option value="" disabled>{field.placeholder || "Select option..."}</option>
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}
