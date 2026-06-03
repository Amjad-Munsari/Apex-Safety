"use client";

import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical, Copy, Trash2 } from "lucide-react";
import { FieldCard } from "./field-card";
import type { BuilderStore } from "@coltorapps/builder";
import type { formBuilder } from "@/lib/form-builder";

/**
 * Drag id prefix for a section's inner "drop fields here" zone. Dropping on
 * this droppable is the (only) way to NEST a field into the section — which
 * frees up dropping on the section card itself to reorder it as a sibling, so
 * a field can be placed *before* a section (UAT test 34).
 */
export const SECTION_INNER_DROPPABLE_PREFIX = "secdrop:";

interface SectionEntity {
  id: string;
  type: "sectionGroup";
  attributes: Record<string, unknown>;
  children?: string[];
}

interface ChildEntity {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

interface Props {
  entity: SectionEntity;
  childEntities: ChildEntity[];
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  selectedChildId: string | null;
  onSelectChild: (id: string) => void;
  onDuplicateChild: (id: string) => void;
  onDeleteChild: (id: string) => void;
  builderStore: BuilderStore<typeof formBuilder>;
  surface?: "dark" | "cream";
}

const surfaceTokens = {
  dark: {
    base: "bg-[#1c1c1c] border-white/5",
    selected: "bg-[#1e2e2b] border-[#3b8273]/50",
    grip: "text-white/20 group-hover/header:text-white/50",
    title: "text-white",
    dropZone: "border-white/10",
    dropZoneActive: "border-[#3b8273] bg-[#3b8273]/10",
    dropZoneText: "text-white/20",
    dropZoneTextActive: "text-[#3b8273]",
    actionBtn: "text-white/30 hover:text-white/70 hover:bg-white/5",
    deleteBtn: "text-white/30 hover:text-[#8b2b21] hover:bg-[#8b2b21]/10",
  },
  cream: {
    base: "bg-white border-[#e5e1d8]",
    selected: "bg-[#f5f3ee] border-[#1a1a1a]",
    grip: "text-[#8a857f] group-hover/header:text-[#1a1a1a]",
    title: "text-[#1a1a1a]",
    dropZone: "border-[#e5e1d8]",
    dropZoneActive: "border-[#1a1a1a] bg-[#1a1a1a]/5",
    dropZoneText: "text-[#8a857f]",
    dropZoneTextActive: "text-[#1a1a1a]",
    actionBtn: "text-[#8a857f] hover:text-[#1a1a1a] hover:bg-[#f0ede6]",
    deleteBtn: "text-[#8a857f] hover:text-[#8b2b21] hover:bg-[#8b2b21]/10",
  },
} as const;

export function SectionCard({
  entity,
  childEntities,
  isSelected,
  onSelect,
  onDuplicate,
  onDelete,
  selectedChildId,
  onSelectChild,
  onDuplicateChild,
  onDeleteChild,
  surface = "dark",
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entity.id,
    data: { entityId: entity.id, type: "sectionGroup" },
  });

  // Dedicated droppable for the inner "drop fields here" zone. `isOverInner`
  // drives the highlight so a drag clearly signals it will nest INSIDE the
  // section (UAT test 34), and dropping here is what nests (see handleDragEnd).
  const { setNodeRef: setInnerDropRef, isOver: isOverInner } = useDroppable({
    id: `${SECTION_INNER_DROPPABLE_PREFIX}${entity.id}`,
    data: { sectionId: entity.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const t = surfaceTokens[surface];
  const title = (entity.attributes.title as string) ?? "Untitled Section";

  // Child drag IDs are scoped with section prefix to avoid ID collisions (RESEARCH.md Pitfall 1)
  const childDragIds = childEntities.map((child) => `section:${entity.id}:${child.id}`);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group relative rounded-sm border cursor-pointer transition-all p-4",
        isSelected ? t.selected : t.base
      )}
    >
      {/* Section header — the entire header row is the drag handle (UAT test 34),
          so the section can be grabbed from anywhere across the box, not just
          the small grip. Children live in the inner zone below and keep their
          own handles, so this doesn't capture their drags. */}
      <div
        {...attributes}
        {...listeners}
        aria-describedby="section-drag-instructions"
        className="group/header flex items-start gap-3 mb-3 cursor-grab active:cursor-grabbing"
      >
        {/* Drag affordance (the whole header is draggable) */}
        <div className={cn("mt-1 transition-colors shrink-0", t.grip)}>
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Section title */}
        <div className="flex-1 min-w-0">
          <h3 className={cn("font-serif text-lg font-normal leading-[1.3]", t.title)}>
            {title}
          </h3>
        </div>

        {/* Action buttons */}
        <div
          className={cn(
            "flex items-center gap-1 shrink-0 transition-opacity",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <button
            onPointerDown={(e) => e.stopPropagation()}
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
            onPointerDown={(e) => e.stopPropagation()}
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
      </div>

      {/* Inset drop zone for child fields — dropping here nests into the section.
          Highlights while a drag hovers it so the nest target is obvious. */}
      <div
        ref={setInnerDropRef}
        className={cn(
          "mt-2 min-h-[48px] border-2 border-dashed rounded-sm p-2 transition-colors",
          isOverInner ? t.dropZoneActive : t.dropZone
        )}
      >
        {childEntities.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[48px]">
            <p className={cn("text-xs font-mono transition-colors", isOverInner ? t.dropZoneTextActive : t.dropZoneText)}>
              Drop fields here
            </p>
          </div>
        ) : (
          <SortableContext items={childDragIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {childEntities.map((child) => (
                <FieldCard
                  key={child.id}
                  entity={child}
                  dragId={`section:${entity.id}:${child.id}`}
                  isSelected={selectedChildId === child.id}
                  onSelect={() => {
                    onSelectChild(child.id);
                  }}
                  onDuplicate={() => onDuplicateChild(child.id)}
                  onDelete={() => onDeleteChild(child.id)}
                  surface={surface}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>

      <span id="section-drag-instructions" className="sr-only">
        Press space to pick up, arrow keys to move, space to drop.
      </span>
    </div>
  );
}
