"use client";

import { useState } from "react";
import type { FormField, BuilderSurface } from "@/lib/types/form-builder";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
  surface?: BuilderSurface;
}

const surfaceTokens = {
  dark: {
    headerBorder: "border-white/5",
    headerLabel: "text-white/30",
    label: "text-white/40",
    input: "bg-transparent border-white/10 text-white placeholder:text-white/20 focus:border-white/30",
    keyInput: "bg-transparent border-white/10 text-white/60 placeholder:text-white/20 focus:border-white/30",
    helpHint: "text-white/20",
    toggleOn: "bg-[#3b8273]",
    toggleOff: "bg-white/10",
    toggleKnob: "bg-white",
    optionInput: "bg-transparent border-white/10 text-white focus:border-white/30",
    optionRemove: "text-white/20 hover:text-[#8b2b21]",
    addOptionInput: "bg-transparent border-dashed border-white/10 text-white placeholder:text-white/20 focus:border-white/20",
    addOptionBtn: "text-white/30 hover:text-[#3b8273]",
    select: "bg-[#111] border-white/10 text-white focus:border-white/30",
    typeFooter: "border-white/5 text-white/20",
  },
  cream: {
    headerBorder: "border-[#e5e1d8]",
    headerLabel: "text-[#8a857f]",
    label: "text-[#8a857f]",
    input: "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    keyInput: "bg-white border-[#e5e1d8] text-[#6b6560] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    helpHint: "text-[#8a857f]",
    toggleOn: "bg-[#1a1a1a]",
    toggleOff: "bg-[#e5e1d8]",
    toggleKnob: "bg-white",
    optionInput: "bg-white border-[#e5e1d8] text-[#1a1a1a] focus:border-[#1a1a1a]/40",
    optionRemove: "text-[#8a857f] hover:text-[#8b2b21]",
    addOptionInput: "bg-transparent border-dashed border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    addOptionBtn: "text-[#8a857f] hover:text-[#1a1a1a]",
    select: "bg-white border-[#e5e1d8] text-[#1a1a1a] focus:border-[#1a1a1a]/40",
    typeFooter: "border-[#e5e1d8] text-[#8a857f]",
  },
} as const;

export function FieldConfig({ field, onChange, surface = "dark" }: Props) {
  const [newOption, setNewOption] = useState("");
  const t = surfaceTokens[surface];

  function addOption() {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    const value = trimmed.toLowerCase().replace(/\s+/g, "_");
    const options = [...(field.options ?? []), { label: trimmed, value }];
    onChange({ options });
    setNewOption("");
  }

  function removeOption(value: string) {
    onChange({ options: field.options?.filter(o => o.value !== value) });
  }

  function updateOptionLabel(oldValue: string, newLabel: string) {
    onChange({
      options: field.options?.map(o =>
        o.value === oldValue ? { ...o, label: newLabel } : o
      ),
    });
  }

  return (
    <div className="flex flex-col gap-0">
      <div className={cn("px-4 py-3 border-b", t.headerBorder)}>
        <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.headerLabel)}>
          Field Properties
        </span>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>Label</label>
          <input
            type="text"
            value={field.label}
            onChange={e => onChange({ label: e.target.value })}
            className={cn("border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors", t.input)}
          />
        </div>

        {/* Key */}
        <div className="flex flex-col gap-1.5">
          <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>Field Key</label>
          <input
            type="text"
            value={field.key}
            onChange={e => onChange({ key: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
            className={cn("border rounded-[3px] px-3 py-2 text-xs font-mono outline-none transition-colors", t.keyInput)}
          />
          <span className={cn("text-[10px]", t.helpHint)}>Used as the answer key in JSON</span>
        </div>

        {/* Placeholder (text/textarea/number) */}
        {(field.type === "text" || field.type === "textarea" || field.type === "number") && (
          <div className="flex flex-col gap-1.5">
            <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>Placeholder</label>
            <input
              type="text"
              value={field.placeholder ?? ""}
              onChange={e => onChange({ placeholder: e.target.value })}
              className={cn("border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors", t.input)}
            />
          </div>
        )}

        {/* Help Text */}
        <div className="flex flex-col gap-1.5">
          <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>Help Text</label>
          <input
            type="text"
            value={field.helpText ?? ""}
            onChange={e => onChange({ helpText: e.target.value })}
            placeholder="Shown below the field"
            className={cn("border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors", t.input)}
          />
        </div>

        {/* Required toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>Required</span>
            <span className={cn("text-[10px]", t.helpHint)}>Must be filled to submit</span>
          </div>
          <button
            onClick={() => onChange({ required: !field.required })}
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors",
              field.required ? t.toggleOn : t.toggleOff
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full transition-transform",
                t.toggleKnob,
                field.required ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        {/* Dropdown/multi-select/checkbox-group options */}
        {(field.type === "dropdown" || field.type === "multi-select" || field.type === "checkbox") && (
          <div className="flex flex-col gap-2">
            <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>
              {field.type === "checkbox" ? "Options (leave empty for single tick)" : "Options"}
            </label>
            <div className="flex flex-col gap-1">
              {(field.options ?? []).map(opt => (
                <div key={opt.value} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={e => updateOptionLabel(opt.value, e.target.value)}
                    className={cn("flex-1 border rounded-[3px] px-2.5 py-1.5 text-xs outline-none transition-colors", t.optionInput)}
                  />
                  <button
                    onClick={() => removeOption(opt.value)}
                    className={cn("w-5 h-5 flex items-center justify-center transition-colors", t.optionRemove)}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newOption}
                onChange={e => setNewOption(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addOption()}
                placeholder="Add option…"
                className={cn("flex-1 border rounded-[3px] px-2.5 py-1.5 text-xs outline-none transition-colors", t.addOptionInput)}
              />
              <button
                onClick={addOption}
                className={cn("w-5 h-5 flex items-center justify-center transition-colors", t.addOptionBtn)}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Rating max */}
        {field.type === "rating" && (
          <div className="flex flex-col gap-1.5">
            <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>Max Rating</label>
            <select
              value={field.maxRating ?? 5}
              onChange={e => onChange({ maxRating: Number(e.target.value) })}
              className={cn("border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors", t.select)}
            >
              {[3, 4, 5, 6, 7, 10].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        {/* Multi-photo max */}
        {field.type === "multi-photo" && (
          <div className="flex flex-col gap-1.5">
            <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>Max Photos</label>
            <select
              value={field.maxPhotos ?? 5}
              onChange={e => onChange({ maxPhotos: Number(e.target.value) })}
              className={cn("border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors", t.select)}
            >
              {[1, 2, 3, 5, 10, 20].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        {/* Field type label */}
        <div className={cn("pt-2 border-t", t.typeFooter)}>
          <span className="font-mono text-[10px] uppercase tracking-wider">
            Type: {field.type}
          </span>
        </div>
      </div>
    </div>
  );
}
