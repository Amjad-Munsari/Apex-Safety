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
import { saveDraft, publishTemplate } from "../../actions";
import { FieldPalette } from "./field-palette";
import { SortableField } from "./sortable-field";
import { FieldConfig } from "./field-config";
import type { FormField, FormSchema, FieldType } from "@/lib/types/form-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Upload, Eye } from "lucide-react";
import Link from "next/link";

interface Props {
  templateId: string;
  initialName: string;
  templateType: string;
  isPublished: boolean;
  initialSchema: FormSchema;
  versionNumber: number;
  hasDraft: boolean;
  publishedVersionNumber: number | null;
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

export function TemplateBuilder({
  templateId,
  initialName,
  templateType,
  isPublished,
  initialSchema,
  versionNumber,
  hasDraft,
  publishedVersionNumber,
}: Props) {
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
        await saveDraft(templateId, schema, name);
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
        await publishTemplate(templateId, schema, name);
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
      <div className="flex items-center gap-4 px-8 py-4 border-b border-white/5 bg-[#111] shrink-0">
        <Link
          href="/admin/templates"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-3 flex-1">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false); }}
            className="bg-transparent text-white font-serif text-xl outline-none border-b border-transparent focus:border-white/20 transition-colors px-0 py-0.5 min-w-0 w-72"
          />
          <span className="font-mono text-[10px] text-white/30 uppercase tracking-wider shrink-0">
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
            <span className="font-mono text-[10px] text-[#3b8273] uppercase tracking-wider">Saved</span>
          )}
          {saveStatus === "error" && (
            <span className="font-mono text-[10px] text-[#8b2b21] uppercase tracking-wider">Save failed</span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isPending || saved}
            className="text-white/50 hover:text-white h-8 gap-2 font-mono text-xs"
          >
            <Save className="w-3.5 h-3.5" />
            {saveStatus === "saving" ? "Saving…" : "Save draft"}
          </Button>

          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPending || fields.length === 0}
            className="bg-[#3b8273] hover:bg-[#3b8273]/90 text-white rounded-sm h-8 gap-2 font-mono text-xs px-4"
          >
            <Upload className="w-3.5 h-3.5" />
            Publish
          </Button>
        </div>
      </div>

      {/* Builder body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Field palette */}
        <div className="w-56 border-r border-white/5 overflow-y-auto bg-[#0d0d0d] shrink-0">
          <FieldPalette onAdd={addField} />
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-y-auto p-6">
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center">
                <Eye className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-white/30 text-sm font-mono">Drag fields from the left panel</p>
              <p className="text-white/20 text-xs">or click a field type to add it</p>
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
        <div className="w-72 border-l border-white/5 overflow-y-auto bg-[#0d0d0d] shrink-0">
          {selectedField ? (
            <FieldConfig
              field={selectedField}
              onChange={(updates) => updateField(selectedField.id, updates)}
            />
          ) : (
            <div className="flex items-center justify-center h-full p-6 text-center">
              <p className="text-white/20 text-xs font-mono">Select a field to configure</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: field count */}
      <div className="px-8 py-2.5 border-t border-white/5 bg-[#111] flex items-center gap-4 shrink-0">
        <span className="font-mono text-[10px] text-white/30 uppercase tracking-wider">
          {fields.length} field{fields.length !== 1 ? "s" : ""}
        </span>
        {!saved && (
          <span className="font-mono text-[10px] text-[#c0a66d] uppercase tracking-wider">
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
