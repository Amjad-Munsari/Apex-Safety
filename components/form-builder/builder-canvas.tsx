"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  type CollisionDetection,
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
import { SectionCard, SECTION_INNER_DROPPABLE_PREFIX } from "./section-card";

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
    overlayCard: "bg-[#2a2a2a] border border-teal/50",
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

/**
 * Pointer-first collision detection so nesting only happens when the pointer is
 * genuinely inside a section, not merely because the section's large card is the
 * "closest center" (the bug behind UAT test 34's "can't drop before a section").
 *
 * Priority when the pointer is over something:
 *  1. a child field         → reorder within / nest beside it
 *  2. a section inner zone   → nest into that section (and highlight it)
 *  3. otherwise (root field or section header) → sort among root cards, which is
 *     what lets a field be dropped *before* a section.
 * Falls back to closestCenter when the pointer is outside every droppable
 * (fast drags, keyboard sensor).
 */
/**
 * Reorder only commits once the dragged item covers this fraction of another
 * item (vs. dnd-kit's default ~50% center-crossing) — UAT test 34 "stickiness".
 * Sections are large, so they need more travel before they swap.
 */
const REORDER_OVERLAP_THRESHOLD = 0.7;
const SECTION_OVERLAP_THRESHOLD = 0.9;

function verticalOverlapRatio(
  a: { top: number; bottom: number; height: number },
  b: { top: number; bottom: number; height: number }
): number {
  const overlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const denom = Math.min(a.height, b.height) || 1;
  return overlap / denom;
}

// Both sectionGroup and repeatingSection nest child fields and behave as large
// drop containers in the canvas. Treat them uniformly for drag/nesting.
const CONTAINER_TYPES = new Set(["sectionGroup", "repeatingSection"]);
const isContainer = (type?: string): boolean => !!type && CONTAINER_TYPES.has(type);

const collisionDetectionStrategy: CollisionDetection = (args) => {
  // Keyboard sensor (no pointer) — keep dnd-kit's default behaviour.
  if (!args.pointerCoordinates) return closestCenter(args);

  // Sections are large → require more overlap before they reorder.
  const activeType = (args.active.data.current as { type?: string } | undefined)?.type;
  const threshold =
    isContainer(activeType) ? SECTION_OVERLAP_THRESHOLD : REORDER_OVERLAP_THRESHOLD;

  // Pointer-driven resolution when dragging a field. Priority by what the
  // pointer is actually over, so nesting and reordering coexist:
  //   1. a section CHILD      → drop beside it (reorder within / nest beside)
  //   2. a section inner zone → nest into that section
  //   3. any other root card  → reorder against it. This includes a SECTION's
  //      own card (its header strip, since the inner zone matched first above),
  //      which is what lets a field be dropped before OR after a section.
  if (!isContainer(activeType)) {
    const pointer = pointerWithin(args);
    const childHit = pointer.find((c) => String(c.id).startsWith("section:"));
    if (childHit) return [childHit];
    const innerHit = pointer.find((c) => String(c.id).startsWith(SECTION_INNER_DROPPABLE_PREFIX));
    if (innerHit) return [innerHit];
    const rootHit = pointer.find((c) => {
      const id = String(c.id);
      return !id.startsWith(SECTION_INNER_DROPPABLE_PREFIX) && !id.startsWith("section:");
    });
    if (rootHit) return [rootHit];
  }

  // Fallback for when the pointer is outside every droppable (fast drags, or
  // dragging below the last card to append after a trailing section): pick the
  // most-overlapped sortable card. Sections ARE eligible here so a field can
  // land below a section that is the last item on the canvas.
  const { collisionRect, droppableRects, droppableContainers } = args;
  let best: (typeof droppableContainers)[number] | null = null;
  let bestRatio = 0;
  for (const container of droppableContainers) {
    if (String(container.id).startsWith(SECTION_INNER_DROPPABLE_PREFIX)) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const ratio = verticalOverlapRatio(collisionRect, rect);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = container;
    }
  }
  if (best && bestRatio >= threshold) return [{ id: best.id }];
  return [];
};

export function BuilderCanvas({ builderStore, selectedId, onSelect, surface = "dark" }: Props) {
  const t = surfaceTokens[surface];
  const [activeId, setActiveId] = useState<string | null>(null);

  const storeData = useBuilderStoreData(builderStore, () => true);
  const schema = storeData.schema;
  const entities = schema.entities as Record<
    string,
    { type: string; attributes: Record<string, unknown>; children?: string[]; parentId?: string }
  >;
  const root = schema.root as string[];

  // One flat sortable list (root items + each section's scoped children, in
  // visual order) so dnd-kit's sibling-shifting works ACROSS containers — e.g.
  // dragging a field out of a section shifts the root items to show where it
  // will land, the same as any other reorder.
  const flatItems: string[] = [];
  for (const id of root) {
    flatItems.push(id);
    const e = entities[id];
    if (isContainer(e?.type)) {
      for (const childId of (e.children as string[]) ?? []) {
        flatItems.push(`section:${id}:${childId}`);
      }
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    const { sectionId: activeSectionId, entityId: activeEntityId } = decodeDragId(activeIdStr);

    // The dragged entity must still exist in the live store. Stale drag ids
    // (e.g. after a reparent/delete mid-interaction) would otherwise make
    // coltorapps' setEntityParent throw "Entity not found" and white-screen the
    // builder. Bail out quietly instead.
    if (!activeEntityId || !entities[activeEntityId]) return;

    // Nesting helper that no-ops on a missing/invalid target rather than letting
    // coltorapps throw. Re-checks against the live snapshot before mutating.
    const nestInto = (childId: string, parentId: string) => {
      if (!entities[childId] || !entities[parentId]) return;
      if (childId === parentId) return;
      const currentParent = entities[childId]?.parentId;
      if (currentParent === parentId) return;
      try {
        if (currentParent) builderStore.unsetEntityParent(childId);
        builderStore.setEntityParent(childId, parentId);
      } catch {
        // Reparent rejected by the store (stale id / not allowed) — ignore.
      }
    };

    // Case A: dropped on a section's inner drop zone — NEST into that section.
    // This is now the only "drop on a section" path that nests, which leaves
    // dropping on the section card itself free to reorder it as a sibling so a
    // field can be placed *before* a section (UAT test 34).
    if (overIdStr.startsWith(SECTION_INNER_DROPPABLE_PREFIX)) {
      const targetSectionId = overIdStr.slice(SECTION_INNER_DROPPABLE_PREFIX.length);
      nestInto(activeEntityId, targetSectionId);
      return;
    }

    const { sectionId: overSectionId_, entityId: overEntityId } = decodeDragId(overIdStr);

    // Case 2: Both are inside the same section — reorder within section
    if (activeSectionId && overSectionId_ && activeSectionId === overSectionId_) {
      const section = entities[activeSectionId];
      const children = (section?.children as string[]) ?? [];
      const oldIndex = children.indexOf(activeEntityId);
      const newIndex = children.indexOf(overEntityId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        try {
          builderStore.setEntityIndex(activeEntityId, newIndex);
        } catch {
          /* stale id — ignore */
        }
      }
      return;
    }

    // Case 3: Active is in a section, drop target is a root entity (incl. a
    // section card) — un-nest and position it at that root index. Dropping
    // onto a section card here lands the field just before it, not inside.
    if (activeSectionId && !overSectionId_) {
      try {
        builderStore.unsetEntityParent(activeEntityId);
        const newIndex = root.indexOf(overEntityId);
        if (newIndex !== -1) builderStore.setEntityIndex(activeEntityId, newIndex);
      } catch {
        // Stale id — ignore.
      }
      return;
    }

    // Case 3b: Active is in section X, drop target is a child of a DIFFERENT
    // section Y — move it across into Y. (Now reachable since repeating sections
    // also nest children.)
    if (activeSectionId && overSectionId_ && activeSectionId !== overSectionId_) {
      nestInto(activeEntityId, overSectionId_);
      return;
    }

    // Case 4: Active is at root, drop target is a field INSIDE a section —
    // nest it into that section alongside the hovered child.
    if (!activeSectionId && overSectionId_) {
      nestInto(activeEntityId, overSectionId_);
      return;
    }

    // Case 5: Both at root (incl. when the drop target is a section card) —
    // simple sibling reorder, so a field can be dropped before/after a section.
    if (!activeSectionId && !overSectionId_) {
      const oldIndex = root.indexOf(activeEntityId);
      const newIndex = root.indexOf(overEntityId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        try {
          builderStore.setEntityIndex(activeEntityId, newIndex);
        } catch {
          /* stale id — ignore */
        }
      }
    }
  }

  // Deep-duplicate an entity: clone its attributes verbatim and, for a
  // container, recursively clone its children. Internal conditional-rule
  // references (a rule whose source is another entity inside the cloned subtree)
  // are remapped to the new ids so the copy is self-contained; references to
  // entities OUTSIDE the subtree are kept as-is. Returns the new root id.
  function duplicateEntity(sourceId: string, parentId?: string): string | null {
    const idMap = new Map<string, string>();

    const cloneRec = (sid: string, pid?: string): string | null => {
      const src = entities[sid];
      if (!src) return null;
      // structuredClone preserves nested attribute data (options, visibilityRules).
      const attributes = structuredClone(src.attributes ?? {});
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cloned = builderStore.addEntity({ type: src.type, attributes } as any);
      idMap.set(sid, cloned.id);
      if (pid) builderStore.setEntityParent(cloned.id, pid);
      for (const childId of (src.children as string[]) ?? []) {
        cloneRec(childId, cloned.id);
      }
      return cloned.id;
    };

    const newRootId = cloneRec(sourceId, parentId);
    if (!newRootId) return null;

    // Remap intra-subtree rule sources so a duplicated section's internal
    // show/hide logic follows the copy rather than pointing back at the original.
    for (const [oldId, clonedId] of idMap) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rules = (entities[oldId]?.attributes as any)?.visibilityRules;
      if (!rules || !Array.isArray(rules.rules) || rules.rules.length === 0) continue;
      let changed = false;
      const remapped = {
        ...rules,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rules: rules.rules.map((r: any) => {
          if (r && typeof r.sourceEntityId === "string" && idMap.has(r.sourceEntityId)) {
            changed = true;
            return { ...r, sourceEntityId: idMap.get(r.sourceEntityId) };
          }
          return r;
        }),
      };
      if (changed) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          builderStore.setEntityAttribute(clonedId, "visibilityRules" as any, remapped as any);
        } catch {
          /* attribute set rejected — leave the cloned rule as-is */
        }
      }
    }

    return newRootId;
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
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={flatItems} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 max-w-2xl mx-auto">
          {root.map((entityId) => {
            const entity = entities[entityId];
            if (!entity) return null;

            if (isContainer(entity.type)) {
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
                  entity={{ id: entityId, type: entity.type as "sectionGroup" | "repeatingSection", attributes: entity.attributes, children: entity.children }}
                  childEntities={childEntities}
                  isSelected={selectedId === entityId}
                  onSelect={() => onSelect(entityId)}
                  onDuplicate={() => {
                    // Deep copy (attributes + children), placed right after the original.
                    const newId = duplicateEntity(entityId);
                    if (newId) {
                      const idx = root.indexOf(entityId);
                      if (idx !== -1) {
                        try { builderStore.setEntityIndex(newId, idx + 1); } catch { /* ignore */ }
                      }
                      onSelect(newId);
                    }
                  }}
                  onDelete={() => {
                    builderStore.deleteEntity(entityId);
                    if (selectedId === entityId) onSelect(null);
                  }}
                  selectedChildId={selectedId}
                  onSelectChild={(id) => onSelect(id)}
                  onDuplicateChild={(id) => {
                    // Deep copy the child within this section, after the original.
                    const newId = duplicateEntity(id, entityId);
                    if (newId) {
                      const children = (entities[entityId]?.children as string[]) ?? [];
                      const idx = children.indexOf(id);
                      if (idx !== -1) {
                        try { builderStore.setEntityIndex(newId, idx + 1); } catch { /* ignore */ }
                      }
                      onSelect(newId);
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
                  // Deep copy (attributes preserved), placed right after the original.
                  const newId = duplicateEntity(entityId);
                  if (newId) {
                    const idx = root.indexOf(entityId);
                    if (idx !== -1) {
                      try { builderStore.setEntityIndex(newId, idx + 1); } catch { /* ignore */ }
                    }
                    onSelect(newId);
                  }
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
