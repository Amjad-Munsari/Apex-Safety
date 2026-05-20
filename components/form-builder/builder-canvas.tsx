"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useBuilderStoreData } from "@coltorapps/builder-react";
import type { BuilderStore } from "@coltorapps/builder";
import type { formBuilder } from "@/lib/form-builder";
import { cn } from "@/lib/utils";
import { FieldCard } from "./field-card";
import { SectionCard } from "./section-card";

interface Props {
  builderStore: BuilderStore<typeof formBuilder>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  surface?: "dark" | "cream";
}

const surfaceTokens = {
  dark: {
    emptyText: "text-white/30",
    emptySubtext: "text-white/20",
    overlayCard: "bg-[#2a2a2a] border border-[#3b8273]/50",
    overlayText: "text-white",
  },
  cream: {
    emptyText: "text-[#6b6560]",
    emptySubtext: "text-[#8a857f]",
    overlayCard: "bg-white border border-[#1a1a1a]/30",
    overlayText: "text-[#1a1a1a]",
  },
} as const;

/**
 * Decodes a scoped drag item ID.
 *
 * Root entity IDs are plain UUIDs: "550e8400-e29b-41d4-a716-446655440000"
 * Palette items: "palette-textField"
 * Section-scoped child IDs: "section:<sectionId>:<childId>"
 *
 * This encoding avoids ID collisions between section children (RESEARCH.md Pitfall 1).
 */
function decodeDragId(id: string): { sectionId: string | null; entityId: string } {
  if (id.startsWith("section:")) {
    const parts = id.split(":");
    // "section:<sectionId>:<childId>" — sectionId may itself contain colons (it won't, it's a UUID)
    const sectionId = parts[1];
    const entityId = parts[2];
    return { sectionId, entityId };
  }
  return { sectionId: null, entityId: id };
}

export function BuilderCanvas({ builderStore, selectedId, onSelect, surface = "dark" }: Props) {
  const t = surfaceTokens[surface];
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overSectionId, setOverSectionId] = useState<string | null>(null);

  const storeData = useBuilderStoreData(builderStore, () => true);
  const schema = storeData.schema;
  const entities = schema.entities as Record<
    string,
    { type: string; attributes: Record<string, unknown>; children?: string[]; parentId?: string }
  >;
  const root = schema.root as string[];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over?.id as string | undefined;
    if (!overId) {
      setOverSectionId(null);
      return;
    }
    const decoded = decodeDragId(overId);
    if (decoded.sectionId) {
      setOverSectionId(decoded.sectionId);
    } else if (entities[overId]?.type === "sectionGroup") {
      setOverSectionId(overId);
    } else {
      setOverSectionId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    setOverSectionId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const { sectionId: activeSectionId, entityId: activeEntityId } = decodeDragId(activeIdStr);
    const { sectionId: overSectionId_, entityId: overEntityId } = decodeDragId(overIdStr);

    // Case 1: Drop onto a section group container — reparent into that section
    if (overEntityId && entities[overEntityId]?.type === "sectionGroup" && activeEntityId !== overEntityId) {
      const currentParent = entities[activeEntityId]?.parentId;
      if (currentParent) {
        // Move within sections or un-nest then re-nest
        builderStore.unsetEntityParent(activeEntityId);
      }
      if (overEntityId !== currentParent) {
        builderStore.setEntityParent(activeEntityId, overEntityId);
      }
      return;
    }

    // Case 2: Both are inside the same section — reorder within section
    if (activeSectionId && overSectionId_ && activeSectionId === overSectionId_) {
      const section = entities[activeSectionId];
      const children = (section?.children as string[]) ?? [];
      const oldIndex = children.indexOf(activeEntityId);
      const newIndex = children.indexOf(overEntityId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        builderStore.setEntityIndex(activeEntityId, newIndex);
      }
      return;
    }

    // Case 3: Active is in a section, drop target is at root — un-nest
    if (activeSectionId && !overSectionId_) {
      builderStore.unsetEntityParent(activeEntityId);
      // Then reorder to the correct root position
      const newIndex = root.indexOf(overEntityId);
      if (newIndex !== -1) {
        builderStore.setEntityIndex(activeEntityId, newIndex);
      }
      return;
    }

    // Case 4: Active is at root, drop is inside a section — reparent
    if (!activeSectionId && overSectionId_) {
      builderStore.setEntityParent(activeEntityId, overSectionId_);
      return;
    }

    // Case 5: Both at root — simple reorder
    if (!activeSectionId && !overSectionId_) {
      const oldIndex = root.indexOf(activeEntityId);
      const newIndex = root.indexOf(overEntityId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        builderStore.setEntityIndex(activeEntityId, newIndex);
      }
    }
  }

  // Build drag overlay info
  const activeDecodedId = activeId ? decodeDragId(activeId) : null;
  const activeEntity = activeDecodedId ? entities[activeDecodedId.entityId] : null;
  const activeLabel = (activeEntity?.attributes?.label as string) ?? (activeEntity?.attributes?.sectionTitle as string) ?? "";

  if (root.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <p className={cn("text-sm font-mono", t.emptyText)}>Drag fields from the left panel</p>
        <p className={cn("text-xs", t.emptySubtext)}>or click a field type to add it</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={root} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 max-w-2xl mx-auto">
          {root.map((entityId) => {
            const entity = entities[entityId];
            if (!entity) return null;

            if (entity.type === "sectionGroup") {
              const childIds = (entity.children as string[]) ?? [];
              const childEntities = childIds
                .map((cId) => ({ id: cId, ...entities[cId] }))
                .filter(Boolean) as Array<{
                id: string;
                type: string;
                attributes: Record<string, unknown>;
                children?: string[];
              }>;

              return (
                <SectionCard
                  key={entityId}
                  entity={{ id: entityId, type: "sectionGroup", attributes: entity.attributes, children: entity.children }}
                  childEntities={childEntities}
                  isSelected={selectedId === entityId}
                  onSelect={() => onSelect(entityId)}
                  onDuplicate={() => {
                    // Add new sectionGroup — duplicate copies type only (no deep attribute cloning in Phase 13)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    builderStore.addEntity({ type: "sectionGroup", attributes: {} } as any);
                  }}
                  onDelete={() => {
                    builderStore.deleteEntity(entityId);
                    if (selectedId === entityId) onSelect(null);
                  }}
                  selectedChildId={selectedId}
                  onSelectChild={(id) => onSelect(id)}
                  onDuplicateChild={(id) => {
                    const child = entities[id];
                    if (child) {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const newEntity = builderStore.addEntity({ type: child.type, attributes: {} } as any);
                      builderStore.setEntityParent(newEntity.id, entityId);
                    }
                  }}
                  onDeleteChild={(id) => {
                    builderStore.deleteEntity(id);
                    if (selectedId === id) onSelect(null);
                  }}
                  builderStore={builderStore}
                  surface={surface}
                />
              );
            }

            return (
              <FieldCard
                key={entityId}
                entity={{ id: entityId, type: entity.type, attributes: entity.attributes }}
                isSelected={selectedId === entityId}
                onSelect={() => onSelect(entityId)}
                onDuplicate={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  builderStore.addEntity({ type: entity.type, attributes: {} } as any);
                }}
                onDelete={() => {
                  builderStore.deleteEntity(entityId);
                  if (selectedId === entityId) onSelect(null);
                }}
                surface={surface}
              />
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId && activeEntity ? (
          <div
            className={cn(
              "rounded-sm px-4 py-3 shadow-2xl opacity-90",
              t.overlayCard
            )}
          >
            <span className={cn("text-sm font-medium", t.overlayText)}>
              {activeLabel || "(no label)"}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
