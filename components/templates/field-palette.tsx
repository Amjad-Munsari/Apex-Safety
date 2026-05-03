"use client";

import type { FieldType, BuilderSurface } from "@/lib/types/form-builder";
import { cn } from "@/lib/utils";
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  ChevronDown,
  CheckSquare,
  PenLine,
  Star,
  Camera,
  MapPin,
  Repeat,
} from "lucide-react";

interface FieldDef {
  type: FieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const FIELDS: FieldDef[] = [
  { type: "text", label: "Short Text", icon: Type, description: "Single-line text input" },
  { type: "textarea", label: "Long Text", icon: AlignLeft, description: "Multi-line text or STT" },
  { type: "number", label: "Number", icon: Hash, description: "Numeric input" },
  { type: "date", label: "Date", icon: Calendar, description: "Date picker" },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown, description: "Single choice from list" },
  { type: "multi-select", label: "Multi-Select", icon: CheckSquare, description: "Multiple choices" },
  { type: "signature", label: "Signature", icon: PenLine, description: "Finger/stylus signature" },
  { type: "rating", label: "Rating", icon: Star, description: "1–5 star or number rating" },
  { type: "multi-photo", label: "Photos", icon: Camera, description: "Multiple photo upload" },
  { type: "geolocation", label: "Location", icon: MapPin, description: "GPS coordinates" },
  { type: "repeating", label: "Repeating Section", icon: Repeat, description: "Repeat a group of fields" },
];

interface Props {
  onAdd: (type: FieldType) => void;
  surface?: BuilderSurface;
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

export function FieldPalette({ onAdd, surface = "dark" }: Props) {
  const t = surfaceTokens[surface];
  return (
    <div className="flex flex-col gap-0">
      <div className={cn("px-4 py-3 border-b", t.headerBorder)}>
        <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.headerLabel)}>
          Field Types
        </span>
      </div>
      <div className="flex flex-col gap-0 p-2">
        {FIELDS.map(({ type, label, icon: Icon, description }) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className={cn(
              "flex items-start gap-3 px-3 py-3 rounded-[3px] transition-colors text-left group w-full",
              t.btnHover
            )}
          >
            <div className={cn(
              "w-7 h-7 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors",
              t.iconBox
            )}>
              <Icon className={cn("w-3.5 h-3.5 transition-colors", t.icon)} />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className={cn("text-xs font-medium transition-colors leading-tight", t.label)}>
                {label}
              </span>
              <span className={cn("text-[10px] leading-tight", t.desc)}>
                {description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
