"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField } from "@/lib/types/form-builder";
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
}

export function SortableField({ field, isSelected, onSelect, onDuplicate, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`
        group relative flex items-start gap-3 px-4 py-4 rounded-sm border cursor-pointer transition-all
        ${isSelected
          ? "bg-[#1e2e2b] border-[#3b8273]/50 shadow-[0_0_0_1px_rgba(59,130,115,0.2)]"
          : "bg-[#1c1c1c] border-white/5 hover:border-white/10 hover:bg-[#222]"
        }
      `}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="mt-0.5 text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing transition-colors shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Field preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-medium text-white leading-tight">
            {field.label}
          </span>
          {field.required && (
            <span className="text-[#8b2b21] text-xs font-mono">*</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-white/30 uppercase tracking-wider">
            {FIELD_TYPE_LABELS[field.type] ?? field.type}
          </span>
          {field.helpText && (
            <>
              <span className="text-white/20">·</span>
              <span className="text-[11px] text-white/25 truncate max-w-[200px]">
                {field.helpText}
              </span>
            </>
          )}
        </div>

        {/* Dropdown/multi-select preview */}
        {(field.type === "dropdown" || field.type === "multi-select") && field.options && field.options.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {field.options.slice(0, 4).map(opt => (
              <span key={opt.value} className="text-[10px] font-mono text-white/30 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[2px]">
                {opt.label}
              </span>
            ))}
            {field.options.length > 4 && (
              <span className="text-[10px] font-mono text-white/20">+{field.options.length - 4} more</span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons — show on hover/select */}
      <div className={`flex items-center gap-1 shrink-0 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          onClick={e => { e.stopPropagation(); onDuplicate(); }}
          className="w-7 h-7 flex items-center justify-center rounded-[3px] text-white/30 hover:text-white/70 hover:bg-white/5 transition-all"
          title="Duplicate"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="w-7 h-7 flex items-center justify-center rounded-[3px] text-white/30 hover:text-[#8b2b21] hover:bg-[#8b2b21]/10 transition-all"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
