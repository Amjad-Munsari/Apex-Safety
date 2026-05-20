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
import { NumberField } from "./number-field"
import { DateField } from "./date-field"
import { CheckboxField } from "./checkbox-field"
import { SignatureField } from "./signature-field"
import { RatingField } from "./rating-field"
import { MultiPhotoField } from "./multi-photo-field"
import { GeolocationField } from "./geolocation-field"
import { cn } from "@/lib/utils"

import { FormSchema, FormField } from "@/types/forms"

export type FormSurface = "dark" | "cream"

interface FormRendererProps {
  readonly schema: FormSchema
  readonly data: Record<string, any>
  readonly onChange: (id: string, value: any) => void
  /** Visual surface. Admin uses "dark" (default). Client portal uses "cream". */
  readonly surface?: FormSurface
}

// `dark` is the admin form surface. Tokens are tied to the proposal wizard's
// CSS variables (--p-*) so the assessment form-fill page matches the wizard.
const surfaceTokens = {
  dark: {
    title: "text-[var(--p-text)]",
    sectionRule: "border-[var(--p-border-subtle)]",
    sectionTitle: "text-[var(--p-text)]",
    sectionDesc: "text-[var(--p-text-muted)]",
    card: "bg-[var(--p-surface)] border-[var(--p-border)] shadow-lg",
    cardHeader: "bg-[var(--p-surface-raised)]/40 border-b border-[var(--p-border-subtle)]",
    fieldLabel: "text-[var(--p-text-muted)]",
    helpText: "text-[var(--p-text-muted)]",
    input: "bg-[var(--p-input-bg)] border-[var(--p-border)] text-[var(--p-text)] focus:ring-[var(--p-gold)]/20 focus:border-[var(--p-gold)]",
    select: "bg-[var(--p-input-bg)] border border-[var(--p-border)] text-[var(--p-text)] focus:border-[var(--p-gold)]",
    fallback: "border-[var(--p-gold)]/40 bg-[var(--p-gold)]/5 text-[var(--p-gold)]",
  },
  cream: {
    title: "text-[#1a1a1a]",
    sectionRule: "border-[#e5e1d8]",
    sectionTitle: "text-[#1a1a1a]",
    sectionDesc: "text-[#6b6560]",
    card: "bg-white border-[#e5e1d8] shadow-sm",
    cardHeader: "bg-[#faf9f6] border-b border-[#f0ede6]",
    fieldLabel: "text-[#8a857f]",
    helpText: "text-[#6b6560]",
    input: "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:ring-amber-500/20 focus:border-amber-500",
    select: "bg-white border border-[#e5e1d8] text-[#1a1a1a] focus:border-amber-500",
    fallback: "border-amber-500/50 bg-amber-50 text-amber-800",
  },
} as const

function renderField(
  field: FormField,
  data: Record<string, any>,
  onChange: (id: string, value: any) => void,
  surface: FormSurface,
  t: (typeof surfaceTokens)[FormSurface]
) {
  const value = data[field.id]

  switch (field.type) {
    case "text":
      return (
        <div className="relative group">
          <Input
            className={cn("pr-12 h-12 rounded-sm", t.input)}
            placeholder={field.placeholder}
            value={value || ""}
            onChange={(e) => onChange(field.id, e.target.value)}
          />
          <MicButton
            surface={surface}
            onTranscript={(text) => {
              const current: string = value || ""
              onChange(field.id, current.trim() ? `${current.trim()} ${text}` : text)
            }}
          />
        </div>
      )

    case "textarea":
      return (
        <div className="relative group">
          <Textarea
            className={cn("pr-12 min-h-[140px] rounded-sm", t.input)}
            placeholder={field.placeholder}
            value={value || ""}
            onChange={(e) => onChange(field.id, e.target.value)}
          />
          <MicButton
            surface={surface}
            className="top-3 translate-y-0"
            onTranscript={(text) => {
              const current: string = value || ""
              onChange(field.id, current.trim() ? `${current.trim()} ${text}` : text)
            }}
          />
        </div>
      )

    case "number":
      return (
        <NumberField
          surface={surface}
          value={value}
          placeholder={field.placeholder}
          min={field.config?.min}
          max={field.config?.max}
          step={field.config?.step}
          onChange={(v) => onChange(field.id, v)}
        />
      )

    case "date":
      return (
        <DateField
          surface={surface}
          value={value}
          onChange={(v) => onChange(field.id, v)}
        />
      )

    case "checkbox":
      return (
        <CheckboxField
          surface={surface}
          label={field.label}
          options={field.options}
          value={value}
          onChange={(v) => onChange(field.id, v)}
        />
      )

    case "dropdown":
      if (surface === "cream") {
        return (
          <Select
            value={value || undefined}
            onValueChange={(v) => onChange(field.id, v)}
          >
            <SelectTrigger
              className="w-full h-12 px-4 rounded-sm bg-white border border-[#e5e1d8] text-[#1a1a1a] text-sm font-sans data-placeholder:text-[#a8a39d] focus-visible:border-amber-500 focus-visible:ring-2 focus-visible:ring-amber-500/20 hover:bg-[#faf9f6]"
            >
              <SelectValue placeholder={field.placeholder || "Select option..."}>
                {(v: any) =>
                  v
                    ? field.options?.find((o) => o.value === v)?.label ?? String(v)
                    : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-white text-[#1a1a1a] ring-1 ring-[#e5e1d8] shadow-md rounded-sm">
              {field.options?.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-sm text-[#1a1a1a]! [&_*]:text-[#1a1a1a]! focus:bg-amber-100 focus:text-[#1a1a1a]! focus:[&_*]:text-[#1a1a1a]! data-[highlighted]:bg-amber-100 data-[highlighted]:text-[#1a1a1a]! data-[highlighted]:[&_*]:text-[#1a1a1a]!"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }
      return (
        <select
          className={cn("w-full h-12 px-4 rounded-sm outline-none transition-colors", t.select)}
          value={value || ""}
          onChange={(e) => onChange(field.id, e.target.value)}
        >
          <option value="" disabled>{field.placeholder || "Select option..."}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )

    case "signature":
      return (
        <SignatureField
          surface={surface}
          value={value}
          onChange={(v) => onChange(field.id, v)}
        />
      )

    case "rating":
      return (
        <RatingField
          surface={surface}
          value={value}
          maxRating={field.maxRating ?? 5}
          onChange={(v) => onChange(field.id, v)}
        />
      )

    case "media":
      return (
        <MediaField
          surface={surface}
          value={value || []}
          onChange={(urls) => onChange(field.id, urls)}
        />
      )

    case "multi-photo":
      return (
        <MultiPhotoField
          surface={surface}
          value={value}
          maxPhotos={field.maxPhotos ?? 5}
          onChange={(urls) => onChange(field.id, urls)}
        />
      )

    case "geolocation":
      return (
        <GeolocationField
          surface={surface}
          value={value}
          onChange={(v) => onChange(field.id, v)}
        />
      )

    default:
      return (
        <div
          className={cn(
            "rounded-sm border border-dashed px-3 py-2 text-xs font-mono",
            t.fallback
          )}
          role="alert"
        >
          Unsupported field type: {field.type}
        </div>
      )
  }
}

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
              <CardContent className="pt-6 space-y-2">
                {renderField(field, data, onChange, surface, t)}
                {field.helpText && (
                  <p className={cn("text-xs", t.helpText)}>{field.helpText}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}
