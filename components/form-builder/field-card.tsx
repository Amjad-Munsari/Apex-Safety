"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical, Copy, Trash2 } from "lucide-react";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  textField: "Short Text",
  numberField: "Number",
  dateField: "Date",
  selectField: "Select",
  textareaField: "Long Text",
  checkboxField: "Checkbox",
  sectionGroup: "Section",
  // Phase 14 specialty types — names must match the palette (field-palette.tsx)
  multiPhotoField: "Photos",
  geolocationField: "Location",
  computedField: "Computed",
  repeatingSection: "Repeating Section",
};

interface Entity {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

interface Props {
  entity: Entity;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  surface?: "dark" | "cream";
  /** Drag item id prefix — defaults to entityId. Pass a scoped id when inside a section. */
  dragId?: string;
}

const surfaceTokens = {
  dark: {
    base: "bg-[#1c1c1c] border-white/5 hover:border-white/10 hover:bg-[#222]",
    selected: "bg-[#1e2e2b] border-[#3b8273]/50 shadow-[0_0_0_1px_rgba(59,130,115,0.2)]",
    grip: "text-white/20 hover:text-white/50",
    label: "text-white",
    typeBadge: "text-white/30",
    actionBtn: "text-white/30 hover:text-white/70 hover:bg-white/5",
    deleteBtn: "text-white/30 hover:text-[#8b2b21] hover:bg-[#8b2b21]/10",
  },
  cream: {
    base: "bg-white border-[#e5e1d8] hover:border-[#1a1a1a]/15 hover:bg-[#faf9f6]",
    selected: "bg-[#f5f3ee] border-[#1a1a1a] shadow-[0_0_0_1px_rgba(26,26,26,0.15)]",
    grip: "text-[#8a857f] hover:text-[#1a1a1a]",
    label: "text-[#1a1a1a]",
    typeBadge: "text-[#8a857f]",
    actionBtn: "text-[#8a857f] hover:text-[#1a1a1a] hover:bg-[#f0ede6]",
    deleteBtn: "text-[#8a857f] hover:text-[#8b2b21] hover:bg-[#8b2b21]/10",
  },
} as const;

export function FieldCard({
  entity,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  surface = "dark",
  dragId,
}: Props) {
  const sortableId = dragId ?? entity.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { entityId: entity.id, type: entity.type },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const t = surfaceTokens[surface];
  const label = (entity.attributes.label as string) ?? "";
  const typeLabel = ENTITY_TYPE_LABELS[entity.type] ?? entity.type;

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
        onClick={(e) => e.stopPropagation()}
        aria-describedby="drag-instructions"
        className={cn("mt-0.5 cursor-grab active:cursor-grabbing transition-colors shrink-0", t.grip)}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Field preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-sm font-semibold leading-tight", t.label)}>
            {label || "(no label)"}
          </span>
        </div>
        <span className={cn("font-mono text-xs uppercase tracking-wider", t.typeBadge)}>
          {typeLabel}
        </span>
      </div>

      {/* Action buttons — appear on hover/select */}
      <div
        className={cn(
          "flex items-center gap-1 shrink-0 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          aria-label="Duplicate field"
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-[3px] transition-all",
            t.actionBtn
          )}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete field"
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-[3px] transition-all",
            t.deleteBtn
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hidden drag instructions for screen readers */}
      <span id="drag-instructions" className="sr-only">
        Press space to pick up, arrow keys to move, space to drop.
      </span>
    </div>
  );
}
