"use client";

import { cn } from "@/lib/utils";
import { useDraggable } from "@dnd-kit/core";
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Check,
  ChevronDown,
  Layers,
} from "lucide-react";

type EntityType =
  | "textField"
  | "numberField"
  | "dateField"
  | "selectField"
  | "textareaField"
  | "checkboxField"
  | "sectionGroup";

interface FieldDef {
  type: EntityType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const FIELDS: FieldDef[] = [
  { type: "textField", label: "Short Text", icon: Type, description: "Single-line text input" },
  { type: "numberField", label: "Number", icon: Hash, description: "Numeric input" },
  { type: "dateField", label: "Date", icon: Calendar, description: "Date picker" },
  { type: "selectField", label: "Select", icon: ChevronDown, description: "Single or multi choice from list" },
  { type: "textareaField", label: "Long Text", icon: AlignLeft, description: "Multi-line text" },
  { type: "checkboxField", label: "Checkbox", icon: Check, description: "Single tick or checkbox" },
  { type: "sectionGroup", label: "Section", icon: Layers, description: "Group fields in a section" },
];

interface Props {
  onAddEntity: (type: EntityType) => void;
  surface?: "dark" | "cream";
}

const surfaceTokens = {
  dark: {
    headerBorder: "border-white/5",
    headerLabel: "text-white/30",
    btnHover: "hover:bg-white/[0.05]",
    iconBox: "bg-white/5 border-white/10 group-hover:border-white/20",
    icon: "text-white/50 group-hover:text-white/80",
    label: "text-white/70 group-hover:text-white",
    desc: "text-white/25",
  },
  cream: {
    headerBorder: "border-[#e5e1d8]",
    headerLabel: "text-[#8a857f]",
    btnHover: "hover:bg-[#f0ede6]",
    iconBox: "bg-white border-[#e5e1d8] group-hover:border-[#1a1a1a]/30",
    icon: "text-[#6b6560] group-hover:text-[#1a1a1a]",
    label: "text-[#1a1a1a] group-hover:text-black",
    desc: "text-[#8a857f]",
  },
} as const;

function DraggablePaletteButton({
  fieldDef,
  onAddEntity,
  surface,
}: {
  fieldDef: FieldDef;
  onAddEntity: (type: EntityType) => void;
  surface: "dark" | "cream";
}) {
  const { type, label, icon: Icon, description } = fieldDef;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { entityType: type, fromPalette: true },
  });

  const t = surfaceTokens[surface];

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      key={type}
      onClick={() => onAddEntity(type)}
      aria-label={`Add ${label} field`}
      className={cn(
        "flex items-start gap-3 px-3 py-3 rounded-[3px] transition-colors text-left group w-full min-h-[48px]",
        t.btnHover,
        isDragging && "opacity-50"
      )}
    >
      <div
        className={cn(
          "w-7 h-7 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors",
          t.iconBox
        )}
      >
        <Icon className={cn("w-3.5 h-3.5 transition-colors", t.icon)} />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={cn("text-xs font-medium transition-colors leading-tight", t.label)}>
          {label}
        </span>
        <span className={cn("text-[10px] leading-tight", t.desc)}>{description}</span>
      </div>
    </button>
  );
}

export function FieldPalette({ onAddEntity, surface = "dark" }: Props) {
  const t = surfaceTokens[surface];
  return (
    <div className="flex flex-col gap-0">
      <div className={cn("px-4 py-3 border-b", t.headerBorder)}>
        <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.headerLabel)}>
          Field Types
        </span>
      </div>
      <div className="flex flex-col gap-0 p-2">
        {FIELDS.map((fieldDef) => (
          <DraggablePaletteButton
            key={fieldDef.type}
            fieldDef={fieldDef}
            onAddEntity={onAddEntity}
            surface={surface}
          />
        ))}
      </div>
    </div>
  );
}
