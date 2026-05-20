# Phase 13: Form Builder Foundation - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 20 new/modified files
**Analogs found:** 18 / 20

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/form-builder/index.ts` | config | transform | `lib/types/form-builder.ts` | role-match (schema definition) |
| `lib/form-builder/entities/text-field.ts` | config | transform | `lib/types/form-builder.ts` `FormField` | role-match |
| `lib/form-builder/entities/number-field.ts` | config | transform | `lib/types/form-builder.ts` `FormField` | role-match |
| `lib/form-builder/entities/date-field.ts` | config | transform | `lib/types/form-builder.ts` `FormField` | role-match |
| `lib/form-builder/entities/select-field.ts` | config | transform | `lib/types/form-builder.ts` `FormField` | role-match |
| `lib/form-builder/entities/textarea-field.ts` | config | transform | `lib/types/form-builder.ts` `FormField` | role-match |
| `lib/form-builder/entities/checkbox-field.ts` | config | transform | `lib/types/form-builder.ts` `FormField` | role-match |
| `lib/form-builder/entities/section-group.ts` | config | transform | `lib/types/form-builder.ts` `FormField` | role-match |
| `lib/form-builder/attributes/*.ts` | config | transform | `lib/types/form-builder.ts` field properties | role-match |
| `components/form-builder/builder-canvas.tsx` | component | event-driven | `components/templates/template-builder.tsx` | exact |
| `components/form-builder/field-palette.tsx` | component | event-driven | `components/templates/field-palette.tsx` | exact |
| `components/form-builder/properties-panel.tsx` | component | event-driven | `components/templates/field-config.tsx` | exact |
| `components/form-builder/field-card.tsx` | component | event-driven | `components/templates/sortable-field.tsx` | exact |
| `components/form-builder/section-card.tsx` | component | event-driven | `components/templates/sortable-field.tsx` | role-match |
| `components/form-interpreter/interpreter-renderer.tsx` | component | request-response | `components/forms/form-renderer.tsx` | exact |
| `components/form-interpreter/*-field-renderer.tsx` (×7) | component | request-response | `components/forms/{number,date,checkbox}-field.tsx` | exact |
| `app/admin/templates/[id]/page.tsx` | page (RSC) | request-response | `app/admin/templates/[id]/page.tsx` (existing) | exact |
| `app/admin/templates/[id]/builder-client.tsx` | component | event-driven | `components/templates/template-builder.tsx` | exact |
| `app/admin/templates/actions.ts` | service | CRUD | `app/admin/templates/actions.ts` (existing) | exact |
| `app/client/templates/[id]/page.tsx` | page (RSC) | request-response | `app/client/templates/[id]/page.tsx` (existing) | exact |
| `app/client/templates/actions.ts` | service | CRUD | `app/client/templates/actions.ts` (existing) | exact |
| `app/admin/assessments/[id]/assessment-client.tsx` | component | request-response | self (rewired) | exact |
| `app/admin/assessments/[id]/page.tsx` | page (RSC) | request-response | self (rewired) | exact |
| `supabase/migrations/010_form_builder_foundation_reseed.sql` | migration | batch | `supabase/migrations/009_clients_contact_columns.sql` | role-match |
| `lib/supabase/templates.ts` | service | CRUD | self (partial delete + update) | exact |

---

## Pattern Assignments

### `lib/form-builder/index.ts` (config, transform)

**Analog:** `lib/types/form-builder.ts` — the existing type module that centralises form schema definitions

**Existing type exports pattern** (`lib/types/form-builder.ts` lines 1–55):
```typescript
// All builder types exported from one module.
// The new lib/form-builder/index.ts replaces this with a createBuilder() call
// and re-exports the coltorapps Schema type.
export type BuilderSurface = "dark" | "cream";
export type FieldType = "text" | "textarea" | "number" | "date" | ...;
export interface FormField { id: string; key: string; type: FieldType; ... }
export interface FormSchema { fields: FormField[]; }
```

**New pattern to use** (from RESEARCH.md Pattern 2):
```typescript
// lib/form-builder/index.ts
import { createBuilder } from "@coltorapps/builder";
import { textFieldEntity } from "./entities/text-field";
import { numberFieldEntity } from "./entities/number-field";
import { dateFieldEntity } from "./entities/date-field";
import { selectFieldEntity } from "./entities/select-field";
import { textareaFieldEntity } from "./entities/textarea-field";
import { checkboxFieldEntity } from "./entities/checkbox-field";
import { sectionGroupEntity } from "./entities/section-group";

export const formBuilder = createBuilder({
  entities: [
    textFieldEntity, numberFieldEntity, dateFieldEntity,
    selectFieldEntity, textareaFieldEntity, checkboxFieldEntity,
    sectionGroupEntity,
  ],
});

export type FormBuilderSchema = Schema<typeof formBuilder>;
```

**Key rule:** This module is consumed by both client components (builder/interpreter stores) and server actions (validateSchema). It must NOT import anything that is server-only (no `createServerClient`, no `createClient` from `@/lib/supabase/server`).

---

### `lib/form-builder/entities/*.ts` (config, transform)

**Analog:** `lib/types/form-builder.ts` fields 22–35 (`FormField` interface) — existing field shape maps 1:1 to coltorapps entity + attribute pattern

**Attribute names to preserve from old FormField:**
- `label` (was `FormField.label`)
- `required` (was `FormField.required`)
- `placeholder` (was `FormField.placeholder`)
- `helpText` (was `FormField.helpText`)
- `options` (was `FormField.options[]` for dropdown/select/checkbox)
- `prefillSource` — NEW; attribute only on `textField` and `dateField`

**Entity definition pattern** (from RESEARCH.md Pattern 1, and old type structure):
```typescript
// lib/form-builder/entities/text-field.ts
import { createEntity } from "@coltorapps/builder";
import { labelAttribute } from "../attributes/label";
import { requiredAttribute } from "../attributes/required";
import { placeholderAttribute } from "../attributes/placeholder";
import { helpTextAttribute } from "../attributes/help-text";
import { prefillSourceAttribute } from "../attributes/prefill-source";

export const textFieldEntity = createEntity({
  name: "textField",
  attributes: [
    labelAttribute, requiredAttribute, placeholderAttribute,
    helpTextAttribute, prefillSourceAttribute,
  ],
  validate(value, context) {
    const isRequired = context.entity.attributes.required ?? false;
    if (isRequired && !value) {
      throw new Error(`${context.entity.attributes.label} is required.`);
    }
    return value;
  },
});
```

**Attribute definition pattern** (from RESEARCH.md Code Examples):
```typescript
// lib/form-builder/attributes/label.ts
import { createAttribute } from "@coltorapps/builder";

export const labelAttribute = createAttribute({
  name: "label",
  validate(value) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Label is required.");
    }
    return value.trim();
  },
});
```

**Critical pitfall (RESEARCH.md Pitfall 4):** Always provide `?? false` / `?? ""` coercions in `validate()` — unset attributes are `undefined` in the store, not their default value.

---

### `components/form-builder/field-palette.tsx` (component, event-driven)

**Analog:** `components/templates/field-palette.tsx` — exact structural match, copy the pattern

**Imports pattern** (`components/templates/field-palette.tsx` lines 1–19):
```typescript
"use client";
import type { FieldType, BuilderSurface } from "@/lib/types/form-builder";
import { cn } from "@/lib/utils";
import { Type, AlignLeft, Hash, Calendar, Check, ChevronDown, /* ... */ } from "lucide-react";
```

**New imports for coltorapps version:**
```typescript
"use client";
// Replace FieldType with coltorapps entity name literals
import { cn } from "@/lib/utils";
import { Type, AlignLeft, Hash, Calendar, Check, ChevronDown, Layers } from "lucide-react";
```

**Surface token pattern** (`components/templates/field-palette.tsx` lines 47–66):
```typescript
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
  cream: { /* ... cream tokens */ },
} as const;
```

Copy this token map exactly. Replace the 12 field types with the 7 Phase 13 entities only:
`textField`, `numberField`, `dateField`, `selectField`, `textareaField`, `checkboxField`, `sectionGroup`.

**Core onClick pattern** (`components/templates/field-palette.tsx` lines 79–100):
```tsx
// Old: onAdd(type) → parent calls setFields(prev => [...prev, defaultField(type)])
// New: onClick directly calls builderStore.addEntity({ type: entityName, attributes: defaultAttributes })
// The builderStore prop is drilled from TemplateBuilderClient
<button
  key={type}
  onClick={() => onAddEntity(type)}
  className={cn("flex items-start gap-3 px-3 py-3 rounded-[3px] ...", t.btnHover)}
>
```

**Accessibility:** UI-SPEC requires `aria-label` on each palette button. Add `aria-label={`Add ${label} field`}` to each button.

**Touch target:** Buttons must be `h-12` minimum (UI-SPEC WCAG 2.5.5 requirement). Old palette used `py-3` which is borderline — use explicit `min-h-[48px]`.

---

### `components/form-builder/field-card.tsx` (component, event-driven)

**Analog:** `components/templates/sortable-field.tsx` — exact structural match

**Full useSortable + CSS.Transform pattern** (`components/templates/sortable-field.tsx` lines 64–95):
```typescript
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function FieldCard({ entityId, isSelected, onSelect, onDuplicate, onDelete, surface }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entityId,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  // ...
}
```

**Selected state tokens** (`components/templates/sortable-field.tsx` lines 33–62):
```typescript
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
  // cream tokens...
} as const;
```

**Drag handle + action buttons pattern** (`components/templates/sortable-field.tsx` lines 86–155):
```tsx
<div ref={setNodeRef} style={style} onClick={onSelect}
  className={cn("group relative flex items-start gap-3 px-4 py-4 rounded-sm border cursor-pointer transition-all",
    isSelected ? t.selected : t.base)}>
  <div {...attributes} {...listeners} onClick={e => e.stopPropagation()}
    className={cn("mt-0.5 cursor-grab active:cursor-grabbing", t.grip)}>
    <GripVertical className="w-4 h-4" />
  </div>
  {/* content */}
  <div className={`flex items-center gap-1 shrink-0 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
    <button onClick={e => { e.stopPropagation(); onDuplicate(); }}
      aria-label="Duplicate field"
      className={cn("w-7 h-7 flex items-center justify-center rounded-[3px]", t.actionBtn)}>
      <Copy className="w-3.5 h-3.5" />
    </button>
    <button onClick={e => { e.stopPropagation(); onDelete(); }}
      aria-label="Delete field"
      className={cn("w-7 h-7 flex items-center justify-center rounded-[3px]", t.deleteBtn)}>
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
</div>
```

**UI-SPEC adds:** `aria-label="Duplicate field"` and `aria-label="Delete field"` on the icon buttons (already shown above). `aria-describedby` on the drag handle pointing to keyboard instructions.

**Data source change:** The old component received a `FormField` object for label/type display. The new component receives an entity from `useBuilderStoreData` — access `entity.attributes.label` and `entity.type` instead.

---

### `components/form-builder/section-card.tsx` (component, event-driven)

**Analog:** `components/templates/sortable-field.tsx` — structural match; extend with nested drop zone

**No exact analog** for the nested drop zone. Use `sortable-field.tsx` as the outer card structure, then add an inner `SortableContext` for children:

```tsx
// Extends SortableField pattern with:
// 1. Outer useSortable for the section itself (same as field-card)
// 2. Inner SortableContext for child entity IDs
// 3. Inset dashed drop zone (UI-SPEC: "inset dashed border, 2px, white/10")
<div className="mt-3 min-h-[48px] border-2 border-dashed border-white/10 rounded-sm">
  <SortableContext items={childEntityIds} strategy={verticalListSortingStrategy}>
    {/* child FieldCards rendered here */}
  </SortableContext>
</div>
```

**RESEARCH.md Pitfall 1 warning:** The `handleDragEnd` in the parent canvas must detect whether the drop target is inside a section and call `builderStore.setEntityIndex(entityId, index, { parentId: sectionId })`.

---

### `components/form-builder/builder-canvas.tsx` (component, event-driven)

**Analog:** `components/templates/template-builder.tsx` (the canvas + DndContext portion, lines 329–360)

**DndContext + SortableContext pattern** (`components/templates/template-builder.tsx` lines 148–168):
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);

function handleDragEnd(event: DragEndEvent) {
  setActiveId(null);
  const { active, over } = event;
  if (over && active.id !== over.id) {
    // OLD: arrayMove on local state
    // NEW: builderStore.setEntityIndex(active.id, newIndex)
    // or:  builderStore.setEntityIndex(active.id, newIndex, { parentId })
  }
}
```

**DragOverlay ghost card pattern** (`components/templates/template-builder.tsx` lines 354–360):
```tsx
<DragOverlay>
  {activeEntityId ? (
    <div className="bg-[#2a2a2a] border border-[#3b8273]/50 rounded-sm px-4 py-3 shadow-2xl opacity-90">
      <span className="text-white text-sm font-medium">{activeEntity.attributes.label}</span>
    </div>
  ) : null}
</DragOverlay>
```

**UI-SPEC adds:** `opacity-90`, `shadow-2xl`, teal accent border on drag overlay. `KeyboardSensor` with `sortableKeyboardCoordinates` for keyboard drag support.

**coltorapps wiring** (from RESEARCH.md Pattern 3):
```tsx
const { schema: { root } } = useBuilderStoreData(builderStore, (events) =>
  events.some((e) => e.name === "RootUpdated")
);
// Pass root as SortableContext items (Array.from(root))
```

---

### `components/form-builder/properties-panel.tsx` (component, event-driven)

**Analog:** `components/templates/field-config.tsx` — exact structural match; replace `onChange(updates)` with `builderStore.setEntityAttribute(id, name, value)`

**Header + field rows pattern** (`components/templates/field-config.tsx` lines 109–280):
```tsx
// Header with entity type icon + label
<div className={cn("px-4 py-3 border-b flex items-center gap-2", t.headerBorder)}>
  <span className={cn("font-mono text-[10px] uppercase tracking-widest", t.headerLabel)}>
    {entityTypeMeta[entity.type].label}
  </span>
</div>

// Attribute row pattern (copy for each attribute):
<div className="flex flex-col gap-1.5">
  <label className={cn("font-mono text-[10px] uppercase tracking-widest", t.label)}>
    Label
  </label>
  <input
    type="text"
    value={entity.attributes.label ?? ""}
    onChange={e => builderStore.setEntityAttribute(entity.id, "label", e.target.value)}
    className={cn("border rounded-[3px] px-3 py-2 text-sm outline-none transition-colors", t.input)}
  />
</div>
```

**Surface tokens** (`components/templates/field-config.tsx` lines 44–79):
```typescript
const surfaceTokens = {
  dark: {
    headerBorder: "border-white/5",
    headerLabel: "text-white/30",
    label: "text-white/40",
    input: "bg-transparent border-white/10 text-white placeholder:text-white/20 focus:border-white/30",
    helpHint: "text-white/20",
    toggleOn: "bg-[#3b8273]",   // teal = "on"
    toggleOff: "bg-white/10",
    toggleKnob: "bg-white",
  },
  cream: { /* ... */ },
} as const;
```

**No-selection state** (`components/templates/template-builder.tsx` lines 385–391):
```tsx
<div className="flex items-center justify-center h-full p-6 text-center">
  <p className={cn("text-xs font-mono", t.selectPanelText)}>Select a field to configure</p>
</div>
```

**Options editor pattern** (for `selectField` — from `field-config.tsx` lines 196–235):
```tsx
// "Add option..." input + add button + per-option remove button
// Reuse this pattern for the selectField entity's "options" attribute
```

**prefillSource picker:** Render a `<select>` (shadcn `Select`) with options `["", "currentUserName", "currentDate", "currentOrg"]` when entity type is `textField` or `dateField`.

---

### `app/admin/templates/[id]/page.tsx` (RSC, request-response)

**Analog:** `app/admin/templates/[id]/page.tsx` — this IS the existing file; it is being updated in place

**RSC data-fetch pattern** (`app/admin/templates/[id]/page.tsx` lines 28–71):
```typescript
export default async function TemplateBuilderPage({ params }: Props) {
  const { id } = await params;          // Next.js 16: params is a Promise
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: template } = await supabase
    .from("form_templates")
    .select("id, name, template_type, is_published")
    .eq("id", id)
    .single();
  if (!template) notFound();

  const { data: versions } = await supabase
    .from("template_versions")
    .select("id, version_number, schema_json, published_at")
    .eq("template_id", id)
    .order("version_number", { ascending: false });

  const latestVersion = versions?.[0];
  // ...
  return <TemplateBuilderClient /* props */ />;
}
```

**Change required:** Replace `normaliseSchema()` (custom-shape flattener) with direct pass of `latestVersion?.schema_json` to the client (it will be coltorapps shape after the reseed migration). Remove the `import type { FormSchema, FormField } from "@/lib/types/form-builder"` line.

**Client surface analog** (`app/client/templates/[id]/page.tsx` lines 29–77): Uses `getClientContext()` guard instead of `supabase.auth.getUser()`. Passes `surface="cream"` to the builder component. Checks `owner_type === "customer"` before rendering. This pattern is preserved exactly on the client surface version.

---

### `app/admin/templates/[id]/builder-client.tsx` (component, event-driven)

**Analog:** `components/templates/template-builder.tsx` — the entire file is the source of truth for three-panel layout, toolbar, surface tokens, save/publish flow

**Three-panel layout root** (`components/templates/template-builder.tsx` lines 237–393):
```tsx
<div className={cn("fixed inset-0 z-50 flex flex-col", t.root)}>
  {/* Toolbar h-14 */}
  <div className={cn("h-14 flex items-center gap-4 px-6 border-b shrink-0", t.toolbar)}>
    {/* back link | title input | type label | version badges | save/publish buttons */}
  </div>
  {/* Body: three columns */}
  <div className="flex flex-1 overflow-hidden">
    <div className={cn("w-56 border-r overflow-y-auto shrink-0", t.panel, t.columnDivider)}>
      {/* FieldPalette */}
    </div>
    <div className={cn("flex-1 flex flex-col overflow-hidden", t.canvasBg)}>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Canvas — BuilderEntities */}
      </div>
      <div className={cn("h-8 px-4 border-t flex items-center gap-4 shrink-0 text-xs", t.bottomBar)}>
        {/* field count + unsaved indicator */}
      </div>
    </div>
    <div className={cn("w-72 border-l overflow-y-auto shrink-0", t.panel, t.columnDivider)}>
      {/* PropertiesPanel */}
    </div>
  </div>
</div>
```

**Surface token map** (`components/templates/template-builder.tsx` lines 77–122) — copy verbatim, key tokens:
```typescript
const surfaceTokens = {
  dark: {
    root: "bg-[#111]", toolbar: "bg-[#111] border-white/10",
    panel: "bg-[#0d0d0d]", columnDivider: "border-white/10",
    titleInput: "text-white border-transparent focus:border-white/20",
    savedTag: "text-[#3b8273]", errorTag: "text-[#8b2b21]",
    publishBtn: "bg-[#3b8273] hover:bg-[#3b8273]/90 text-white",
    bottomBar: "bg-white/5 border-white/10 text-white/40",
    unsavedTag: "text-amber-400",
  },
  cream: { /* ... */ }
} as const;
```

**Save/publish handler pattern** (`components/templates/template-builder.tsx` lines 204–233):
```typescript
const [isPending, startTransition] = useTransition();
const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

function handleSave() {
  setSaveStatus("saving");
  startTransition(async () => {
    try {
      // OLD: await saveAction(templateId, schema, name)
      // NEW: const rawSchema = builderStore.getSchema();
      //      await saveDraftAction(templateId, rawSchema, name);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  });
}

function handlePublish() {
  if (!confirm(`Publish v${versionNumber}? This version will become immutable and be available to assign to clients.`)) return;
  // same startTransition pattern
}
```

**Version badge pattern** (`components/templates/template-builder.tsx` lines 262–277):
```tsx
{hasDraft && !isPublished ? (
  <Badge className="bg-[#c0a66d]/20 text-[#c0a66d] border-[#c0a66d]/30 text-[10px] font-mono shrink-0">
    DRAFT v{versionNumber}
  </Badge>
) : isPublished ? (
  <Badge className="bg-[#3b8273]/20 text-[#3b8273] border-[#3b8273]/30 text-[10px] font-mono shrink-0">
    LIVE v{publishedVersionNumber}
  </Badge>
) : null}
```

**Empty canvas state** (`components/templates/template-builder.tsx` lines 321–328):
```tsx
<div className="flex flex-col items-center justify-center h-full gap-4 text-center">
  <p className={cn("text-sm font-mono", t.emptyText)}>Drag fields from the left panel</p>
  <p className={cn("text-xs", t.emptySubtext)}>or click a field type to add it</p>
</div>
```

**coltorapps wiring changes vs old component:**
- `fields` state array → `useBuilderStore(formBuilder, { initialData: { schema } })` + `useBuilderStoreData`
- `addField(type)` → `builderStore.addEntity({ type, attributes: { label: defaultLabel } })`
- `updateField(id, updates)` → `builderStore.setEntityAttribute(id, attrName, value)` (per-attribute, done in PropertiesPanel)
- `deleteField(id)` → `builderStore.deleteEntity(id)`
- `fields.map(...)` → `<BuilderEntities builderStore={builderStore} components={...}>`
- `schema: FormSchema` → `builderStore.getSchema()` returns coltorapps `{ entities, root }` shape

---

### `app/admin/templates/actions.ts` (service, CRUD) — updated

**Analog:** `app/admin/templates/actions.ts` (existing) — exact same file, updated in place

**Auth guard pattern** (`app/admin/templates/actions.ts` lines 1–9):
```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireActorUserId } from "@/lib/auth-helpers";
```

**createTemplate pattern** (`app/admin/templates/actions.ts` lines 10–33):
```typescript
export async function createTemplate(name: string, templateType: string) {
  const supabase = await createClient();
  const userId = await requireActorUserId("admin");

  const { data, error } = await supabase
    .from("form_templates")
    .insert({ name, template_type: templateType, owner_id: userId, owner_type: "admin" })
    .select("id").single();
  if (error) throw new Error(error.message);

  await supabase.from("template_versions").insert({
    template_id: data.id,
    version_number: 1,
    schema_json: { entities: {}, root: [] },  // coltorapps empty schema
    created_by: userId,
  });
  revalidatePath("/admin/templates");
  return data.id;
}
```

**saveDraftAction pattern** (new — replaces old `saveDraft` which mutated draft rows in place; Phase 13 always inserts new rows per RESEARCH.md Pattern 4):
```typescript
export async function saveDraftAction(templateId: string, rawSchema: unknown, templateName: string) {
  const supabase = await createClient();
  const userId = await requireActorUserId("admin");

  // 1. Update template name
  await supabase.from("form_templates").update({ name: templateName }).eq("id", templateId);

  // 2. Server-side schema validation — NEVER trust client-supplied schema
  const { validateSchema } = await import("@coltorapps/builder");
  const { formBuilder } = await import("@/lib/form-builder");
  const result = await validateSchema(rawSchema, formBuilder);
  if (!result.success) throw new Error(`Invalid schema: ${result.reason.code}`);

  // 3. Insert new immutable version row (NEVER mutate existing rows)
  const { data: max } = await supabase
    .from("template_versions").select("version_number")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false }).limit(1).maybeSingle();

  await supabase.from("template_versions").insert({
    template_id: templateId,
    version_number: (max?.version_number ?? 0) + 1,
    schema_json: result.data,   // coltorapps { entities, root }
    created_by: userId,
  });
  revalidatePath(`/admin/templates/${templateId}`);
}
```

**publishTemplateAction pattern** (extends saveDraftAction with `published_at`):
```typescript
export async function publishTemplateAction(templateId: string, rawSchema: unknown, templateName: string) {
  // Same validateSchema → insert pattern, plus:
  // published_at: new Date().toISOString() in the insert
  // UPDATE form_templates SET is_published = true
  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${templateId}`);
}
```

**Anti-pattern to avoid (RESEARCH.md Pitfall 5):** The existing `saveDraft` function in `actions.ts` (lines 55–60) has a path that calls `.update({ schema_json: schema })` on an existing unpublished version row — this mutates an existing version in place. Phase 13 must remove this path. ALL saves insert a new version row.

---

### `app/client/templates/actions.ts` (service, CRUD) — updated

**Analog:** `app/client/templates/actions.ts` (existing) — exact same file; update `createClientTemplate` and `saveClientDraft` to use coltorapps schema shape

**Client auth guard pattern** (`app/client/templates/actions.ts` lines 1–35):
```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { requireActorUserId, getClientContext } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

async function requireClientContext() {
  const ctx = await getClientContext();
  if (!ctx) throw new Error("Not a client user");
  return ctx;
}

async function requireOwnedTemplate(templateId: string, clientId: string) {
  // ... same ownership check pattern (lines 23–35)
}
```

**owner_type rule (RESEARCH.md Pitfall 3 + AGENTS.md):** Customer templates always insert with `owner_type: "customer"`, `owner_id: ctx.client_id` (the org's UUID, NOT the user's UUID). Never use `"client"` — the DB constraint is `IN ('admin', 'customer')`.

**forkOnFill:** Do NOT touch this function in Phase 13 — it is out of scope (Phase 16). Leave it in place.

---

### `components/form-interpreter/interpreter-renderer.tsx` (component, request-response)

**Analog:** `components/forms/form-renderer.tsx` — this IS the file being replaced; its prop contract and surface-token approach are the template

**Old prop interface** (`components/forms/form-renderer.tsx` lines 30–37):
```typescript
interface FormRendererProps {
  readonly schema: FormSchema          // custom shape
  readonly data: Record<string, any>
  readonly onChange: (id: string, value: any) => void
  readonly surface?: FormSurface
}
```

**New prop interface** (coltorapps shape):
```typescript
interface InterpreterRendererProps {
  schema: FormBuilderSchema;           // coltorapps { entities, root }
  submissionId: string;                // for submit action
  surface?: "dark" | "cream";
}
```

**Old surface token map** (`components/forms/form-renderer.tsx` lines 40–67) — copy the cream tokens (the admin dark tokens in form-renderer use `--p-*` CSS variables tied to the proposal wizard, NOT the builder surface tokens; use the builder's dark tokens from `template-builder.tsx` instead):
```typescript
const surfaceTokens = {
  dark: {
    // Use builder tokens, not proposal wizard tokens
    card: "bg-[#1c1c1c] border-white/5",
    fieldLabel: "text-white/70",
    helpText: "text-white/25",
    input: "bg-transparent border-white/10 text-white",
    errorMsg: "text-[#8b2b21]",
  },
  cream: {
    card: "bg-white border-[#e5e1d8] shadow-sm",
    fieldLabel: "text-[#8a857f]",
    helpText: "text-[#6b6560]",
    input: "bg-white border-[#e5e1d8] text-[#1a1a1a]",
    errorMsg: "text-[#8b2b21]",
  },
} as const;
```

**Client-side validation + submit pattern** (from RESEARCH.md Pattern 5):
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const values = interpreterStore.getEntitiesValues();
  const result = await validateEntitiesValues(values, formBuilder, schema);
  if (!result.success) {
    // surface result.entitiesErrors — each key is an entityId, value is error message
    return;
  }
  try {
    await submitAssessmentAction(submissionId, values);
  } catch {
    toast.error("Submission failed. Check your connection and try again.");
  }
}
```

**InterpreterEntities render pattern** (from RESEARCH.md Pattern 5):
```tsx
<InterpreterEntities
  interpreterStore={interpreterStore}
  components={{
    textField: TextFieldRenderer,
    numberField: NumberFieldRenderer,
    dateField: DateFieldRenderer,
    selectField: SelectFieldRenderer,
    textareaField: TextareaFieldRenderer,
    checkboxField: CheckboxFieldRenderer,
    sectionGroup: SectionGroupRenderer,
  }}
/>
```

---

### `components/form-interpreter/*-field-renderer.tsx` (×7) (component, request-response)

**Analog:** `components/forms/number-field.tsx`, `components/forms/date-field.tsx`, `components/forms/checkbox-field.tsx` — existing field components are the render layer; wrap them

**Wrapper pattern** (each renderer receives coltorapps `entity` and `interpreterStore` props):
```typescript
// components/form-interpreter/number-field-renderer.tsx
"use client";
import { NumberField } from "@/components/forms/number-field";
import type { BuilderEntitiesEntityComponentProps } from "@coltorapps/builder-react";
import type { formBuilder } from "@/lib/form-builder";

type Props = BuilderEntitiesEntityComponentProps<typeof formBuilder, "numberField">;

export function NumberFieldRenderer({ entity, interpreterStore }: Props) {
  const value = interpreterStore.getEntityValue(entity.id);
  const error = interpreterStore.getEntityError(entity.id);
  const attrs = entity.attributes;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold">
        {attrs.label}{attrs.required && <span className="text-[#8b2b21] ml-1">*</span>}
      </label>
      <NumberField
        value={value}
        onChange={(v) => interpreterStore.setEntityValue(entity.id, v)}
        placeholder={attrs.placeholder}
      />
      {attrs.helpText && <p className="text-xs text-muted-foreground">{attrs.helpText}</p>}
      {error && <p className="text-xs text-[#8b2b21]">{error}</p>}
    </div>
  );
}
```

**Surface prop:** The `surface` prop flows from `InterpreterRenderer` → each field renderer → the underlying field component (e.g., `<NumberField surface={surface} />`). The existing field components already accept `surface?: "dark" | "cream"`.

**DateField renderer note:** The existing `DateField` (`components/forms/date-field.tsx`) renders a native `<input type="date">` with a formatted display below. This is reusable as-is. `prefillSource` logic (when `attrs.prefillSource === "currentDate"`) can set an initial value in the interpreter store at mount.

**CheckboxField renderer note:** The existing `CheckboxField` (`components/forms/checkbox-field.tsx`) handles both single checkbox and checkbox group (when `options` array is non-empty). The coltorapps `checkboxField` entity's `options` attribute maps to `field.options`.

**TextFieldRenderer:** Wraps a `<Input>` directly (MicButton is deferred to Phase 14 per D-04). Do NOT import `MicButton` in Phase 13 renderers.

**SectionGroupRenderer:** No existing analog. Renders a Newsreader 18px heading + a divider + `<InterpreterEntities>` for children. Pattern from UI-SPEC:
```tsx
<section>
  <h2 className="font-serif text-lg font-normal leading-[1.3] mb-2">{entity.attributes.title}</h2>
  <hr className="border-white/10 mb-4" />
  <InterpreterEntities
    interpreterStore={interpreterStore}
    components={fieldRenderers}
    entityId={entity.id}  // scoped to this section's children
  />
</section>
```

---

### `app/admin/assessments/[id]/assessment-client.tsx` (component, request-response) — rewired

**Analog:** self (existing `assessment-client.tsx`) — the file is being rewired in place; the autosave + submit lifecycle patterns are kept

**Autosave pattern to preserve** (`app/admin/assessments/[id]/assessment-client.tsx` lines 54–108):
```typescript
const triggerAutosave = useCallback(async (latestAnswers) => {
  try {
    setIsSaving(true);
    await autosaveAnswers(submission.id, latestAnswers);
  } catch (err) { toast.error("Failed to save draft automatically."); }
  finally { setIsSaving(false); }
}, [submission.id]);

// Debounced 800ms autosave on every value change:
timeoutRef.current = setTimeout(() => triggerAutosave(updated), 800);
```

**FormRenderer → InterpreterRenderer swap:**
```typescript
// DELETE:
import { FormRenderer } from "@/components/forms/form-renderer";
// ADD:
import { InterpreterRenderer } from "@/components/form-interpreter/interpreter-renderer";

// DELETE:
<FormRenderer schema={schema} data={answers} onChange={handleFieldChange} />
// ADD:
<InterpreterRenderer schema={schema} submissionId={submission.id} surface="dark" />
```

**Schema source change:** The old code reads `normalizeFormSchema(submission.template?.schema_json)` from the joined template row. After the RSC query is fixed to join via `template_version_id`, the component receives the pinned version's `schema_json` directly (already coltorapps shape).

---

### `app/admin/assessments/[id]/page.tsx` (RSC, request-response) — rewired

**Analog:** self (existing `page.tsx`) — the RSC query join needs fixing per RESEARCH.md Pitfall 2

**Current (broken) join** (`app/admin/assessments/[id]/page.tsx` lines 16–30):
```typescript
// Current: joins template_versions then template — fetches the joined version
// but the version in the join is determined by the FK, not by template_version_id
const { data: submission } = await adminClient
  .from("form_submissions")
  .select(`*, client:clients(name),
    template:template_versions(schema_json, template_id,
      form_template:form_templates(name))`)
  .eq("id", id).maybeSingle();
```

**Fixed join pattern** (explicitly pin to `template_version_id`):
```typescript
// Step 1: fetch submission + pinned version separately (safer than relying on FK join)
const { data: submission } = await adminClient
  .from("form_submissions")
  .select("*, client:clients(name)")
  .eq("id", id).maybeSingle();

const { data: version } = await adminClient
  .from("template_versions")
  .select("schema_json, template_id, form_template:form_templates(name)")
  .eq("id", submission.template_version_id).single();
// Pass version.schema_json (coltorapps shape) to AssessmentClient
```

**UUID gate** (`app/admin/assessments/[id]/page.tsx` lines 4–8) — keep this exactly:
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_RE.test(id)) notFound();
```

---

### `lib/supabase/templates.ts` (service, CRUD) — partial update

**Analog:** self (existing file) — keep `getFormTemplates()` and `getFormTemplate()` unchanged; delete `updateTemplateDraft()` (column does not exist); update type references

**Keep unchanged** (`lib/supabase/templates.ts` lines 6–31):
```typescript
export async function getFormTemplates() { /* ... */ }
export async function getFormTemplate(id: string) { /* ... */ }
export async function getLatestPublishedVersion(templateId: string) { /* ... */ }
```

**Delete entirely** (`lib/supabase/templates.ts` lines 53–61):
```typescript
// DELETE — form_templates.current_draft_json column does not exist (RESEARCH.md Pitfall 5)
export async function updateTemplateDraft(templateId: string, schema: FormSchema) { ... }
```

**Update type imports:** Replace `import { FormSchema, FormTemplate, TemplateVersion } from "@/types/forms"` with coltorapps types. `TemplateVersion.schema_json` becomes `FormBuilderSchema` (i.e., `Schema<typeof formBuilder>`).

---

### `supabase/migrations/010_form_builder_foundation_reseed.sql` (migration, batch)

**Analog:** `supabase/migrations/009_clients_contact_columns.sql` — sequential numbered migration; follow the header comment convention

**Migration header convention** (from existing migrations):
```sql
-- 010_form_builder_foundation_reseed.sql
-- 888 Safety & Training Platform
-- Drop existing form data (custom FormSchema shape) and reseed with coltorapps shape
```

**Truncation order** (respects FK constraints — child tables first):
```sql
-- Phase 13 pre-condition: executor must run
--   SELECT count(*), status FROM form_submissions GROUP BY status
-- and confirm no production data before applying this migration.

TRUNCATE TABLE form_submissions   CASCADE;  -- FK child of template_versions
TRUNCATE TABLE form_assignments   CASCADE;  -- FK child of template_versions + form_templates
TRUNCATE TABLE template_versions  CASCADE;  -- FK child of form_templates
TRUNCATE TABLE form_templates     CASCADE;
```

**Smoke-test seed insert pattern** (D-06 — minimal template with 7 basic types):
```sql
-- Insert smoke-test template
WITH t AS (
  INSERT INTO form_templates (id, name, template_type, owner_id, owner_type, is_published)
  VALUES (gen_random_uuid(), 'Basic Types Smoke Test', 'fra',
          (SELECT id FROM admin_users LIMIT 1), 'admin', false)
  RETURNING id
),
v AS (
  INSERT INTO template_versions (template_id, version_number, schema_json, created_by)
  SELECT t.id, 1,
    '{"entities":{"<uuid1>":{"type":"textField","attributes":{"label":"Name","required":true}},...},"root":["<uuid1>",...]}'::jsonb,
    (SELECT id FROM admin_users LIMIT 1)
  FROM t
  RETURNING id
)
SELECT v.id AS version_id FROM v;
```

Note: UUIDs in the seed JSON must be real UUIDs generated at migration time using `gen_random_uuid()` — use a DO block or a CTE that generates them. Do not hardcode placeholder strings.

---

## Shared Patterns

### Authentication Guard (all server actions)
**Source:** `lib/auth-helpers.ts` lines 50–56 + `app/admin/templates/actions.ts` lines 1–9
**Apply to:** All server actions in `app/admin/templates/actions.ts` and `app/client/templates/actions.ts`
```typescript
"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireActorUserId } from "@/lib/auth-helpers";

// First line of every server action:
const userId = await requireActorUserId("admin");  // throws if unauthenticated (non-demo)
```

### Surface Token Map (all builder/interpreter components)
**Source:** `components/templates/template-builder.tsx` lines 77–122
**Apply to:** `builder-canvas.tsx`, `field-palette.tsx`, `field-card.tsx`, `section-card.tsx`, `properties-panel.tsx`, `interpreter-renderer.tsx`, all field-renderer components
```typescript
// Two-key object: "dark" for admin builder surface, "cream" for client surface
const surfaceTokens = {
  dark: { root: "bg-[#111]", panel: "bg-[#0d0d0d]", ... },
  cream: { root: "bg-[#fbfaf5]", panel: "bg-[#faf9f6]", ... },
} as const;
type Surface = keyof typeof surfaceTokens;
// Destructure at top of component: const t = surfaceTokens[surface];
// Apply via cn(..., t.tokenName)
```

### Supabase Server-Only Client
**Source:** `lib/supabase/templates.ts` lines 1–2 + `lib/supabase/server.ts`
**Apply to:** All server actions and RSC pages
```typescript
import { createClient } from "@/lib/supabase/server";
// For service-role operations (bypassing RLS):
import { adminClient } from "@/lib/supabase/admin";

// Always await createClient() — it is async in Next.js 16
const supabase = await createClient();
```

### revalidatePath After Mutations
**Source:** `app/admin/templates/actions.ts` lines 31, 79, 120–122
**Apply to:** All server actions that mutate form_templates or template_versions
```typescript
revalidatePath("/admin/templates");
revalidatePath(`/admin/templates/${templateId}`);
```

### Sonner Toast for Submit Errors
**Source:** `app/admin/assessments/[id]/assessment-client.tsx` lines 8–9
**Apply to:** `interpreter-renderer.tsx` submission error path
```typescript
import { toast } from "sonner";
// On submission API failure:
toast.error("Submission failed. Check your connection and try again.");
```

### owner_type Write Rule
**Source:** `app/client/templates/actions.ts` lines 43–50 + AGENTS.md decision
**Apply to:** Any server action that inserts into `form_templates`
```typescript
// Admin-owned: owner_type = 'admin', owner_id = admin_users.id (= auth.uid() for admins)
{ owner_id: userId, owner_type: "admin" }
// Customer-owned: owner_type = 'customer', owner_id = clients.id (the org, NOT the user)
{ owner_id: ctx.client_id, owner_type: "customer" }
// NEVER use 'client' — DB constraint is IN ('admin', 'customer')
```

### cn() for Conditional Classes
**Source:** All component files
**Apply to:** All components
```typescript
import { cn } from "@/lib/utils";
// Always use cn() for conditional / surface-dependent class names
className={cn("base-classes", isSelected && "selected-class", t.surfaceToken)}
```

### Next.js 16 params Await
**Source:** `app/admin/templates/[id]/page.tsx` line 29 + `app/admin/assessments/[id]/page.tsx` line 8
**Apply to:** All dynamic RSC pages
```typescript
// params is a Promise in Next.js 16 — always await it
const { id } = await params;
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/form-builder/entities/*.ts` (coltorapps API) | config | transform | `createEntity` / `createAttribute` API is new to this codebase; use RESEARCH.md patterns |
| `components/form-interpreter/section-group-renderer.tsx` | component | request-response | No nested section renderer exists; use UI-SPEC contract + coltorapps `InterpreterEntities entityId` prop |

---

## Metadata

**Analog search scope:** `components/templates/`, `components/forms/`, `app/admin/templates/`, `app/client/templates/`, `app/admin/assessments/`, `lib/supabase/`, `lib/types/`, `lib/auth-helpers.ts`, `supabase/migrations/`
**Files scanned:** 25
**Pattern extraction date:** 2026-05-20
