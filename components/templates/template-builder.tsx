"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { FieldPalette } from "./field-palette";
import { SortableField } from "./sortable-field";
import { FieldConfig } from "./field-config";
import type { FormField, FormSchema, FieldType, BuilderSurface } from "@/lib/types/form-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Upload, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type TemplateAction = (templateId: string, schema: FormSchema, templateName: string) => Promise<void>;

interface Props {
  templateId: string;
  initialName: string;
  templateType: string;
  isPublished: boolean;
  initialSchema: FormSchema;
  versionNumber: number;
  hasDraft: boolean;
  publishedVersionNumber: number | null;
  surface?: BuilderSurface;
  saveAction: TemplateAction;
  publishAction: TemplateAction;
  backHref?: string;
}

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

function generateKey(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40) || `field_${Date.now()}`;
}

function defaultField(type: FieldType): FormField {
  const label = type.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return {
    id: generateId(),
    key: generateKey(label + "_" + generateId()),
    type,
    label,
    required: false,
    placeholder: "",
    helpText: "",
    options: type === "dropdown" || type === "multi-select" ? [{ label: "Option 1", value: "option_1" }] : undefined,
    maxPhotos: type === "multi-photo" ? 5 : undefined,
    maxRating: type === "rating" ? 5 : undefined,
    fields: type === "repeating" ? [] : undefined,
  };
}

const surfaceTokens = {
  dark: {
    toolbar: "bg-[#111] border-white/5",
    panel: "bg-[#0d0d0d] border-white/5",
    canvasBg: "",
    titleInput: "text-white border-transparent focus:border-white/20",
    typeLabel: "text-white/30",
    backLink: "text-white/40 hover:text-white",
    saveLabel: "text-white/50 hover:text-white",
    savedTag: "text-[#3b8273]",
    errorTag: "text-[#8b2b21]",
    publishBtn: "bg-[#3b8273] hover:bg-[#3b8273]/90 text-white",
    emptyIconRing: "border-white/10",
    emptyIcon: "text-white/20",
    emptyText: "text-white/30",
    emptySubtext: "text-white/20",
    bottomBar: "bg-[#111] border-white/5 text-white/30",
    unsavedTag: "text-[#c0a66d]",
    selectPanelText: "text-white/20",
  },
  cream: {
    toolbar: "bg-white border-[#e5e1d8]",
    panel: "bg-[#faf9f6] border-[#e5e1d8]",
    canvasBg: "bg-[#fbfaf5]",
    titleInput: "text-[#1a1a1a] border-transparent focus:border-[#1a1a1a]/20",
    typeLabel: "text-[#8a857f]",
    backLink: "text-[#6b6560] hover:text-black",
    saveLabel: "text-[#6b6560] hover:text-black",
    savedTag: "text-[#3b8273]",
    errorTag: "text-[#8b2b21]",
    publishBtn: "bg-[#1a1a1a] hover:bg-black text-white",
    emptyIconRing: "border-[#e5e1d8]",
    emptyIcon: "text-[#a8a39d]",
    emptyText: "text-[#6b6560]",
    emptySubtext: "text-[#8a857f]",
    bottomBar: "bg-white border-[#e5e1d8] text-[#8a857f]",
    unsavedTag: "text-[#c0a66d]",
    selectPanelText: "text-[#8a857f]",
  },
} as const;

export function TemplateBuilder({
  templateId,
  initialName,
  templateType,
  isPublished,
  initialSchema,
  versionNumber,
  hasDraft,
  publishedVersionNumber,
  surface = "dark",
  saveAction,
  publishAction,
  backHref,
}: Props) {
  const t = surfaceTokens[surface];
  const resolvedBackHref = backHref ?? (surface === "cream" ? "/client/templates" : "/admin/templates");
  const [name, setName] = useState(initialName);
  const [fields, setFields] = useState<FormField[]>(initialSchema?.fields ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedField = fields.find(f => f.id === selectedId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFields(prev => {
        const oldIndex = prev.findIndex(f => f.id === active.id);
        const newIndex = prev.findIndex(f => f.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      setSaved(false);
    }
  }

  function addField(type: FieldType) {
    const field = defaultField(type);
    setFields(prev => [...prev, field]);
    setSelectedId(field.id);
    setSaved(false);
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    setSaved(false);
  }

  function duplicateField(id: string) {
    const field = fields.find(f => f.id === id);
    if (!field) return;
    const copy: FormField = { ...field, id: generateId(), key: field.key + "_copy" };
    const idx = fields.findIndex(f => f.id === id);
    setFields(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setSelectedId(copy.id);
    setSaved(false);
  }

  function deleteField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id));
    if (selectedId === id) setSelectedId(null);
    setSaved(false);
  }

  function handleSave() {
    const schema: FormSchema = { fields };
    setSaveStatus("saving");
    startTransition(async () => {
      try {
        await saveAction(templateId, schema, name);
        setSaved(true);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    });
  }

  function handlePublish() {
    if (!confirm(`Publish v${versionNumber}? This version will become immutable and be available to assign to clients.`)) return;
    const schema: FormSchema = { fields };
    startTransition(async () => {
      try {
        await publishAction(templateId, schema, name);
        setSaved(true);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch {
        setSaveStatus("error");
      }
    });
  }

  const activeField = fields.find(f => f.id === activeId);

  return (
    <div className="flex flex-col h-full gap-0 -mt-8 -mx-8">
      {/* Top toolbar */}
      <div className={cn("flex items-center gap-4 px-8 py-4 border-b shrink-0", t.toolbar)}>
        <Link
          href={resolvedBackHref}
          className={cn("transition-colors", t.backLink)}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false); }}
            className={cn("bg-transparent font-serif text-xl outline-none border-b transition-colors px-0 py-0.5 min-w-0 w-72", t.titleInput)}
          />
          <span className={cn("font-mono text-[10px] uppercase tracking-wider shrink-0", t.typeLabel)}>
            {templateType}
          </span>
          {hasDraft && !isPublished ? (
            <Badge className="bg-[#c0a66d]/20 text-[#c0a66d] border-[#c0a66d]/30 text-[10px] font-mono shrink-0">
              DRAFT v{versionNumber}
            </Badge>
          ) : isPublished ? (
            <Badge className="bg-[#3b8273]/20 text-[#3b8273] border-[#3b8273]/30 text-[10px] font-mono shrink-0">
              LIVE v{publishedVersionNumber}
            </Badge>
          ) : null}
          {hasDraft && isPublished && (
            <Badge className="bg-[#c0a66d]/20 text-[#c0a66d] border-[#c0a66d]/30 text-[10px] font-mono shrink-0">
              UNPUBLISHED EDITS
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {saveStatus === "saved" && (
            <span className={cn("font-mono text-[10px] uppercase tracking-wider", t.savedTag)}>Saved</span>
          )}
          {saveStatus === "error" && (
            <span className={cn("font-mono text-[10px] uppercase tracking-wider", t.errorTag)}>Save failed</span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isPending || saved}
            className={cn("h-8 gap-2 font-mono text-xs", t.saveLabel)}
          >
            <Save className="w-3.5 h-3.5" />
            {saveStatus === "saving" ? "Saving…" : "Save draft"}
          </Button>

          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPending || fields.length === 0}
            className={cn("rounded-sm h-8 gap-2 font-mono text-xs px-4", t.publishBtn)}
          >
            <Upload className="w-3.5 h-3.5" />
            Publish
          </Button>
        </div>
      </div>

      {/* Builder body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Field palette */}
        <div className={cn("w-56 border-r overflow-y-auto shrink-0", t.panel)}>
          <FieldPalette onAdd={addField} surface={surface} />
        </div>

        {/* Center: Canvas */}
        <div className={cn("flex-1 overflow-y-auto p-6", t.canvasBg)}>
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className={cn("w-14 h-14 rounded-full border flex items-center justify-center", t.emptyIconRing)}>
                <Eye className={cn("w-6 h-6", t.emptyIcon)} />
              </div>
              <p className={cn("text-sm font-mono", t.emptyText)}>Drag fields from the left panel</p>
              <p className={cn("text-xs", t.emptySubtext)}>or click a field type to add it</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2 max-w-2xl mx-auto">
                  {fields.map((field) => (
                    <SortableField
                      key={field.id}
                      field={field}
                      isSelected={selectedId === field.id}
                      onSelect={() => setSelectedId(field.id)}
                      onDuplicate={() => duplicateField(field.id)}
                      onDelete={() => deleteField(field.id)}
                      surface={surface}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeField ? (
                  <div className="bg-[#2a2a2a] border border-[#3b8273]/50 rounded-sm px-4 py-3 shadow-2xl opacity-90">
                    <span className="text-white text-sm font-medium">{activeField.label}</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Right: Field config */}
        <div className={cn("w-72 border-l overflow-y-auto shrink-0", t.panel)}>
          {selectedField ? (
            <FieldConfig
              field={selectedField}
              onChange={(updates) => updateField(selectedField.id, updates)}
              surface={surface}
            />
          ) : (
            <div className="flex items-center justify-center h-full p-6 text-center">
              <p className={cn("text-xs font-mono", t.selectPanelText)}>Select a field to configure</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: field count */}
      <div className={cn("px-8 py-2.5 border-t flex items-center gap-4 shrink-0", t.bottomBar)}>
        <span className="font-mono text-[10px] uppercase tracking-wider">
          {fields.length} field{fields.length !== 1 ? "s" : ""}
        </span>
        {!saved && (
          <span className={cn("font-mono text-[10px] uppercase tracking-wider", t.unsavedTag)}>
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
