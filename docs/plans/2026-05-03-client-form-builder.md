# Client-Side Form Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mount the existing drag-and-drop form builder under `/client/templates/*` (cream theme), give clients ownership scoping, and ship a dormant `forkOnFill` server action ready to wire into a future client-side fill UI.

**Architecture:** Reuse the existing builder components by adding a `surface` prop ("dark" | "cream"). Move them out of `app/admin/templates/[id]/_components/` into `components/templates/` so both `/admin/templates/*` and `/client/templates/*` import the same code. Add a `flatToSections()` adapter so the existing `form-renderer.tsx` can consume builder-created schemas without unifying the two schema shapes. Add a `hasStructuralChanges()` helper that the dormant `forkOnFill` action will use to decide whether to fork. Patch RLS in a new migration 004 to scope the published-master policies to `owner_type='admin'` and add the missing `template_versions` UPDATE policy for customer-owned rows.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (SSR client + RLS), `@dnd-kit`, Tailwind v4. Tests: vitest for pure helpers.

**Scoping decisions confirmed by user (2026-05-03):**
- `forkOnFill` ships as an **exported function only** — no UI calls it yet. Wiring is a separate future task.
- A `flatToSections()` adapter is added now; full schema unification is deferred.
- No `/client/templates/[id]/fill` page in this plan.

---

## Pre-flight

**Confirm working directory and branch:**

```bash
cd /Users/aymanbaig/Desktop/Fire-safety-platform
git status
git checkout -b feat/client-form-builder
```

Expected: clean working tree, new branch created.

---

## Task 1: Move builder components to shared location

The four builder components currently live under `app/admin/templates/[id]/_components/`. To reuse them from `/client/templates/*`, move them to `components/templates/`.

**Files:**
- Move: `app/admin/templates/[id]/_components/template-builder.tsx` → `components/templates/template-builder.tsx`
- Move: `app/admin/templates/[id]/_components/field-palette.tsx` → `components/templates/field-palette.tsx`
- Move: `app/admin/templates/[id]/_components/sortable-field.tsx` → `components/templates/sortable-field.tsx`
- Move: `app/admin/templates/[id]/_components/field-config.tsx` → `components/templates/field-config.tsx`
- Modify: `app/admin/templates/[id]/page.tsx:3` — update import path

**Step 1: Move the four files**

```bash
mkdir -p components/templates
git mv app/admin/templates/[id]/_components/template-builder.tsx components/templates/template-builder.tsx
git mv app/admin/templates/[id]/_components/field-palette.tsx components/templates/field-palette.tsx
git mv app/admin/templates/[id]/_components/sortable-field.tsx components/templates/sortable-field.tsx
git mv app/admin/templates/[id]/_components/field-config.tsx components/templates/field-config.tsx
rmdir app/admin/templates/[id]/_components
```

**Step 2: Update internal imports in `template-builder.tsx`**

The moved file imports from a relative path that no longer resolves. Change:

```tsx
import { saveDraft, publishTemplate } from "../../actions";
```

to:

```tsx
import { saveDraft, publishTemplate } from "@/app/admin/templates/actions";
```

And update the three child-component imports from relative to absolute:

```tsx
import { FieldPalette } from "./field-palette";
import { SortableField } from "./sortable-field";
import { FieldConfig } from "./field-config";
```

These stay relative — the children are now siblings under `components/templates/`. ✓

**Step 3: Update the admin page import**

In `app/admin/templates/[id]/page.tsx:3`:

```tsx
import { TemplateBuilder } from "@/components/templates/template-builder";
```

(was `import { TemplateBuilder } from "./_components/template-builder";`)

**Step 4: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 5: Smoke-test the admin route still works**

```bash
npm run dev
# In a separate terminal or browser, hit http://localhost:3000/admin/templates/<an-existing-id>
# Expect: builder renders identically. Add a field, save draft, confirm "Saved" status.
```

If the dev server output shows compile errors, fix them before continuing.

**Step 6: Commit**

```bash
git add components/templates/ app/admin/templates/[id]/page.tsx
git commit -m "refactor: move builder components to components/templates for reuse"
```

---

## Task 2: Add `surface` prop type to FormBuilder types

Add a shared `BuilderSurface` type to `lib/types/form-builder.ts` so all four components can import it.

**Files:**
- Modify: `lib/types/form-builder.ts`

**Step 1: Add the type at the top of the file**

After line 1, before the `FieldType` export:

```ts
export type BuilderSurface = "dark" | "cream";
```

**Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add lib/types/form-builder.ts
git commit -m "feat: add BuilderSurface type for surface-aware builder components"
```

---

## Task 3: Write `flatToSections()` adapter with tests

The builder writes flat `{ fields: [...] }` schemas. The renderer reads nested `{ title, sections: [{ id, title, fields }] }`. Add a one-section wrapper so builder output can flow into the existing renderer.

**Files:**
- Create: `lib/forms/schema-adapter.ts`
- Create: `lib/forms/schema-adapter.test.ts`

**Step 1: Write the failing test**

```ts
// lib/forms/schema-adapter.test.ts
import { describe, it, expect } from "vitest";
import { flatToSections } from "./schema-adapter";
import type { FormSchema as BuilderSchema } from "@/lib/types/form-builder";

describe("flatToSections", () => {
  it("wraps a flat builder schema in a single 'default' section", () => {
    const flat: BuilderSchema = {
      fields: [
        { id: "f1", key: "name", type: "text", label: "Name", required: true },
        { id: "f2", key: "notes", type: "textarea", label: "Notes", required: false },
      ],
    };
    const result = flatToSections(flat, { title: "My Form" });
    expect(result.title).toBe("My Form");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].id).toBe("default");
    expect(result.sections[0].title).toBe("Section 1");
    expect(result.sections[0].fields).toHaveLength(2);
    expect(result.sections[0].fields[0].id).toBe("f1");
  });

  it("defaults the title to 'Untitled form' when not provided", () => {
    const result = flatToSections({ fields: [] });
    expect(result.title).toBe("Untitled form");
  });

  it("returns version: 1 by default for renderer compatibility", () => {
    const result = flatToSections({ fields: [] });
    expect(result.version).toBe(1);
  });

  it("preserves field options and required flag through the conversion", () => {
    const flat: BuilderSchema = {
      fields: [
        {
          id: "f1",
          key: "site",
          type: "dropdown",
          label: "Site",
          required: true,
          options: [{ label: "A", value: "a" }, { label: "B", value: "b" }],
        },
      ],
    };
    const result = flatToSections(flat);
    expect(result.sections[0].fields[0].required).toBe(true);
    expect(result.sections[0].fields[0].options).toEqual([
      { label: "A", value: "a" },
      { label: "B", value: "b" },
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run lib/forms/schema-adapter.test.ts
```

Expected: FAIL with "Cannot find module './schema-adapter'".

**Step 3: Write the minimal implementation**

```ts
// lib/forms/schema-adapter.ts
import type { FormSchema as BuilderSchema } from "@/lib/types/form-builder";
import type { FormSchema as RendererSchema, FormField as RendererField } from "@/types/forms";

interface FlatToSectionsOptions {
  title?: string;
  description?: string;
  version?: number;
}

/**
 * Wraps a flat builder schema (`{ fields: [...] }`) into the nested renderer
 * schema (`{ title, sections: [{ id, title, fields }] }`) so the existing
 * `form-renderer.tsx` can consume builder output unchanged.
 *
 * This is a deliberate shim — the two schemas remain separate to avoid a
 * cross-cutting refactor. See docs/plans/2026-05-03-client-form-builder.md
 * for the scoping decision.
 */
export function flatToSections(
  flat: BuilderSchema,
  opts: FlatToSectionsOptions = {}
): RendererSchema {
  return {
    version: opts.version ?? 1,
    title: opts.title ?? "Untitled form",
    description: opts.description,
    sections: [
      {
        id: "default",
        title: "Section 1",
        fields: flat.fields as unknown as readonly RendererField[],
      },
    ],
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run lib/forms/schema-adapter.test.ts
```

Expected: 4 tests pass.

**Step 5: Commit**

```bash
git add lib/forms/schema-adapter.ts lib/forms/schema-adapter.test.ts
git commit -m "feat: add flatToSections adapter so renderer can consume builder schemas"
```

---

## Task 4: Write `hasStructuralChanges()` helper with tests

This pure function decides whether the `forkOnFill` action should fork or not. It compares two flat builder schemas and returns `true` if any structural property differs (field ids, order, types, labels, options, required flag) — but ignores answer values, since values aren't part of the schema.

**Files:**
- Create: `lib/forms/schema-diff.ts`
- Create: `lib/forms/schema-diff.test.ts`

**Step 1: Write the failing tests**

```ts
// lib/forms/schema-diff.test.ts
import { describe, it, expect } from "vitest";
import { hasStructuralChanges } from "./schema-diff";
import type { FormSchema } from "@/lib/types/form-builder";

const baseSchema: FormSchema = {
  fields: [
    { id: "f1", key: "name", type: "text", label: "Name", required: true },
    { id: "f2", key: "site", type: "dropdown", label: "Site", required: false,
      options: [{ label: "A", value: "a" }] },
  ],
};

describe("hasStructuralChanges", () => {
  it("returns false for identical schemas", () => {
    expect(hasStructuralChanges(baseSchema, baseSchema)).toBe(false);
  });

  it("returns false for a deep clone with same content", () => {
    const clone = JSON.parse(JSON.stringify(baseSchema));
    expect(hasStructuralChanges(baseSchema, clone)).toBe(false);
  });

  it("returns true when a field is added", () => {
    const next: FormSchema = {
      fields: [...baseSchema.fields,
        { id: "f3", key: "extra", type: "text", label: "Extra", required: false }],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a field is removed", () => {
    const next: FormSchema = { fields: [baseSchema.fields[0]] };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when fields are reordered", () => {
    const next: FormSchema = {
      fields: [baseSchema.fields[1], baseSchema.fields[0]],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a field type changes", () => {
    const next: FormSchema = {
      fields: [
        { ...baseSchema.fields[0], type: "textarea" },
        baseSchema.fields[1],
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a label changes", () => {
    const next: FormSchema = {
      fields: [
        { ...baseSchema.fields[0], label: "Full Name" },
        baseSchema.fields[1],
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when a required flag flips", () => {
    const next: FormSchema = {
      fields: [
        { ...baseSchema.fields[0], required: false },
        baseSchema.fields[1],
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });

  it("returns true when dropdown options change", () => {
    const next: FormSchema = {
      fields: [
        baseSchema.fields[0],
        { ...baseSchema.fields[1], options: [{ label: "B", value: "b" }] },
      ],
    };
    expect(hasStructuralChanges(baseSchema, next)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run lib/forms/schema-diff.test.ts
```

Expected: FAIL with "Cannot find module './schema-diff'".

**Step 3: Write the minimal implementation**

```ts
// lib/forms/schema-diff.ts
import type { FormSchema, FormField } from "@/lib/types/form-builder";

/**
 * Returns true if `next` differs structurally from `original`. Compares field
 * identity (id + order), type, label, required flag, and options list. Used
 * by the `forkOnFill` server action to decide whether a customer's edits to
 * a master template warrant creating a forked template record.
 *
 * NOT compared: helpText, placeholder, maxPhotos, maxRating — these are
 * presentation-only and editing them shouldn't trigger a fork. Adjust if
 * the Finley contract changes.
 */
export function hasStructuralChanges(original: FormSchema, next: FormSchema): boolean {
  if (original.fields.length !== next.fields.length) return true;
  for (let i = 0; i < original.fields.length; i++) {
    if (fieldDiffers(original.fields[i], next.fields[i])) return true;
  }
  return false;
}

function fieldDiffers(a: FormField, b: FormField): boolean {
  if (a.id !== b.id) return true;
  if (a.type !== b.type) return true;
  if (a.label !== b.label) return true;
  if (Boolean(a.required) !== Boolean(b.required)) return true;
  if (!optionsEqual(a.options, b.options)) return true;
  return false;
}

function optionsEqual(
  a: FormField["options"] | undefined,
  b: FormField["options"] | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label || a[i].value !== b[i].value) return false;
  }
  return true;
}
```

**Step 4: Run test to verify all pass**

```bash
npx vitest run lib/forms/schema-diff.test.ts
```

Expected: 9 tests pass.

**Step 5: Commit**

```bash
git add lib/forms/schema-diff.ts lib/forms/schema-diff.test.ts
git commit -m "feat: add hasStructuralChanges helper for fork-on-fill decisions"
```

---

## Task 5: Add cream theme tokens to `template-builder.tsx`

Add a `surface` prop and switch the toolbar / canvas / panel chrome based on it.

**Files:**
- Modify: `components/templates/template-builder.tsx`

**Step 1: Update the Props interface and signature**

Add to the `Props` interface (around line 39):

```tsx
surface?: BuilderSurface;
```

And import the type at the top (line 25 area):

```tsx
import type { FormField, FormSchema, FieldType, BuilderSurface } from "@/lib/types/form-builder";
```

**Step 2: Define a token table near the top of the component**

After `function defaultField(...)` block, add:

```tsx
const surfaceTokens = {
  dark: {
    shell: "bg-[#111]",
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
  },
  cream: {
    shell: "bg-[#fbfaf5]",
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
  },
} as const;
```

**Step 3: Apply tokens throughout the JSX**

Replace hardcoded class strings with `t.<token>` references. Defer to the system.md design tokens — cream is already established in `app/client/layout.tsx`. Examples:

- Outer `<div>` (line 178): keep flex layout, no bg change (the route's layout owns the page bg).
- Toolbar (line 180): `className={cn("flex items-center gap-4 px-8 py-4 border-b shrink-0", t.toolbar)}`
- Title input (line 189-194): `className={cn("bg-transparent font-serif text-xl outline-none border-b transition-colors px-0 py-0.5 min-w-0 w-72", t.titleInput)}`
- Type label (line 195): `className={cn("font-mono text-[10px] uppercase tracking-wider shrink-0", t.typeLabel)}`
- Back link (line 183): `className={cn("transition-colors", t.backLink)}`
- Save button (line 226): `className={cn("h-8 gap-2 font-mono text-xs", t.saveLabel)}`
- Publish button (line 237): `className={cn("rounded-sm h-8 gap-2 font-mono text-xs px-4", t.publishBtn)}`
- Left palette wrapper (line 248): `className={cn("w-56 border-r overflow-y-auto shrink-0", t.panel)}`
- Right config wrapper (line 299): `className={cn("w-72 border-l overflow-y-auto shrink-0", t.panel)}`
- Empty state ring (line 256): `className={cn("w-14 h-14 rounded-full border flex items-center justify-center", t.emptyIconRing)}`
- Empty state icon (line 257): `className={cn("w-6 h-6", t.emptyIcon)}`
- Empty state text (line 259): `className={cn("text-sm font-mono", t.emptyText)}`
- Bottom bar (line 314): `className={cn("px-8 py-2.5 border-t flex items-center gap-4 shrink-0", t.bottomBar)}`
- Drag overlay card stays admin-styled — it's only shown briefly mid-drag and gold/teal accents are universal.

Add at the top of the component body:

```tsx
const t = surfaceTokens[surface];
```

And import `cn`:

```tsx
import { cn } from "@/lib/utils";
```

Default the prop in the destructure:

```tsx
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
}: Props) {
```

**Step 4: Pass `surface` down to `FieldPalette`, `SortableField`, `FieldConfig`**

In the JSX:

```tsx
<FieldPalette onAdd={addField} surface={surface} />
```

```tsx
<SortableField
  key={field.id}
  field={field}
  isSelected={selectedId === field.id}
  onSelect={() => setSelectedId(field.id)}
  onDuplicate={() => duplicateField(field.id)}
  onDelete={() => deleteField(field.id)}
  surface={surface}
/>
```

```tsx
<FieldConfig
  field={selectedField}
  onChange={(updates) => updateField(selectedField.id, updates)}
  surface={surface}
/>
```

(These children don't accept `surface` yet — that's Tasks 6–8. Typecheck will fail until those land. That's expected.)

**Step 5: Save the file. Skip typecheck — children aren't ready yet.**

**Step 6: Commit**

```bash
git add components/templates/template-builder.tsx
git commit -m "feat: add surface prop to TemplateBuilder with cream theme tokens"
```

---

## Task 6: Add cream theme tokens to `field-palette.tsx`

**Files:**
- Modify: `components/templates/field-palette.tsx`

**Step 1: Update Props and add token table**

```tsx
import type { FieldType, BuilderSurface } from "@/lib/types/form-builder";
import { cn } from "@/lib/utils";

// ...existing FIELDS array unchanged...

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
```

**Step 2: Apply tokens in JSX**

```tsx
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
```

**Step 3: Commit**

```bash
git add components/templates/field-palette.tsx
git commit -m "feat: add surface prop to FieldPalette with cream theme tokens"
```

---

## Task 7: Add cream theme tokens to `sortable-field.tsx`

**Files:**
- Modify: `components/templates/sortable-field.tsx`

**Step 1: Update Props and add token table**

```tsx
import type { FormField, BuilderSurface } from "@/lib/types/form-builder";
import { cn } from "@/lib/utils";

// ...FIELD_TYPE_LABELS unchanged...

interface Props {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  surface?: BuilderSurface;
}

const surfaceTokens = {
  dark: {
    base: "bg-[#1c1c1c] border-white/5 hover:border-white/10 hover:bg-[#222]",
    selected: "bg-[#1e2e2b] border-[#3b8273]/50 shadow-[0_0_0_1px_rgba(59,130,115,0.2)]",
    grip: "text-white/20 hover:text-white/50",
    label: "text-white",
    requiredMark: "text-[#8b2b21]",
    typeBadge: "text-white/30",
    helpDivider: "text-white/20",
    helpText: "text-white/25",
    optionPill: "text-white/30 bg-white/5 border-white/10",
    optionExtra: "text-white/20",
    actionBtn: "text-white/30 hover:text-white/70 hover:bg-white/5",
    deleteBtn: "text-white/30 hover:text-[#8b2b21] hover:bg-[#8b2b21]/10",
  },
  cream: {
    base: "bg-white border-[#e5e1d8] hover:border-[#1a1a1a]/15 hover:bg-[#faf9f6]",
    selected: "bg-[#f5f3ee] border-[#1a1a1a] shadow-[0_0_0_1px_rgba(26,26,26,0.15)]",
    grip: "text-[#8a857f] hover:text-[#1a1a1a]",
    label: "text-[#1a1a1a]",
    requiredMark: "text-[#8b2b21]",
    typeBadge: "text-[#8a857f]",
    helpDivider: "text-[#d8d4cc]",
    helpText: "text-[#6b6560]",
    optionPill: "text-[#6b6560] bg-[#f5f3ee] border-[#e5e1d8]",
    optionExtra: "text-[#8a857f]",
    actionBtn: "text-[#8a857f] hover:text-[#1a1a1a] hover:bg-[#f0ede6]",
    deleteBtn: "text-[#8a857f] hover:text-[#8b2b21] hover:bg-[#8b2b21]/10",
  },
} as const;
```

**Step 2: Apply tokens in JSX — full replacement**

Replace the existing `return ()` body so the outer div, grip, label/type/help, options preview, and action buttons all use `t.<token>` instead of literal class strings. (The structural HTML stays identical — only `className` values change.)

```tsx
export function SortableField({ field, isSelected, onSelect, onDuplicate, onDelete, surface = "dark" }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const t = surfaceTokens[surface];

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group relative flex items-start gap-3 px-4 py-4 rounded-sm border cursor-pointer transition-all",
        isSelected ? t.selected : t.base
      )}
    >
      <div
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className={cn("mt-0.5 cursor-grab active:cursor-grabbing transition-colors shrink-0", t.grip)}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn("text-sm font-medium leading-tight", t.label)}>{field.label}</span>
          {field.required && <span className={cn("text-xs font-mono", t.requiredMark)}>*</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono text-[10px] uppercase tracking-wider", t.typeBadge)}>
            {FIELD_TYPE_LABELS[field.type] ?? field.type}
          </span>
          {field.helpText && (
            <>
              <span className={t.helpDivider}>·</span>
              <span className={cn("text-[11px] truncate max-w-[200px]", t.helpText)}>{field.helpText}</span>
            </>
          )}
        </div>

        {(field.type === "dropdown" || field.type === "multi-select") && field.options && field.options.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {field.options.slice(0, 4).map(opt => (
              <span key={opt.value} className={cn("text-[10px] font-mono border px-1.5 py-0.5 rounded-[2px]", t.optionPill)}>
                {opt.label}
              </span>
            ))}
            {field.options.length > 4 && (
              <span className={cn("text-[10px] font-mono", t.optionExtra)}>+{field.options.length - 4} more</span>
            )}
          </div>
        )}
      </div>

      <div className={`flex items-center gap-1 shrink-0 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button
          onClick={e => { e.stopPropagation(); onDuplicate(); }}
          className={cn("w-7 h-7 flex items-center justify-center rounded-[3px] transition-all", t.actionBtn)}
          title="Duplicate"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className={cn("w-7 h-7 flex items-center justify-center rounded-[3px] transition-all", t.deleteBtn)}
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add components/templates/sortable-field.tsx
git commit -m "feat: add surface prop to SortableField with cream theme tokens"
```

---

## Task 8: Add cream theme tokens to `field-config.tsx`

**Files:**
- Modify: `components/templates/field-config.tsx`

**Step 1: Update Props and add token table**

```tsx
import type { FormField, FieldOption, BuilderSurface } from "@/lib/types/form-builder";
import { cn } from "@/lib/utils";

interface Props {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
  surface?: BuilderSurface;
}

const surfaceTokens = {
  dark: {
    headerBorder: "border-white/5",
    headerLabel: "text-white/30",
    label: "text-white/40",
    input: "bg-transparent border-white/10 text-white placeholder:text-white/20 focus:border-white/30",
    keyInput: "bg-transparent border-white/10 text-white/60 placeholder:text-white/20 focus:border-white/30",
    helpHint: "text-white/20",
    toggleOn: "bg-[#3b8273]",
    toggleOff: "bg-white/10",
    toggleKnob: "bg-white",
    optionInput: "bg-transparent border-white/10 text-white focus:border-white/30",
    optionRemove: "text-white/20 hover:text-[#8b2b21]",
    addOptionInput: "bg-transparent border-dashed border-white/10 text-white placeholder:text-white/20 focus:border-white/20",
    addOptionBtn: "text-white/30 hover:text-[#3b8273]",
    select: "bg-[#111] border-white/10 text-white focus:border-white/30",
    typeFooter: "border-white/5 text-white/20",
  },
  cream: {
    headerBorder: "border-[#e5e1d8]",
    headerLabel: "text-[#8a857f]",
    label: "text-[#8a857f]",
    input: "bg-white border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    keyInput: "bg-white border-[#e5e1d8] text-[#6b6560] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    helpHint: "text-[#8a857f]",
    toggleOn: "bg-[#1a1a1a]",
    toggleOff: "bg-[#e5e1d8]",
    toggleKnob: "bg-white",
    optionInput: "bg-white border-[#e5e1d8] text-[#1a1a1a] focus:border-[#1a1a1a]/40",
    optionRemove: "text-[#8a857f] hover:text-[#8b2b21]",
    addOptionInput: "bg-transparent border-dashed border-[#e5e1d8] text-[#1a1a1a] placeholder:text-[#a8a39d] focus:border-[#1a1a1a]/40",
    addOptionBtn: "text-[#8a857f] hover:text-[#1a1a1a]",
    select: "bg-white border-[#e5e1d8] text-[#1a1a1a] focus:border-[#1a1a1a]/40",
    typeFooter: "border-[#e5e1d8] text-[#8a857f]",
  },
} as const;
```

**Step 2: Apply tokens in JSX**

Replace the function body to thread `t.<token>` into every input/select/label/button/border. Same structural HTML as the existing file — only `className` values change. Default the prop:

```tsx
export function FieldConfig({ field, onChange, surface = "dark" }: Props) {
  const [newOption, setNewOption] = useState("");
  const t = surfaceTokens[surface];
  // ...rest unchanged in shape, with token swaps...
}
```

Apply tokens to: header (border + label), each form field (label + input), the required toggle, the options list (input + remove + add input + add button), the rating select, the photos select, and the type footer. Do not change handler logic.

**Step 3: Run typecheck — should now pass since all four child components accept `surface`**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Smoke-test admin route renders unchanged**

```bash
npm run dev
# Browser: http://localhost:3000/admin/templates/<existing-id>
# Confirm: identical to before — surface defaults to "dark".
```

**Step 5: Commit**

```bash
git add components/templates/field-config.tsx
git commit -m "feat: add surface prop to FieldConfig with cream theme tokens"
```

---

## Task 9: Write migration 004 — RLS hardening

Two RLS gaps identified during the audit:
- `form_templates_client_published` (migration 001:262) lets clients SELECT *any* published template, including other customers' published templates. Scope it to `owner_type='admin'`.
- `template_versions_client_published` (001:274) has the same issue.
- Migration 003 added INSERT for customer-owned `template_versions` but no UPDATE — the `saveDraft` action UPDATEs existing draft versions in place, so customer-owned drafts can't be saved without this.

**Files:**
- Create: `supabase/migrations/004_form_templates_rls_fixes.sql`

**Step 1: Write the migration**

```sql
-- 004_form_templates_rls_fixes.sql
-- Fixes from the 2026-05-03 audit, prerequisite for client-side form builder.
--
-- 1. Tighten "form_templates_client_published" so customers can only SELECT
--    Matt's published masters, not other customers' published rows.
-- 2. Same for "template_versions_client_published".
-- 3. Add UPDATE policy on template_versions for customer-owned templates so
--    the saveDraft action can rewrite an existing draft version in place.

-- ─────────────────────────────────────────────────────────────
-- form_templates: scope published-master read to owner_type='admin'
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "form_templates_client_published" ON form_templates;
CREATE POLICY "form_templates_client_published" ON form_templates
  FOR SELECT USING (
    is_published = TRUE
    AND owner_type = 'admin'
  );

-- ─────────────────────────────────────────────────────────────
-- template_versions: scope published read to admin-owned templates
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "template_versions_client_published" ON template_versions;
CREATE POLICY "template_versions_client_published" ON template_versions
  FOR SELECT USING (
    published_at IS NOT NULL
    AND template_id IN (
      SELECT id FROM form_templates WHERE owner_type = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- template_versions: allow customers to UPDATE drafts of their own templates
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "template_versions_client_own_update" ON template_versions;
CREATE POLICY "template_versions_client_own_update" ON template_versions
  FOR UPDATE USING (
    template_id IN (
      SELECT id FROM form_templates
      WHERE owner_type = 'customer'
        AND owner_id IN (SELECT client_id FROM client_users WHERE id = auth.uid())
    )
  );
```

**Step 2: Apply the migration**

If using local Supabase via CLI:

```bash
npx supabase db push
```

If pointing at hosted Supabase, run the SQL through the Supabase SQL editor. Confirm in the Authentication → Policies UI that the three policies are present.

**Step 3: Commit**

```bash
git add supabase/migrations/004_form_templates_rls_fixes.sql
git commit -m "fix: scope client published-template RLS to owner_type=admin and add customer draft UPDATE policy"
```

---

## Task 10: Create client server actions

Mirror the admin actions, scoped to the customer's `client_id`. Plus the dormant `forkOnFill` export.

**Files:**
- Create: `app/client/templates/actions.ts`

**Step 1: Write the file**

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { FormSchema } from "@/lib/types/form-builder";
import { hasStructuralChanges } from "@/lib/forms/schema-diff";

async function requireClientContext() {
  const ctx = await getClientContext();
  if (!ctx) throw new Error("Not a client user");
  return ctx;
}

export async function createClientTemplate(name: string, templateType: string) {
  const supabase = await createClient();
  const ctx = await requireClientContext();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("form_templates")
    .insert({
      name,
      template_type: templateType,
      owner_id: ctx.client_id,
      owner_type: "customer",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("template_versions").insert({
    template_id: data.id,
    version_number: 1,
    schema_json: { fields: [] },
    created_by: user.id,
  });

  revalidatePath("/client/templates");
  return data.id;
}

export async function saveClientDraft(templateId: string, schema: FormSchema, templateName: string) {
  const supabase = await createClient();
  await requireClientContext();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("form_templates")
    .update({ name: templateName })
    .eq("id", templateId);

  const { data: latest } = await supabase
    .from("template_versions")
    .select("id, published_at")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (latest && !latest.published_at) {
    await supabase
      .from("template_versions")
      .update({ schema_json: schema })
      .eq("id", latest.id);
  } else {
    const { data: maxVersion } = await supabase
      .from("template_versions")
      .select("version_number")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    await supabase.from("template_versions").insert({
      template_id: templateId,
      version_number: (maxVersion?.version_number ?? 0) + 1,
      schema_json: schema,
      created_by: user.id,
    });
  }

  revalidatePath(`/client/templates/${templateId}`);
}

export async function publishClientTemplate(templateId: string, schema: FormSchema, templateName: string) {
  const supabase = await createClient();
  await requireClientContext();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase
    .from("form_templates")
    .update({ name: templateName, is_published: true })
    .eq("id", templateId);

  const { data: draft } = await supabase
    .from("template_versions")
    .select("id, version_number, published_at")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  if (draft && !draft.published_at) {
    await supabase
      .from("template_versions")
      .update({ schema_json: schema, published_at: new Date().toISOString() })
      .eq("id", draft.id);
  } else {
    const newVersion = (draft?.version_number ?? 0) + 1;
    await supabase.from("template_versions").insert({
      template_id: templateId,
      version_number: newVersion,
      schema_json: schema,
      published_at: new Date().toISOString(),
      created_by: user.id,
    });
  }

  revalidatePath("/client/templates");
  revalidatePath(`/client/templates/${templateId}`);
}

export async function deleteClientTemplate(templateId: string) {
  const supabase = await createClient();
  await requireClientContext();
  await supabase.from("form_templates").delete().eq("id", templateId);
  revalidatePath("/client/templates");
}

/**
 * Fork a master template for the current customer when they've changed its
 * structure during fill. NOT YET WIRED INTO ANY UI — the client-side form-fill
 * page is a separate task. When that page is built, it should:
 *
 *   const result = await forkOnFill(masterTemplateId, masterSchema, modifiedSchema);
 *   const versionIdToSubmitAgainst = result.versionId;
 *
 * Returns `{ forked: true, templateId, versionId }` if structure changed and a
 * fork was created. Returns `{ forked: false, templateId, versionId }` (the
 * master's published version) if no structural change — caller should submit
 * against the master version directly.
 *
 * Contract preserved per AGENTS.md "Form template ownership" decision (2026-04-17).
 */
export async function forkOnFill(
  masterTemplateId: string,
  originalSchema: FormSchema,
  modifiedSchema: FormSchema
): Promise<{ forked: boolean; templateId: string; versionId: string }> {
  const supabase = await createClient();
  const ctx = await requireClientContext();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  if (!hasStructuralChanges(originalSchema, modifiedSchema)) {
    const { data: masterVersion, error } = await supabase
      .from("template_versions")
      .select("id")
      .eq("template_id", masterTemplateId)
      .not("published_at", "is", null)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    if (error || !masterVersion) throw new Error("Master template has no published version to bind to");
    return { forked: false, templateId: masterTemplateId, versionId: masterVersion.id };
  }

  const { data: master, error: masterErr } = await supabase
    .from("form_templates")
    .select("name, template_type")
    .eq("id", masterTemplateId)
    .single();
  if (masterErr || !master) throw new Error("Master template not found");

  const { data: forkRow, error: forkErr } = await supabase
    .from("form_templates")
    .insert({
      name: master.name,
      template_type: master.template_type,
      owner_id: ctx.client_id,
      owner_type: "customer",
      parent_template_id: masterTemplateId,
      is_published: true,
    })
    .select("id")
    .single();
  if (forkErr || !forkRow) throw new Error(forkErr?.message ?? "Fork insert failed");

  const { data: versionRow, error: versionErr } = await supabase
    .from("template_versions")
    .insert({
      template_id: forkRow.id,
      version_number: 1,
      schema_json: modifiedSchema,
      published_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionErr || !versionRow) throw new Error(versionErr?.message ?? "Fork version insert failed");

  return { forked: true, templateId: forkRow.id, versionId: versionRow.id };
}
```

**Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add app/client/templates/actions.ts
git commit -m "feat: add client template server actions and dormant forkOnFill"
```

---

## Task 11: Create client templates list page

Two sections: Assigned Templates (admin-owned, published, read-only with "Fill" placeholder) and My Templates (customer-owned, with "Edit" CTA).

**Files:**
- Create: `app/client/templates/page.tsx`
- Create: `app/client/templates/_components/new-client-template-button.tsx`

**Step 1: Write the new-template button (cream surface)**

```tsx
// app/client/templates/_components/new-client-template-button.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClientTemplate } from "../actions";

export function NewClientTemplateButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("custom");

  async function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const id = await createClientTemplate(name.trim(), type);
      setShowModal(false);
      router.push(`/client/templates/${id}`);
    });
  }

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        className="rounded-sm bg-[#1a1a1a] hover:bg-black text-white h-10 px-6 font-bold text-[10px] uppercase tracking-[0.25em] shadow-none"
      >
        + New Template
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e5e1d8] rounded-sm w-full max-w-md p-8 flex flex-col gap-6 shadow-xl">
            <h3 className="font-serif text-2xl text-[#1a1a1a]">New Template</h3>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#8a857f]">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Daily Fire Door Walkaround"
                className="bg-white border border-[#e5e1d8] rounded-sm px-4 py-3 text-[#1a1a1a] text-sm placeholder:text-[#a8a39d] outline-none focus:border-[#1a1a1a]/40 transition-colors"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-[#8a857f]">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="bg-white border border-[#e5e1d8] rounded-sm px-4 py-3 text-[#1a1a1a] text-sm outline-none focus:border-[#1a1a1a]/40 transition-colors"
              >
                <option value="custom">Custom</option>
                <option value="checklist">Checklist</option>
                <option value="incident">Incident Report</option>
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowModal(false)}
                className="text-[#6b6560] hover:text-black"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!name.trim() || isPending}
                className="bg-[#1a1a1a] hover:bg-black text-white rounded-sm px-6"
              >
                {isPending ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Write the list page**

```tsx
// app/client/templates/page.tsx
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewClientTemplateButton } from "./_components/new-client-template-button";

export const dynamic = "force-dynamic";

export default async function ClientTemplatesPage() {
  const supabase = await createClient();
  const ctx = await getClientContext();
  if (!ctx) redirect("/login");

  // Assigned: admin-owned, published. RLS already scopes this in migration 004.
  const { data: assigned } = await supabase
    .from("form_templates")
    .select("id, name, template_type, created_at")
    .eq("owner_type", "admin")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  // Mine: customer-owned for this client_id. RLS scopes this too, but we
  // add an explicit filter for clarity.
  const { data: mine } = await supabase
    .from("form_templates")
    .select(`
      id, name, template_type, is_published, created_at, parent_template_id,
      template_versions(version_number, published_at)
    `)
    .eq("owner_type", "customer")
    .eq("owner_id", ctx.client_id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[8px] tracking-[0.3em] uppercase font-bold text-[#8a857f]">
          <span>08</span>
          <span className="text-[#d8d4cc]">·</span>
          <span>Templates</span>
        </div>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <h2 className="font-serif text-[32px] text-[#1a1a1a] font-medium tracking-tight leading-[1.05]">
            Form templates.
          </h2>
          <NewClientTemplateButton />
        </div>
      </section>

      {/* Assigned */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#e5e1d8] pb-2">
          <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-[#1a1a1a]">
            01 — Assigned Templates
          </h3>
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#8a857f]">
            {assigned?.length ?? 0} available
          </span>
        </div>
        {!assigned || assigned.length === 0 ? (
          <p className="text-[#8a857f] text-sm font-mono uppercase tracking-wider py-6">
            No assigned templates yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assigned.map((t) => (
              <div key={t.id} className="bg-white border border-[#e5e1d8] rounded-sm p-5 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h4 className="font-serif text-[18px] text-[#1a1a1a] leading-tight">{t.name}</h4>
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">{t.template_type}</span>
                </div>
                <div className="flex items-center gap-2 mt-auto">
                  {/*
                    "Fill" button is a placeholder for now — the client-side
                    form-fill route is a separate task. When wired, it should
                    open a fill UI that calls forkOnFill on save when structure
                    has changed. See app/client/templates/actions.ts:forkOnFill.
                  */}
                  <button
                    disabled
                    title="Form fill UI coming soon"
                    className="rounded-sm border border-[#e5e1d8] bg-transparent text-[#8a857f] h-9 px-5 font-bold text-[9px] uppercase tracking-[0.25em] cursor-not-allowed"
                  >
                    Fill (coming soon)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mine */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#e5e1d8] pb-2">
          <h3 className="font-mono text-[10px] tracking-[0.25em] uppercase font-bold text-[#1a1a1a]">
            02 — My Templates
          </h3>
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#8a857f]">
            {mine?.length ?? 0} created
          </span>
        </div>
        {!mine || mine.length === 0 ? (
          <p className="text-[#8a857f] text-sm font-mono uppercase tracking-wider py-6">
            No templates yet — start one from the button above.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mine.map((t) => {
              const versions = (t.template_versions ?? []) as Array<{ version_number: number; published_at: string | null }>;
              const latest = versions.sort((a, b) => b.version_number - a.version_number)[0];
              return (
                <Link key={t.id} href={`/client/templates/${t.id}`}>
                  <div className="bg-white border border-[#e5e1d8] rounded-sm p-5 flex flex-col gap-4 hover:border-[#1a1a1a]/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <h4 className="font-serif text-[18px] text-[#1a1a1a] leading-tight truncate">{t.name}</h4>
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">
                          {t.template_type}
                          {t.parent_template_id && <span className="ml-2 text-[#c0a66d]">· FORKED</span>}
                        </span>
                      </div>
                      <span className={
                        t.is_published
                          ? "font-mono text-[9px] uppercase tracking-[0.25em] text-[#3b8273] bg-[#3b8273]/10 px-2 py-1 rounded-sm"
                          : "font-mono text-[9px] uppercase tracking-[0.25em] text-[#8a857f] bg-[#f5f3ee] px-2 py-1 rounded-sm"
                      }>
                        {t.is_published ? "Live" : "Draft"}
                      </span>
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f] mt-auto">
                      v{latest?.version_number ?? 1} · {new Date(t.created_at).toLocaleDateString("en-GB")}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
```

**Step 3: Run typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Smoke-test the route**

```bash
npm run dev
# Visit http://localhost:3000/client/templates as a logged-in client user
# Expect: hero + two empty-state sections, "+ New Template" button works
```

**Step 5: Commit**

```bash
git add app/client/templates/page.tsx app/client/templates/_components/new-client-template-button.tsx
git commit -m "feat: add /client/templates list with assigned + my-templates sections"
```

---

## Task 12: Create client builder edit page

Mounts the shared `TemplateBuilder` with `surface="cream"` for client-owned templates.

**Files:**
- Create: `app/client/templates/[id]/page.tsx`

**Step 1: Write the page**

```tsx
// app/client/templates/[id]/page.tsx
import { createClient } from "@/lib/supabase/server";
import { getClientContext } from "@/lib/auth-helpers";
import { notFound, redirect } from "next/navigation";
import { TemplateBuilder } from "@/components/templates/template-builder";
import type { FormSchema, FormField } from "@/lib/types/form-builder";

interface Props {
  params: Promise<{ id: string }>;
}

function normaliseSchema(raw: unknown): FormSchema {
  if (!raw || typeof raw !== "object") return { fields: [] };
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.fields)) return { fields: obj.fields as FormField[] };
  if (Array.isArray(obj.sections)) {
    const flat: FormField[] = [];
    for (const section of obj.sections as Array<{ fields?: FormField[] }>) {
      if (Array.isArray(section?.fields)) flat.push(...section.fields);
    }
    return { fields: flat };
  }
  return { fields: [] };
}

export default async function ClientTemplateBuilderPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const ctx = await getClientContext();
  if (!ctx) redirect("/login");

  const { data: template } = await supabase
    .from("form_templates")
    .select("id, name, template_type, is_published, owner_type, owner_id")
    .eq("id", id)
    .single();

  // Belt-and-braces: RLS already enforces this, but if a client somehow lands
  // on an admin template's edit URL we want a clean 404 not a render attempt.
  if (!template || template.owner_type !== "customer" || template.owner_id !== ctx.client_id) {
    notFound();
  }

  const { data: versions } = await supabase
    .from("template_versions")
    .select("id, version_number, schema_json, published_at")
    .eq("template_id", id)
    .order("version_number", { ascending: false });

  const latestVersion = versions?.[0];
  const publishedVersions = versions?.filter(v => v.published_at) ?? [];
  const latestPublished = publishedVersions[0];

  const initialSchema: FormSchema = normaliseSchema(latestVersion?.schema_json);
  const currentVersionNumber = latestVersion?.version_number ?? 1;
  const hasDraft = latestVersion && !latestVersion.published_at;

  return (
    <TemplateBuilder
      templateId={template.id}
      initialName={template.name}
      templateType={template.template_type}
      isPublished={template.is_published}
      initialSchema={initialSchema}
      versionNumber={currentVersionNumber}
      hasDraft={!!hasDraft}
      publishedVersionNumber={latestPublished?.version_number ?? null}
      surface="cream"
    />
  );
}
```

**Step 2: Wire the cream-surface save/publish actions**

`TemplateBuilder` currently imports `saveDraft` and `publishTemplate` from `@/app/admin/templates/actions`. Those write admin templates. For the cream surface, we need it to call the client variants.

Add to `Props` in `components/templates/template-builder.tsx`:

```tsx
saveAction?: (templateId: string, schema: FormSchema, name: string) => Promise<void>;
publishAction?: (templateId: string, schema: FormSchema, name: string) => Promise<void>;
```

Default to the admin actions (already imported). In the destructure:

```tsx
saveAction = saveDraft,
publishAction = publishTemplate,
```

Replace the calls in `handleSave` and `handlePublish`:

```tsx
await saveAction(templateId, schema, name);
// ...
await publishAction(templateId, schema, name);
```

Then in `app/client/templates/[id]/page.tsx`, pass them in:

```tsx
import { saveClientDraft, publishClientTemplate } from "../actions";
// ...
<TemplateBuilder
  // ...other props...
  surface="cream"
  saveAction={saveClientDraft}
  publishAction={publishClientTemplate}
/>
```

Note: server actions are passed as props from a server component to a client component — Next.js supports this for "use server" exports. The shared component just calls them.

Also update the back link and confirm copy in the toolbar to be surface-aware. The current "Publish v{n}? This version will become immutable…" `confirm()` is fine on both surfaces. The back link goes to `/admin/templates` — change to be surface-aware:

```tsx
<Link
  href={surface === "cream" ? "/client/templates" : "/admin/templates"}
  className={cn("transition-colors", t.backLink)}
>
```

**Step 3: Typecheck**

```bash
npx tsc --noEmit
```

**Step 4: Smoke-test**

```bash
npm run dev
# Create a new client template via /client/templates → +New Template flow
# Expect: redirected to /client/templates/<id>, builder renders cream-themed
# Add a field, save draft, publish — confirm success states render and "Saved" appears
# Reload page, confirm field persists
# Visit /admin/templates/<existing-admin-id>, confirm dark theme intact
```

**Step 5: Commit**

```bash
git add components/templates/template-builder.tsx app/client/templates/[id]/page.tsx
git commit -m "feat: add /client/templates/[id] cream-surface builder"
```

---

## Task 13: Add "Templates" to the client portal nav

**Files:**
- Modify: `app/client/layout.tsx:14-22`

**Step 1: Insert the nav item between Assessments and Proposals**

Before the line `{ id: "06", label: "Proposals", href: "/client/proposals" },`, insert:

```tsx
  { id: "06", label: "Templates", href: "/client/templates" },
```

And renumber the items below — Proposals becomes 07, Contracts becomes 08:

```tsx
const NAV_ITEMS = [
  { id: "01", label: "Dashboard", href: "/client" },
  { id: "02", label: "Compliance", href: "/client/compliance" },
  { id: "03", label: "Reports", href: "/client/reports" },
  { id: "04", label: "Billing", href: "/client/billing" },
  { id: "05", label: "Assessments", href: "/client/assessments" },
  { id: "06", label: "Templates", href: "/client/templates" },
  { id: "07", label: "Proposals", href: "/client/proposals" },
  { id: "08", label: "Contracts", href: "/client/contracts" },
] as const;
```

**Step 2: Smoke-test nav**

```bash
npm run dev
# Visit /client — confirm "Templates" appears between Assessments and Proposals
# Click it — lands on /client/templates with active underline
```

**Step 3: Commit**

```bash
git add app/client/layout.tsx
git commit -m "feat: add Templates entry to client portal nav"
```

---

## Task 14: Verification pass

**Step 1: Typecheck and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: zero errors. Fix anything that surfaces.

**Step 2: Run the helper unit tests**

```bash
npx vitest run lib/forms/
```

Expected: 13 tests pass (4 schema-adapter + 9 schema-diff).

**Step 3: Manual smoke checklist**

Run through these in the browser:

1. **Admin route still works.** `/admin/templates/<existing-id>` — dark theme intact, save + publish work, no console errors.
2. **Client list page.** `/client/templates` — hero, both sections render, empty states appear correctly when no data.
3. **Create a client template.** `+ New Template` → dialog → submit → lands on `/client/templates/<new-id>`.
4. **Edit a client template.** Add a field via palette click, drag to reorder, edit properties in right panel, delete a field, save draft. Confirm "Saved" status. Reload — fields persist.
5. **Publish a client template.** Click Publish → confirm dialog → confirm. Confirm `LIVE v1` badge appears.
6. **Cross-tenant RLS check.** Sign in as Client A, note the template ID. Sign in as Client B, attempt to navigate to `/client/templates/<client-A-id>` — should hit `notFound()`. (This requires two seeded client users; if not available, log the manual test as a follow-up.)
7. **Forked template badge.** Will only render when `parent_template_id` is set — not testable until forkOnFill is wired. Confirm visually by manually inserting a row with `parent_template_id` set, if convenient.

**Step 4: Commit any final cleanup**

```bash
# If any cleanup edits surfaced
git status
# git add ...
# git commit -m "chore: post-verification cleanup"
```

---

## Phase B (deferred — not part of this plan)

The following are intentionally out of scope. When the user requests the client-side fill flow:

1. **Build `/client/templates/[id]/fill`** — a fill UI that mounts the builder canvas in "fill mode" (each field gets an answer input alongside structural controls), and uses `flatToSections()` to feed `form-renderer.tsx` for the read-only path.
2. **Wire `forkOnFill`** — on save, call `forkOnFill(masterTemplateId, originalSchema, currentSchema)`; bind the resulting `versionId` to the new `form_submissions` row.
3. **Assignment surfacing** — link `form_assignments` rows to the templates list under Assigned so clients see what Matt has actually assigned, not all published masters.
4. **Renderer field-type coverage** — `form-renderer.tsx` only handles `text | textarea | dropdown | media`. Builder defines 11 types — number, date, signature, rating, multi-photo, geolocation, multi-select, repeating, checkbox all need renderers before the fill flow is real.

These are tracked as follow-ups in the audit findings (`docs/audit-2026-05-03-form-builder.md` — if/when the user asks to file it).

---

## Final commit / branch close

```bash
git log --oneline feat/client-form-builder ^main
```

Expected: ~13 commits, each scoped to one task. Ready for PR.
