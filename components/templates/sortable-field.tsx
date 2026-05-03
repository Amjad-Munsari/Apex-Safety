"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField, BuilderSurface } from "@/lib/types/form-builder";
import { cn } from "@/lib/utils";
import { GripVertical, Copy, Trash2 } from "lucide-react";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Short Text",
  textarea: "Long Text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  "multi-select": "Multi-Select",
  signature: "Signature",
  rating: "Rating",
  "multi-photo": "Photos",
  geolocation: "Location",
  repeating: "Repeating Section",
};

interface Props {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  surface?: BuilderSurface;
}

const surfaceTokens = {
  dark: {
    base: "bg-[#1c1c1c] border-white/5 hover:border-white/10 hover:bg-[#222]",
    selected: "bg-[#1e2e2b] border-[#3b8273]/50 shadow-[0_0_0_1px_rgba(59,130,115,0.2)]",
    grip: "text-white/20 hover:text-white/50",
    label: "text-white",
    requiredMark: "text-[#8b2b21]",
    typeBadge: "text-white/30",
    helpDivider: "text-white/20",
    helpText: "text-white/25",
    optionPill: "text-white/30 bg-white/5 border-white/10",
    optionExtra: "text-white/20",
    actionBtn: "text-white/30 hover:text-white/70 hover:bg-white/5",
    deleteBtn: "text-white/30 hover:text-[#8b2b21] hover:bg-[#8b2b21]/10",
  },
  cream: {
    base: "bg-white border-[#e5e1d8] hover:border-[#1a1a1a]/15 hover:bg-[#faf9f6]",
    selected: "bg-[#f5f3ee] border-[#1a1a1a] shadow-[0_0_0_1px_rgba(26,26,26,0.15)]",
    grip: "text-[#8a857f] hover:text-[#1a1a1a]",
    label: "text-[#1a1a1a]",
    requiredMark: "text-[#8b2b21]",
    typeBadge: "text-[#8a857f]",
    helpDivider: "text-[#d8d4cc]",
    helpText: "text-[#6b6560]",
    optionPill: "text-[#6b6560] bg-[#f5f3ee] border-[#e5e1d8]",
    optionExtra: "text-[#8a857f]",
    actionBtn: "text-[#8a857f] hover:text-[#1a1a1a] hover:bg-[#f0ede6]",
    deleteBtn: "text-[#8a857f] hover:text-[#8b2b21] hover:bg-[#8b2b21]/10",
  },
} as const;

export function SortableField({ field, isSelected, onSelect, onDuplicate, onDelete, surface = "dark" }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const t = surfaceTokens[surface];

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group relative flex items-start gap-3 px-4 py-4 rounded-sm border cursor-pointer transition-all",
        isSelected ? t.selected : t.base
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className={cn("mt-0.5 cursor-grab active:cursor-grabbing transition-colors shrink-0", t.grip)}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Field preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn("text-sm font-medium leading-tight", t.label)}>
            {field.label}
          </span>
          {field.required && (
            <span className={cn("text-xs font-mono", t.requiredMark)}>*</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-[10px] uppercase tracking-wider", t.typeBadge)}>
            {FIELD_TYPE_LABELS[field.type] ?? field.type}
          </span>
          {field.helpText && (
            <>
              <span className={t.helpDivider}>·</span>
              <span className={cn("text-[11px] truncate max-w-[200px]", t.helpText)}>
                {field.helpText}
              </span>
            </>
          )}
        </div>

        {/* Dropdown/multi-select preview */}
        {(field.type === "dropdown" || field.type === "multi-select") && field.options && field.options.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {field.options.slice(0, 4).map(opt => (
              <span key={opt.value} className={cn("text-[10px] font-mono border px-1.5 py-0.5 rounded-[2px]", t.optionPill)}>
                {opt.label}
              </span>
            ))}
            {field.options.length > 4 && (
              <span className={cn("text-[10px] font-mono", t.optionExtra)}>+{field.options.length - 4} more</span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons — show on hover/select */}
      <div className={`flex items-center gap-1 shrink-0 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          onClick={e => { e.stopPropagation(); onDuplicate(); }}
          className={cn("w-7 h-7 flex items-center justify-center rounded-[3px] transition-all", t.actionBtn)}
          title="Duplicate"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className={cn("w-7 h-7 flex items-center justify-center rounded-[3px] transition-all", t.deleteBtn)}
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
