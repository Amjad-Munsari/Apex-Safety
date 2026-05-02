"use client";

import type { FieldType } from "@/lib/types/form-builder";
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
}

export function FieldPalette({ onAdd }: Props) {
  return (
    <div className="flex flex-col gap-0">
      <div className="px-4 py-3 border-b border-white/5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
          Field Types
        </span>
      </div>
      <div className="flex flex-col gap-0 p-2">
        {FIELDS.map(({ type, label, icon: Icon, description }) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="flex items-start gap-3 px-3 py-3 rounded-[3px] hover:bg-white/[0.05] transition-colors text-left group w-full"
          >
            <div className="w-7 h-7 rounded-[3px] bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-white/20 transition-colors">
              <Icon className="w-3.5 h-3.5 text-white/50 group-hover:text-white/80 transition-colors" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors leading-tight">
                {label}
              </span>
              <span className="text-[10px] text-white/25 leading-tight">
                {description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
