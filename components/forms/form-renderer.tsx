"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MicButton } from "./mic-button"
import { MediaField } from "./media-field"

import { FormSchema, FormField } from "@/types/forms"

interface FormRendererProps {
  readonly schema: FormSchema
  readonly data: Record<string, any>
  readonly onChange: (id: string, value: any) => void
}

export function FormRenderer({ schema, data, onChange }: FormRendererProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <h1 className="text-3xl font-bold tracking-tight mb-8 font-outfit text-slate-100">
        {schema.title}
      </h1>

      {schema.sections.map((section) => (
        <div key={section.id} className="space-y-6">
          <div className="pt-8 pb-2 border-b border-slate-800/50">
            <h3 className="text-xl font-medium text-slate-200 font-outfit uppercase tracking-wider">{section.title}</h3>
            {section.description && <p className="text-slate-500 text-sm mt-1">{section.description}</p>}
          </div>

          {section.fields.map((field) => (
            <Card key={field.id} className="bg-slate-900 border-slate-800 shadow-lg overflow-hidden">
              <CardHeader className="pb-2 bg-slate-900/50 border-b border-slate-800/30">
                <Label className="uppercase text-[0.65rem] tracking-[0.1em] text-slate-500 font-bold">
                  {field.label}
                </Label>
              </CardHeader>
              <CardContent className="pt-6">
                {field.type === "text" && (
                  <div className="relative group">
                    <Input
                      className="bg-slate-950 border-slate-800 focus:ring-amber-500/20 focus:border-amber-500 pr-12 h-12 rounded-sm"
                      placeholder={field.placeholder}
                      value={data[field.id] || ""}
                      onChange={(e) => onChange(field.id, e.target.value)}
                    />
                    <MicButton
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
                      className="bg-slate-950 border-slate-800 focus:ring-amber-500/20 focus:border-amber-500 pr-12 min-h-[140px] rounded-sm"
                      placeholder={field.placeholder}
                      value={data[field.id] || ""}
                      onChange={(e) => onChange(field.id, e.target.value)}
                    />
                    <MicButton
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
                    value={data[field.id] || []}
                    onChange={(urls) => onChange(field.id, urls)}
                  />
                )}

                {field.type === "dropdown" && (
                  <select
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 h-12 px-4 rounded-sm outline-none focus:border-amber-500 transition-colors"
                    value={data[field.id] || ""}
                    onChange={(e) => onChange(field.id, e.target.value)}
                  >
                    <option value="" disabled>{field.placeholder || "Select option..."}</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}
