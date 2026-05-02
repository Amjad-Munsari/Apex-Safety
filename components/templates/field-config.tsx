"use client";

import { useState } from "react";
import type { FormField, FieldOption } from "@/lib/types/form-builder";
import { Plus, X } from "lucide-react";

interface Props {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
}

export function FieldConfig({ field, onChange }: Props) {
  const [newOption, setNewOption] = useState("");

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
      <div className="px-4 py-3 border-b border-white/5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
          Field Properties
        </span>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Label</label>
          <input
            type="text"
            value={field.label}
            onChange={e => onChange({ label: e.target.value })}
            className="bg-transparent border border-white/10 rounded-[3px] px-3 py-2 text-white text-sm placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
          />
        </div>

        {/* Key */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Field Key</label>
          <input
            type="text"
            value={field.key}
            onChange={e => onChange({ key: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
            className="bg-transparent border border-white/10 rounded-[3px] px-3 py-2 text-white/60 text-xs font-mono placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
          />
          <span className="text-[10px] text-white/20">Used as the answer key in JSON</span>
        </div>

        {/* Placeholder (text/textarea/number) */}
        {(field.type === "text" || field.type === "textarea" || field.type === "number") && (
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Placeholder</label>
            <input
              type="text"
              value={field.placeholder ?? ""}
              onChange={e => onChange({ placeholder: e.target.value })}
              className="bg-transparent border border-white/10 rounded-[3px] px-3 py-2 text-white text-sm placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
            />
          </div>
        )}

        {/* Help Text */}
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Help Text</label>
          <input
            type="text"
            value={field.helpText ?? ""}
            onChange={e => onChange({ helpText: e.target.value })}
            placeholder="Shown below the field"
            className="bg-transparent border border-white/10 rounded-[3px] px-3 py-2 text-white text-sm placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
          />
        </div>

        {/* Required toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Required</span>
            <span className="text-[10px] text-white/20">Must be filled to submit</span>
          </div>
          <button
            onClick={() => onChange({ required: !field.required })}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              field.required ? "bg-[#3b8273]" : "bg-white/10"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                field.required ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Dropdown/multi-select options */}
        {(field.type === "dropdown" || field.type === "multi-select") && (
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Options</label>
            <div className="flex flex-col gap-1">
              {(field.options ?? []).map(opt => (
                <div key={opt.value} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={e => updateOptionLabel(opt.value, e.target.value)}
                    className="flex-1 bg-transparent border border-white/10 rounded-[3px] px-2.5 py-1.5 text-white text-xs outline-none focus:border-white/30 transition-colors"
                  />
                  <button
                    onClick={() => removeOption(opt.value)}
                    className="w-5 h-5 flex items-center justify-center text-white/20 hover:text-[#8b2b21] transition-colors"
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
                className="flex-1 bg-transparent border border-dashed border-white/10 rounded-[3px] px-2.5 py-1.5 text-white text-xs placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
              />
              <button
                onClick={addOption}
                className="w-5 h-5 flex items-center justify-center text-white/30 hover:text-[#3b8273] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Rating max */}
        {field.type === "rating" && (
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Max Rating</label>
            <select
              value={field.maxRating ?? 5}
              onChange={e => onChange({ maxRating: Number(e.target.value) })}
              className="bg-[#111] border border-white/10 rounded-[3px] px-3 py-2 text-white text-sm outline-none focus:border-white/30 transition-colors"
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
            <label className="font-mono text-[10px] uppercase tracking-widest text-white/40">Max Photos</label>
            <select
              value={field.maxPhotos ?? 5}
              onChange={e => onChange({ maxPhotos: Number(e.target.value) })}
              className="bg-[#111] border border-white/10 rounded-[3px] px-3 py-2 text-white text-sm outline-none focus:border-white/30 transition-colors"
            >
              {[1, 2, 3, 5, 10, 20].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        {/* Field type label */}
        <div className="pt-2 border-t border-white/5">
          <span className="font-mono text-[10px] text-white/20 uppercase tracking-wider">
            Type: {field.type}
          </span>
        </div>
      </div>
    </div>
  );
}
