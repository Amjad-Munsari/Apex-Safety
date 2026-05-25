"use client";

import { useState } from "react";
import {
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Check,
  ChevronDown,
  Layers,
  Plus,
  X,
  PenLine,
  Star,
  Camera,
  MapPin,
  Calculator,
  ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuilderStore } from "@coltorapps/builder";
import type { formBuilder } from "@/lib/form-builder";

type Surface = "dark" | "cream";

interface Props {
  builderStore: BuilderStore<typeof formBuilder>;
  selectedId: string | null;
  entities: Record<
    string,
    { type: string; attributes: Record<string, unknown>; children?: string[]; parentId?: string }
  >;
  surface?: Surface;
}

const surfaceTokens = {
  dark: {
    headerBorder: "border-white/5",
    headerLabel: "text-white/30",
    label: "text-white/40",
    input:
      "bg-transparent border-white/10 text-white placeholder:text-white/20 focus:border-white/30",
    helpHint: "text-white/20",
    toggleOn: "bg-[#3b8273]",
    toggleOff: "bg-white/10",
    toggleKnob: "bg-white",
    optionInput: "bg-transparent border-white/10 text-white focus:border-white/30",
    optionRemove: "text-white/20 hover:text-[#8b2b21]",
    addOptionInput:
      "bg-transparent border-dashed border-white/10 text-white placeholder:text-white/20 focus:border-white/20",
    addOptionBtn: "text-white/30 hover:text-[#3b8273]",
    select: "bg-[#111] border-white/10 text-white focus:border-white/30",
    selectPanelText: "text-white/20",
    typeFooter: "border-white/5 text-white/20",
    formulaMono: "text-[#3b8273]",
  },
  cream: {
    headerBorder: "border-[#e5e1d8]",
    headerLabel: "text-[#8a857f]",
    label: "text-[#8a857f]",
    input:
      "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    helpHint: "text-[#8a857f]",
    toggleOn: "bg-[#1a1a1a]",
    toggleOff: "bg-[#e5e1d8]",
    toggleKnob: "bg-white",
    optionInput: "bg-white border-[#e5e1d8] text-[#1a1a1a] focus:border-[#1a1a1a]/40",
    optionRemove: "text-[#8a857f] hover:text-[#8b2b21]",
    addOptionInput:
      "bg-transparent border-dashed border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    addOptionBtn: "text-[#8a857f] hover:text-[#1a1a1a]",
    select: "bg-white border-[#e5e1d8] text-[#1a1a1a] focus:border-[#1a1a1a]/40",
    selectPanelText: "text-[#8a857f]",
    typeFooter: "border-[#e5e1d8] text-[#8a857f]",
    formulaMono: "text-[#3b8273]",
  },
} as const;

const entityTypeMeta: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  textField: { label: "Short Text", icon: Type },
  numberField: { label: "Number", icon: Hash },
  dateField: { label: "Date", icon: Calendar },
  selectField: { label: "Select", icon: ChevronDown },
  textareaField: { label: "Long Text", icon: AlignLeft },
  checkboxField: { label: "Checkbox", icon: Check },
  sectionGroup: { label: "Section", icon: Layers },
  // Phase 14 specialty entities
  signatureField: { label: "Signature", icon: PenLine },
  ratingField: { label: "Rating", icon: Star },
  multiPhotoField: { label: "Photos", icon: Camera },
  geolocationField: { label: "Location", icon: MapPin },
  computedField: { label: "Computed", icon: Calculator },
  repeatingSection: { label: "Repeating Section", icon: ListOrdered },
};

interface SelectOption {
  value: string;
  label: string;
}

type SurfaceTokens = (typeof surfaceTokens)["dark"] | (typeof surfaceTokens)["cream"];

function AttributeRow({
  id,
  labelText,
  children,
  hint,
  t,
}: {
  id: string;
  labelText: string;
  children: React.ReactNode;
  hint?: string;
  t: SurfaceTokens;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>
        {labelText}
      </label>
      {children}
      {hint && <span className={cn("text-[10px]", t.helpHint)}>{hint}</span>}
    </div>
  );
}

function OptionsEditor({
  entityId,
  options,
  builderStore,
  t,
}: {
  entityId: string;
  options: SelectOption[];
  builderStore: BuilderStore<typeof formBuilder>;
  t: SurfaceTokens;
}) {
  const [newOption, setNewOption] = useState("");

  function addOption() {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    const value = trimmed.toLowerCase().replace(/\s+/g, "_");
    const updated = [...options, { label: trimmed, value }];
    builderStore.setEntityAttribute(entityId, "options", updated);
    setNewOption("");
  }

  function removeOption(optValue: string) {
    const updated = options.filter((o) => o.value !== optValue);
    builderStore.setEntityAttribute(entityId, "options", updated);
  }

  function updateOptionLabel(optValue: string, newLabel: string) {
    const updated = options.map((o) =>
      o.value === optValue ? { ...o, label: newLabel } : o
    );
    builderStore.setEntityAttribute(entityId, "options", updated);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>
        Options
      </label>
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <div key={opt.value} className="flex items-center gap-2">
            <input
              type="text"
              value={opt.label}
              onChange={(e) => updateOptionLabel(opt.value, e.target.value)}
              className={cn(
                "flex-1 border rounded-[3px] px-2.5 py-1.5 text-xs outline-none transition-colors",
                t.optionInput
              )}
            />
            <button
              onClick={() => removeOption(opt.value)}
              className={cn("w-5 h-5 flex items-center justify-center transition-colors", t.optionRemove)}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newOption}
          onChange={(e) => setNewOption(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addOption()}
          placeholder="Add option…"
          className={cn(
            "flex-1 border rounded-[3px] px-2.5 py-1.5 text-xs outline-none transition-colors",
            t.addOptionInput
          )}
        />
        <button
          onClick={addOption}
          className={cn("w-5 h-5 flex items-center justify-center transition-colors", t.addOptionBtn)}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function PropertiesPanel({ builderStore, selectedId, entities, surface = "dark" }: Props) {
  const t = surfaceTokens[surface];

  if (!selectedId || !entities[selectedId]) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-center">
        <p className={cn("text-xs font-mono", t.selectPanelText)}>Select a field to configure</p>
      </div>
    );
  }

  const entity = entities[selectedId];
  const attrs = entity.attributes;
  const meta = entityTypeMeta[entity.type] ?? { label: entity.type, icon: Type };
  const HeaderIcon = meta.icon;

  function setAttr(name: string, value: unknown) {
    builderStore.setEntityAttribute(selectedId!, name as Parameters<typeof builderStore.setEntityAttribute>[1], value as Parameters<typeof builderStore.setEntityAttribute>[2]);
  }

  const isSectionGroup = entity.type === "sectionGroup";
  const isRepeatingSection = entity.type === "repeatingSection";
  const isTextField = entity.type === "textField";
  const isTextarea = entity.type === "textareaField";
  const isNumber = entity.type === "numberField";
  const isDate = entity.type === "dateField";
  const isSelect = entity.type === "selectField";
  const isCheckbox = entity.type === "checkboxField";
  const isRating = entity.type === "ratingField";
  const isMultiPhoto = entity.type === "multiPhotoField";
  const isComputed = entity.type === "computedField";

  // D-05: attachPhotos applies to every non-section entity type
  const hasAttachPhotos = !isSectionGroup && !isRepeatingSection;

  // computedField does NOT have a requiredAttribute (per Plan 14-02 decision)
  const hasRequired = !isComputed && !isSectionGroup && !isRepeatingSection;

  const options = (attrs.options as SelectOption[]) ?? [];

  // For computedField entity-ID dropdowns: filter out current entity, sections, computed
  const candidateEntities = Object.entries(entities).filter(
    ([id, e]) =>
      id !== selectedId &&
      e.type !== "sectionGroup" &&
      e.type !== "repeatingSection" &&
      e.type !== "computedField"
  );

  const computedInputs = (attrs.computedInputs as { likelihood?: string; consequence?: string }) ?? {};

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className={cn("px-4 py-3 border-b flex items-center gap-2", t.headerBorder)}>
        <HeaderIcon className={cn("w-4 h-4", t.headerLabel)} />
        <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.headerLabel)}>
          {meta.label}
        </span>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* sectionGroup-specific attributes */}
        {isSectionGroup ? (
          <>
            <AttributeRow id={`${selectedId}-section-title`} labelText="Section Title" t={t}>
              <input
                id={`${selectedId}-section-title`}
                type="text"
                value={(attrs.title as string) ?? ""}
                onChange={(e) => setAttr("title", e.target.value)}
                placeholder="Enter section title…"
                className={cn(
                  "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                  t.input
                )}
              />
            </AttributeRow>
            <AttributeRow id={`${selectedId}-section-desc`} labelText="Description" t={t}>
              <textarea
                id={`${selectedId}-section-desc`}
                value={(attrs.description as string) ?? ""}
                onChange={(e) => setAttr("description", e.target.value)}
                placeholder="Optional description…"
                rows={3}
                className={cn(
                  "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors resize-none",
                  t.input
                )}
              />
            </AttributeRow>
          </>
        ) : isRepeatingSection ? (
          /* repeatingSection-specific attributes */
          <>
            <AttributeRow id={`${selectedId}-rs-title`} labelText="Section Title" t={t}>
              <input
                id={`${selectedId}-rs-title`}
                type="text"
                value={(attrs.title as string) ?? ""}
                onChange={(e) => setAttr("title", e.target.value)}
                placeholder="Enter section title…"
                className={cn(
                  "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                  t.input
                )}
              />
            </AttributeRow>
            <AttributeRow id={`${selectedId}-rs-desc`} labelText="Description" t={t}>
              <input
                id={`${selectedId}-rs-desc`}
                type="text"
                value={(attrs.description as string) ?? ""}
                onChange={(e) => setAttr("description", e.target.value)}
                placeholder="Optional description…"
                className={cn(
                  "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                  t.input
                )}
              />
            </AttributeRow>
            <AttributeRow
              id={`${selectedId}-min-instances`}
              labelText="Min Instances"
              hint="Minimum filled instances required to submit (0 = optional)"
              t={t}
            >
              <input
                id={`${selectedId}-min-instances`}
                type="number"
                min={0}
                max={50}
                value={(attrs.minInstances as number) ?? 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setAttr("minInstances", val);
                }}
                className={cn(
                  "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                  t.input
                )}
              />
            </AttributeRow>
            <AttributeRow
              id={`${selectedId}-max-instances`}
              labelText="Max Instances"
              hint="Leave blank for no upper limit"
              t={t}
            >
              <input
                id={`${selectedId}-max-instances`}
                type="number"
                min={1}
                max={50}
                value={(attrs.maxInstances as number | undefined) ?? ""}
                placeholder="no upper limit"
                onChange={(e) => {
                  const val = e.target.value === "" ? undefined : parseInt(e.target.value, 10);
                  setAttr("maxInstances", val);
                }}
                className={cn(
                  "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                  t.input
                )}
              />
            </AttributeRow>
            {/* Type footer */}
            <div className={cn("pt-2 border-t", t.typeFooter)}>
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Type: {entity.type}
              </span>
            </div>
          </>
        ) : (
          /* All non-container entity types */
          <>
            {/* Label */}
            <AttributeRow id={`${selectedId}-label`} labelText="Label" t={t}>
              <input
                id={`${selectedId}-label`}
                type="text"
                value={(attrs.label as string) ?? ""}
                onChange={(e) => setAttr("label", e.target.value)}
                className={cn(
                  "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                  t.input
                )}
              />
            </AttributeRow>

            {/* Placeholder (for text, textarea, number) */}
            {(isTextField || isTextarea || isNumber) && (
              <AttributeRow id={`${selectedId}-placeholder`} labelText="Placeholder" t={t}>
                <input
                  id={`${selectedId}-placeholder`}
                  type="text"
                  value={(attrs.placeholder as string) ?? ""}
                  onChange={(e) => setAttr("placeholder", e.target.value)}
                  className={cn(
                    "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                    t.input
                  )}
                />
              </AttributeRow>
            )}

            {/* Help text */}
            <AttributeRow id={`${selectedId}-help-text`} labelText="Help Text" t={t}>
              <input
                id={`${selectedId}-help-text`}
                type="text"
                value={(attrs.helpText as string) ?? ""}
                onChange={(e) => setAttr("helpText", e.target.value)}
                placeholder="Shown below the field"
                className={cn(
                  "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                  t.input
                )}
              />
            </AttributeRow>

            {/* Required toggle — not shown for computedField (no requiredAttribute) */}
            {hasRequired && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>
                    Required
                  </span>
                  <span className={cn("text-[10px]", t.helpHint)}>Must be filled to submit</span>
                </div>
                <button
                  onClick={() => setAttr("required", !((attrs.required as boolean) ?? false))}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    (attrs.required as boolean) ? t.toggleOn : t.toggleOff
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full transition-transform",
                      t.toggleKnob,
                      (attrs.required as boolean) ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            )}

            {/* Attach Photos toggle — D-05: all non-section entity types */}
            {hasAttachPhotos && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>
                    Attach Photos
                  </span>
                  <span className={cn("text-[10px]", t.helpHint)}>
                    Allow photos to be attached to this field when filling
                  </span>
                </div>
                <button
                  onClick={() => setAttr("attachPhotos", !((attrs.attachPhotos as boolean) ?? false))}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    (attrs.attachPhotos as boolean) ? t.toggleOn : t.toggleOff
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full transition-transform",
                      t.toggleKnob,
                      (attrs.attachPhotos as boolean) ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            )}

            {/* Options editor for selectField */}
            {isSelect && (
              <OptionsEditor
                entityId={selectedId}
                options={options}
                builderStore={builderStore}
                t={t}
              />
            )}

            {/* Checkbox default-checked */}
            {isCheckbox && (
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>
                    Default Checked
                  </span>
                </div>
                <button
                  onClick={() =>
                    setAttr("defaultChecked", !((attrs.defaultChecked as boolean) ?? false))
                  }
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    (attrs.defaultChecked as boolean) ? t.toggleOn : t.toggleOff
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full transition-transform",
                      t.toggleKnob,
                      (attrs.defaultChecked as boolean) ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            )}

            {/* Prefill source for textField and dateField */}
            {(isTextField || isDate) && (
              <AttributeRow id={`${selectedId}-prefill`} labelText="Prefill Source" t={t}>
                <select
                  id={`${selectedId}-prefill`}
                  value={(attrs.prefillSource as string) ?? ""}
                  onChange={(e) => setAttr("prefillSource", e.target.value)}
                  className={cn(
                    "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                    t.select
                  )}
                >
                  <option value="">None</option>
                  <option value="currentUserName">Current User Name</option>
                  <option value="currentDate">Current Date</option>
                  <option value="currentOrg">Current Organisation</option>
                </select>
              </AttributeRow>
            )}

            {/* ratingField: maxRating number input */}
            {isRating && (
              <AttributeRow
                id={`${selectedId}-max-rating`}
                labelText="Max Rating"
                hint="Number of stars shown (2–10)"
                t={t}
              >
                <input
                  id={`${selectedId}-max-rating`}
                  type="number"
                  min={2}
                  max={10}
                  value={(attrs.maxRating as number) ?? 5}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setAttr("maxRating", val);
                  }}
                  className={cn(
                    "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                    t.input
                  )}
                />
              </AttributeRow>
            )}

            {/* multiPhotoField: maxPhotos number input */}
            {isMultiPhoto && (
              <AttributeRow
                id={`${selectedId}-max-photos`}
                labelText="Max Photos"
                hint="Maximum number of photos allowed"
                t={t}
              >
                <input
                  id={`${selectedId}-max-photos`}
                  type="number"
                  min={1}
                  max={20}
                  value={(attrs.maxPhotos as number) ?? 5}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setAttr("maxPhotos", val);
                  }}
                  className={cn(
                    "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors",
                    t.input
                  )}
                />
              </AttributeRow>
            )}

            {/* computedField: formula display + entity-ID dropdowns */}
            {isComputed && (
              <>
                <AttributeRow id={`${selectedId}-formula`} labelText="Formula" hint="The risk computation formula." t={t}>
                  <div className={cn("px-3 py-2 rounded-[3px] font-mono text-sm", t.formulaMono)}>
                    PAS 79
                  </div>
                </AttributeRow>
                <AttributeRow
                  id={`${selectedId}-likelihood`}
                  labelText="Likelihood Source"
                  hint="Select the field that provides this value (must be a number 1–5)."
                  t={t}
                >
                  <select
                    id={`${selectedId}-likelihood`}
                    value={computedInputs.likelihood ?? ""}
                    onChange={(e) =>
                      setAttr("computedInputs", {
                        ...computedInputs,
                        likelihood: e.target.value,
                      })
                    }
                    className={cn(
                      "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors w-full",
                      t.select
                    )}
                  >
                    <option value="">— select field —</option>
                    {candidateEntities.map(([id, e]) => (
                      <option key={id} value={id}>
                        {(e.attributes.label as string) ?? id}
                      </option>
                    ))}
                  </select>
                </AttributeRow>
                <AttributeRow
                  id={`${selectedId}-consequence`}
                  labelText="Consequence Source"
                  hint="Select the field that provides this value (must be a number 1–5)."
                  t={t}
                >
                  <select
                    id={`${selectedId}-consequence`}
                    value={computedInputs.consequence ?? ""}
                    onChange={(e) =>
                      setAttr("computedInputs", {
                        ...computedInputs,
                        consequence: e.target.value,
                      })
                    }
                    className={cn(
                      "border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors w-full",
                      t.select
                    )}
                  >
                    <option value="">— select field —</option>
                    {candidateEntities.map(([id, e]) => (
                      <option key={id} value={id}>
                        {(e.attributes.label as string) ?? id}
                      </option>
                    ))}
                  </select>
                </AttributeRow>
              </>
            )}

            {/* Type footer */}
            <div className={cn("pt-2 border-t", t.typeFooter)}>
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Type: {entity.type}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
