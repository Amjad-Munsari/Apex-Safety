# 888 Form Builder — Build Prompt for Amjad

> **Spec of record for Phases 13–18 (Form Builder Module).** Captured 2026-05-20 from Finley/Amjad build prompt.
> The build prompt's internal "Phase 1–6" map to roadmap phases as follows:
> | Build prompt | Roadmap phase |
> |---|---|
> | Phase 1 — Foundation | **Phase 13** Form Builder Foundation |
> | Phase 2 — Custom Field Types | **Phase 14** Custom Field Types |
> | Phase 3 — Conditional Logic Engine | **Phase 15** Conditional Logic Engine |
> | Phase 4 — Multi-Tenancy + Fork-on-Fill | **Phase 16** Multi-Tenancy + Fork-on-Fill |
> | Phase 5 — Assignment Scheduling + Notifications | **Phase 17** Assignment Scheduling + Notifications |
> | Phase 6 — FRA Seed Template | **Phase 18** FRA Seed Template |
>
> NOTE: the DB-schema block below is the build prompt's draft. The live schema contract is
> `supabase/migrations/003_form_template_customer_ownership.sql` (`owner_id` polymorphic,
> `owner_type` discriminator, `parent_template_id` for forks) — see AGENTS.md. Reconcile at plan-phase.

---

**Module:** Deliverable 11 — Drag-Drop Form Builder
**Library:** @coltorapps/builder + @coltorapps/builder-react
**Dependencies:** dnd-kit, react-signature-canvas, browser Geolocation API, Supabase Storage
**Stack:** Next.js 14 (App Router), Supabase, Vercel, TypeScript
**Existing repo:** 888 Safety Platform (fire-safety-platform on Vercel)

---

## Context

The form builder is the critical-path blocker for the entire platform. Module 1 (Fire Risk Assessment + AI Reports) is just a template rendered on top of this form builder. Nothing else ships until this works.

Two confirmed use cases (Finley voice note 4/17):
- **Use Case A:** Matt (admin) builds a master template, assigns to client. Client fills as-is OR forks it first to customise.
- **Use Case B:** Client builds their own templates from scratch — they have in-house H&S teams.

The form builder is multi-tenant. Clients get the full builder, identical to admin.

---

## What coltorapps gives us (DO NOT rebuild)

- Schema shape: `{ entities: {...}, root: [...] }` — JSON structure for any form
- Attribute system: reusable field properties (label, required, maxLength, placeholder, etc.)
- Entity system: field types with attached attributes
- Builder store: client-side state for add/delete/reorder entities, edit attributes
- Interpreter store: client-side state for filling a built form (collects values, validates on submit)
- Full-stack validation: `validateSchema` + `validateEntitiesValues` runs server-side too

Install: `npm install @coltorapps/builder @coltorapps/builder-react`

---

## Phase 1 — Foundation (5-7 days)  → roadmap Phase 13

**Goal:** Coltorapps integrated, basic field types working, schema saves to Supabase, form can be filled and submitted.

### 1a. Database tables

Create these tables in Supabase with RLS:

```sql
-- Form templates
CREATE TABLE form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('admin', 'client')),
  parent_template_id UUID REFERENCES form_templates(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Template versions (immutable once created)
CREATE TABLE template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  schema_json JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, version_number)
);

-- Form assignments
CREATE TABLE form_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES form_templates(id),
  version_id UUID NOT NULL REFERENCES template_versions(id),
  assigned_to UUID NOT NULL REFERENCES auth.users(id),  -- the client user receiving the assignment
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  due_date DATE,
  recurrence_rule TEXT CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),
  last_reminder_sent TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Form submissions
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES form_assignments(id),
  template_id UUID NOT NULL REFERENCES form_templates(id),
  version_id UUID NOT NULL REFERENCES template_versions(id),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  values_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**RLS policies:**
- `form_templates`: Admin sees all. Client sees templates where `owner_id = auth.uid()` OR templates assigned to them via `form_assignments`.
- `template_versions`: Same visibility as parent template.
- `form_assignments`: Admin sees all. Client sees assignments where `assigned_to = auth.uid()`.
- `form_submissions`: Admin sees all. Client sees submissions where `submitted_by = auth.uid()`.

### 1b. Coltorapps builder definition

Define the builder with these initial entities:

```typescript
import { createBuilder } from "@coltorapps/builder";

export const formBuilder = createBuilder({
  entities: [
    textField,
    numberField,
    dateField,
    selectField,
    textareaField,
    checkboxField,
    sectionGroup,
  ],
});
```

**Entity definitions (Phase 1 — basic types):**

| Entity | Attributes |
|--------|-----------|
| `textField` | label (string, required), required (boolean), placeholder (string), maxLength (number), helpText (string), prefillSource (string, optional — one of: 'currentUserName', 'currentDate', 'none'. When set, the field auto-populates on form load but remains editable) |
| `numberField` | label (string, required), required (boolean), min (number), max (number), unit (string) |
| `dateField` | label (string, required), required (boolean), minDate (string), maxDate (string), prefillSource (string, optional — 'currentDate' or 'none') |
| `selectField` | label (string, required), required (boolean), options (array of {value, label}), allowMultiple (boolean) |
| `textareaField` | label (string, required), required (boolean), placeholder (string), maxLength (number) |
| `checkboxField` | label (string, required), required (boolean), defaultChecked (boolean) |
| `sectionGroup` | title (string, required), description (string) — container entity, holds children |

### 1c. Builder UI (admin side)

Location: `/admin/form-builder/[templateId]`

Three-panel layout:
1. **Field palette (left sidebar):** List of available entity types. Each is draggable via dnd-kit.
2. **Canvas (centre):** Renders current form layout. Drop zones between fields (dnd-kit droppable areas). Click a field to select it.
3. **Properties panel (right sidebar):** Shows attributes for the selected field. Edit label, required, placeholder, etc. Changes write to the coltorapps builder store immediately.

**Drag-and-drop via dnd-kit:**
- Dragging from palette → creates new entity in builder store at drop position
- Dragging within canvas → reorders (calls builder store reorder)
- Dragging into/out of sectionGroup → reparent
- Use `@dnd-kit/core` + `@dnd-kit/sortable` for the sortable list within canvas

**Save flow:**
1. "Save Draft" button → serialise builder store to JSON → POST `/api/form-templates/[id]/versions`
2. Server writes new row to `template_versions` with `version_number = max(existing) + 1`
3. Previous versions are never mutated

**Publish flow:**
1. "Publish" button → sets `template_versions.published_at = now()` on latest version
2. Sets `form_templates.status = 'published'`
3. Future assignments use this published version

**Preview mode:**
- Toggle button switches canvas from builder mode to interpreter mode (fill mode)
- Uses coltorapps interpreter store to render the form as a user would see it
- No data saved in preview — just visual testing

### 1d. Form renderer (interpreter)

Location: `/portal/forms/[assignmentId]` (client side) and preview in builder

- Reads `template_versions.schema_json` → initialises coltorapps interpreter store
- Each entity type maps to a React component (same components used in builder preview and client fill)
- Submit button: interpreter store collects all values → client-side validation via coltorapps `validateEntitiesValues` → POST `/api/form-submissions`
- Server-side: `validateSchema` + `validateEntitiesValues` before writing to DB
- Submission row stores `version_id` — the exact version the form was filled against

**Critical rule:** A submission is ALWAYS rendered against its pinned `version_id` schema, never the current/latest version. When viewing a historical submission, fetch the schema from `template_versions` by `version_id` and render with that.

### Phase 1 done criteria

- [ ] Admin can create a new form template with all 7 basic entity types
- [ ] Drag-and-drop reordering works (within canvas, into/out of sections)
- [ ] Form saves to Supabase with version 1
- [ ] Editing and re-saving creates version 2 (version 1 is preserved, not mutated)
- [ ] A test user can fill and submit the form via the renderer
- [ ] Submission stored with correct version_id pin
- [ ] Historical submission renders against its original schema, not the current one
- [ ] Builder store ↔ JSON serialisation round-trips cleanly (save → reload → identical state)

---

## Phase 2 — Custom Field Types (4-5 days)  → roadmap Phase 14

**Goal:** All 6 specialty field types working in both builder and renderer.

### 2a. Signature pad

- **Entity:** `signatureField`
- **Attributes:** label (required), required (boolean)
- **Builder component:** Static preview image / placeholder
- **Renderer component:** `react-signature-canvas` — draw signature with finger/stylus
- **Storage:** On submit, export canvas as base64 PNG → upload to Supabase Storage bucket `form-signatures/` → store the public URL in submission values_json
- **Clear button** to reset and re-sign

### 2b. Rating scale

- **Entity:** `ratingField`
- **Attributes:** label (required), required (boolean), minValue (number, default 1), maxValue (number, default 5), stepLabels (array of strings — one per point on the scale)
- **Builder component:** Shows scale preview with configured range
- **Renderer component:** Horizontal row of clickable circles/buttons, label text below each point. Selected point highlighted. Mobile-friendly tap targets (min 44px).

### 2c. Multi-photo upload

- **Entity:** `photoField`
- **Attributes:** label (required), required (boolean), maxPhotos (number, default 5), captionRequired (boolean)
- **Builder component:** Shows photo upload placeholder with configured maxPhotos
- **Renderer component:**
  - Camera capture button (uses `<input type="file" accept="image/*" capture="environment">` for mobile camera)
  - File picker fallback for desktop
  - Thumbnail grid of uploaded photos
  - Optional caption text input per photo (if captionRequired = true)
  - Delete button per photo
- **Storage:** Compress images client-side to 1.2-1.5MB target (use canvas resize, NOT 800KB — inspection label legibility matters). Upload to Supabase Storage bucket `form-photos/`. Store array of `{ url, caption }` in submission values.

**Per-field photo attachment (Matt's requirement):** Every field can optionally have photos attached, not just a dedicated photo field. Add a universal `attachPhotos` boolean attribute to ALL entity types. When true, a small camera icon appears next to the field in the renderer, allowing 1-3 contextual photos per field. These are stored separately in the submission values under `_attachments: { [entityId]: [{ url, caption }] }`.

### 2d. Geolocation

- **Entity:** `geolocationField`
- **Attributes:** label (required), required (boolean), autoCapture (boolean — grab location on form load vs manual button press)
- **Builder component:** Shows map pin icon placeholder
- **Renderer component:**
  - If `autoCapture = true`: request geolocation on form load, display result
  - If `autoCapture = false`: "Capture Location" button → browser Geolocation API
  - Display: lat/lng coordinates + accuracy in metres + timestamp
  - Error handling: permission denied, position unavailable, timeout → show message, allow retry
- **Storage:** `{ lat: number, lng: number, accuracy: number, timestamp: string }` in submission values

### 2e. Repeating sections

- **Entity:** `repeatingSectionGroup`
- **Attributes:** title (required), minRepeats (number, default 1), maxRepeats (number, default 10)
- **Builder component:** Container (like sectionGroup) — drag child entities into it to define the repeatable group
- **Renderer component:**
  - Renders child entities as a group
  - "Add another" button (disabled when maxRepeats reached)
  - Delete button per repeat instance (disabled when minRepeats would be violated)
  - Each instance gets a numbered header ("Item 1", "Item 2", etc.)
- **Storage:** Array of objects in submission values, each object contains values for one repeat instance

### 2f. Computed/display field

- **Entity:** `computedField`
- **Attributes:** label (required), formula (string — one of: 'riskMatrix'), sourceFields (array of entity IDs — the fields this computation reads from), displayFormat (string — how to render the result)
- **Builder component:** Shows "Computed: [formula name]" with dropdowns to pick source fields
- **Renderer component:** Read-only display that updates reactively when source field values change
- **Initial formula: `riskMatrix`** — takes two source fields (hazard level select + consequences select) and outputs the PAS 79 risk level (Trivial/Tolerable/Moderate/Substantial/Intolerable) based on the matrix. Render with colour coding matching the FRA standard (green = Trivial, yellow = Tolerable, orange = Moderate, red = Substantial, dark red = Intolerable).
- **Storage:** The computed result is stored in submission values_json alongside user-entered values (for historical accuracy if the formula ever changes).
- **Not editable by the form filler** — output only.

### 2g. Speech-to-text

- **Not an entity type** — a capability on `textField` and `textareaField`
- Add a `speechToText` boolean attribute to textField and textareaField (default true)
- **Renderer component:** Mic button icon next to every text/textarea input where `speechToText = true`
  - Uses Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`)
  - **Append mode:** speaking adds to existing text, does not replace
  - Visual indicator: mic button turns red/pulsing when recording
  - Stop button to end recording
  - Fallback: if Web Speech API unavailable, hide the mic button (graceful degradation)

### Phase 2 done criteria

- [ ] All 6 custom field types appear in the field palette and can be dragged into a form
- [ ] Each can be configured via properties panel, saved, and rendered in the interpreter
- [ ] Signature captures and stores as PNG to Supabase Storage
- [ ] Photos compress to 1.2-1.5MB and upload to Supabase Storage
- [ ] Per-field photo attachment works via the `attachPhotos` attribute on any field
- [ ] Geolocation captures lat/lng on mobile browser
- [ ] Repeating sections allow add/remove instances within min/max bounds
- [ ] Speech-to-text works on text fields (tested in Chrome and Safari)
- [ ] Computed field displays the correct risk level from the PAS 79 matrix
- [ ] All custom types round-trip through save/load correctly

---

## Phase 3 — Conditional Logic Engine (3-4 days)  → roadmap Phase 15

**Can run in parallel with Phase 2.**

**Goal:** Fields can show/hide and become required based on other field values.

### 3a. Data model

Add a `visibilityRules` attribute to EVERY entity type. Structure:

```typescript
interface VisibilityRule {
  sourceEntityId: string;          // ID of the field whose value is checked
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  value: string | number | boolean; // The value to compare against
  action: 'show' | 'hide' | 'require'; // What happens when rule is true
}

interface VisibilityRules {
  rules: VisibilityRule[];
  logic: 'and' | 'or';            // How multiple rules combine
}
```

This is stored as a JSON attribute on each entity in the coltorapps schema.

### 3b. Builder UI for conditions

In the properties panel, below the standard attributes:

1. "Add condition" button
2. Each condition row: "When [field dropdown] [operator dropdown] [value input] → [action dropdown] this field"
3. Field dropdown: populated from all other entities in the current form (show label + entity type icon)
4. Operator dropdown: changes based on source field type:
   - Text fields → equals, notEquals, contains, isEmpty, isNotEmpty
   - Number fields → equals, notEquals, greaterThan, lessThan, isEmpty, isNotEmpty
   - Select fields → equals, notEquals, isEmpty, isNotEmpty
   - Checkbox → equals (true/false)
   - Date → equals, greaterThan, lessThan, isEmpty, isNotEmpty
5. Multiple rules with AND/OR toggle at the top
6. Delete button per rule row

### 3c. Runtime evaluation in interpreter

- Subscribe to the interpreter store's value changes
- On any value change, re-evaluate visibility rules for all entities that reference the changed entity as a source
- **Hidden fields:** Not rendered in the DOM, not validated, not included in submission values_json
- **Required-if (action = 'require'):** Field's `required` attribute is dynamically set to true only when the condition is met. When condition is not met, field is optional regardless of its static `required` attribute.
- **Performance:** Only recompute rules that reference the changed field (maintain a dependency map: `sourceEntityId → [dependent entity IDs]`)
- **Circular dependency prevention:** At save time, validate that no circular rule chains exist. Reject with error message if found.

### 3d. Conditional logic rules extracted from the FRA

These are the conditional patterns observed in Matt's Yellow Broom FRA document. The form builder engine must support all of these:

| Trigger field | Condition | Effect |
|--------------|-----------|--------|
| "Is a Safety of Sports Certificate in force?" (select: Yes/No) | equals "Yes" | Show "Certificate details" text field |
| "Is the premises subject to an Alterations Notice?" (select: Yes/No) | equals "Yes" | Show "Alterations Notice details" text field |
| "Is a Licence or Registration in force?" (select: Yes/No) | equals "Yes" | Show "Licence details" text field |
| "Fire loss experience" (select: Yes/No) | equals "Yes" | Show "Date", "Brief Details", "Cause", "Action Taken" fields |
| "Is a DSEAR assessment required?" (select: Yes/No) | equals "Yes" | Show DSEAR assessment sub-section |
| "Is the use of portable heaters avoided?" (select: Yes/No) | equals "No" | Show "hazardous type avoided?", "measures to minimise hazard?", "fixed heating maintenance?" fields |
| "Are reasonable measures taken to prevent fires from cooking?" (select: Yes/N/A) | notEquals "N/A" | Show cooking sub-questions (filters, extinguishers) |
| "Does the building have a lightning protection system?" (select: Yes/No) | equals "Yes" | Show lightning protection maintenance questions |
| "Does the building have other significant ignition sources?" (select: Yes/No) | equals "Yes" | Show detail comment fields |
| "Does the building have other significant Fire Hazards?" (select: Yes/No) | equals "Yes" | Show detail comment fields |
| Each assessment section overall compliance (colour-coded) | Based on answers | Auto-calculate section risk level |
| Fire hazard level (Low/Medium/High) + Consequences (Slight/Moderate/Extreme) | Matrix lookup | Auto-calculate overall risk level (Trivial through Intolerable) |

**Note on N/A and "Some" handling:** Many FRA fields support four states: Yes / No / N/A / Some. Use a selectField with all applicable options. The conditional engine treats each as a distinct value. "Some" means partial compliance — it should be treated the same as "Yes" for conditional show/hide purposes (i.e., sub-questions still appear). "N/A" means the question doesn't apply and should hide dependent sub-questions.

**Note on the risk matrix:** The final risk rating is calculated from two select fields: hazard level (Low/Medium/High) and consequences (Slight harm/Moderate harm/Extreme harm). The matrix lookup is:

| | Slight Harm | Moderate Harm | Extreme Harm |
|---|---|---|---|
| **Low** | Trivial | Tolerable | Moderate |
| **Medium** | Tolerable | Moderate | Substantial |
| **High** | Moderate | Substantial | Intolerable |

This can be implemented as a read-only computed field that evaluates based on the two source fields. For Phase 3, a custom `computedField` entity type may be needed, OR this can be handled as a display-only conditional that shows the appropriate risk level text based on the two inputs.

### Phase 3 done criteria

- [ ] Admin can add visibility rules to any field via the builder UI
- [ ] Rules evaluate correctly at fill-time (show/hide/require)
- [ ] Hidden fields excluded from validation and submission data
- [ ] Multiple rules with AND/OR logic work correctly
- [ ] Nested conditions (field in section controlled by field outside section) work
- [ ] Conditional logic persists through save/load cycle (stored in schema JSON)
- [ ] Circular dependency detection at save time
- [ ] N/A as a distinct select option works in conditions

---

## Phase 4 — Multi-Tenancy + Fork-on-Fill (4-5 days)  → roadmap Phase 16

**Goal:** Both use cases live — admin assigns templates to clients, clients can fork or build their own.

### 4a. Template assignment flow (Use Case A)

1. Admin creates a template, publishes it (Phase 1 flow)
2. Admin navigates to "Assign Template" → selects a client org → sets optional due date → saves
3. This creates a row in `form_assignments` with `status = 'pending'`
4. Assignment appears in client portal under "Forms Assigned to You" (new page: `/portal/assignments`)
5. Client clicks assignment → interpreter renders the form → client fills → submits
6. Submission written to `form_submissions` with `assignment_id` link
7. Assignment status updates to `completed`
8. Admin sees submission in admin panel under that client's detail view

### 4b. Fork-on-fill mechanism

When a client opens an assigned template, they see two buttons:
- **"Fill as-is"** → goes directly to interpreter/renderer
- **"Customise first"** → creates a fork:
  1. Creates a new `form_templates` row with `owner_id = client_user_id`, `owner_type = 'client'`, `parent_template_id = original_template_id`
  2. Copies the current published `schema_json` into a new `template_versions` row under the forked template
  3. Opens the builder UI with the copied schema loaded
  4. Client edits freely — this is now their own template, fully independent
  5. Client publishes their fork → can then fill it
  6. Master template updates do NOT cascade to forks — this is intentional

### 4c. Client-built templates (Use Case B)

- Client portal gets a "My Templates" section (`/portal/templates`)
- "Create New Template" button opens the builder UI (same components as admin, same field palette)
- Templates created by clients: `owner_type = 'client'`, `owner_id = client_user_id`
- Client can only assign their own templates within their org (if they have sub-users — future consideration)
- Admin can VIEW client-created templates but does not own them and cannot edit them

### 4d. Role gating

| Capability | Admin | Client |
|-----------|-------|--------|
| Create templates | Yes | Yes |
| Edit own templates | Yes | Yes |
| Edit others' templates | Yes (all) | No |
| View all templates | Yes | Own + assigned only |
| Full field palette | Yes | Yes (confirmed: full builder) |
| Assign templates | To any client | Within own org only (future) |
| View all submissions | Yes | Own org's only |
| Delete templates | Own only | Own only |

### Phase 4 done criteria

- [ ] Admin can assign a published template to a client with optional due date
- [ ] Client sees assigned forms in their portal under "Forms Assigned to You"
- [ ] Client can fill and submit assigned forms
- [ ] Client can fork an assigned template before filling
- [ ] Forked template is owned by client, independent of master (no cascade)
- [ ] Client can create templates from scratch in "My Templates"
- [ ] RLS enforced: no cross-org template or submission visibility (test with two different client accounts)
- [ ] Admin sees all templates and submissions across all clients

---

## Phase 5 — Assignment Scheduling + Notifications (2-3 days)  → roadmap Phase 17

**Goal:** Recurring form assignments with automated reminders.

### 5a. Recurrence engine

- `form_assignments.recurrence_rule` can be: daily, weekly, monthly, quarterly, annual
- **Trigger mechanism:** Vercel cron job (or n8n workflow) runs daily at midnight
- Logic: query all assignments where `recurrence_rule IS NOT NULL` and `status = 'completed'` and next occurrence date has arrived
- Next occurrence = last completion date + recurrence interval
- Creates a new `form_assignments` row with `status = 'pending'` for the same template + client
- The new assignment references the LATEST published version of the template (not the version from the original assignment)

### 5b. Due date tracking

- Status machine: `pending` → `in_progress` (when client opens the form) → `completed` (on submission) | `overdue` (due_date passed)
- Daily cron also checks for overdue: any assignment where `due_date < today` and `status IN ('pending', 'in_progress')` → update to `overdue`
- Dashboard widgets:
  - Admin: "Overdue Assignments" count + list, "Upcoming Due" for next 7 days
  - Client: "Your Overdue Forms" alert banner, "Due Soon" list

### 5c. Reminder notifications

- Use n8n webhook (same pattern as existing expiry alerts in the platform)
- Notification schedule: 7 days before due, 1 day before due, on day of overdue
- Dedup: store `last_reminder_sent` timestamp + reminder window on the assignment. Don't re-send for the same window.
- Notification channel: email to client via the existing n8n email workflow (the current email service)

### Phase 5 done criteria

- [ ] Recurring assignments auto-generate on schedule when previous is completed
- [ ] Overdue assignments flagged in both admin and client dashboards
- [ ] Cron job runs daily and processes recurrences + overdue marking
- [ ] Reminder notifications sent at 7d, 1d, and overdue
- [ ] Notifications deduped (no double-sends)

---

## Phase 6 — FRA Seed Template (2-3 days)  → roadmap Phase 18

**Goal:** Matt's actual Fire Risk Assessment form seeded as the first real template.

### 6a. FRA template structure

Build the Blank FRA (Type 3) as a form template using the builder. The structure below is extracted from the Yellow Broom FRA document. Each top-level item is a sectionGroup.

**Section 1: Header Information**
- Address of Premises (textField, required)
- Scope of the fire risk assessment (textareaField, required)
- Assessor name (textField, required, prefillSource: 'currentUserName')
- Date of original fire risk assessment (dateField)
- Date of previous fire risk assessment reviews (dateField)
- Review date (dateField)
- Suggested date of next review (dateField, required)
- Person/s consulted (textField, required)
- Designated Responsible Person — Company Name (textField, required)

**Section 2: General Information — Occupancy**
(All numberFields unless noted)
- Full-time employees
- Part-time employees
- Clients/Residents/Students/Pupils
- Approximate max employees at any one time
- Max public/visitors/contractors (textField — includes notes)
- Physically/Mentally/Visually Handicapped
- Persons with Hearing Impairments
- Vulnerable Persons
- Young Persons
- Foreign National Employees
- Sleeping occupants
- Occupants in remote areas / lone workers
- Others (textField)

**Section 3: General Information — The Building**
- Number of floors (numberField)
- Approximate area (textField — includes unit like "sqm")
- Details of construction (textareaField)
- Use of premises (textField)
- Occupancy type (selectField: Residential / Commercial / Industrial / Mixed)
- Enforcing fire authority (textField)
- Relevant fire safety legislation (textareaField)
- Any other relevant legislation (textareaField)

**Section 4: Regulatory Yes/No Questions**
Each is a selectField with Yes/No options. Some have conditional detail fields:
- Is a Safety of Sports Certificate in force? → if Yes, show details field
- Is the premises subject to an Alterations Notice? → if Yes, show details field
- Is a Licence or Registration in force? → if Yes, show details field
- Does this organisation employ 5 or more persons?
- Fire loss experience? → if Yes, show Date (dateField), Brief Details (textareaField), Cause (textField), Action Taken (textareaField)
- Is a DSEAR assessment required?

**Section 5: Emergency Services**
- Risks to emergency services personnel (textareaField, required)
- Other relevant/additional information (textareaField)

**Section 6: Emergency Access**
- Best access description (textareaField, required)

**Section 7: General Description of Premises**
- Description (textareaField, required)

**Sections 8-26: Assessment Categories (19 sections)**

Each assessment section follows a repeating pattern. Build as a sectionGroup containing:
- Section header question (static text / label)
- Multiple Yes/No/N/A/Some sub-questions (selectField with options: Yes, No, N/A, Some)
- "Comments and hazards observed" (textareaField with speechToText enabled)
- "Fire safety provisions available" (textareaField with speechToText enabled)
- "Additional control measures required" (textareaField with speechToText enabled)
- Per-field photo attachment enabled on all text fields

The 19 assessment sections:
1. Electrical Sources of Ignition
2. Smoking
3. Arson
4. Portable Heaters and Heating Installations (conditional sub-questions when heaters ARE used)
5. Cooking (conditional — N/A if no cooking on site)
6. Lightning
7. Other Significant Ignition Sources & Fire Hazards
8. Housekeeping
9. Hazards from Outside Contractors
10. Dangerous Substances
11. Means of Escape from Fire
12. Measures to Limit Fire Spread and Development
13. Fire Doors
14. Emergency Escape Lighting
15. Fire Safety Signs and Notices
16. Means of Giving Warning in Case of Fire
17. Manual Fire Extinguishing Appliances
18. Automatic Fire Extinguishing Systems
19. Other Fixed Systems and Equipment

**Section 22: Management of Fire Safety**
Sub-sections (same Yes/No/N/A pattern):
1. Procedures and Arrangements
2. Training and Drills (includes detailed sub-questions about training content)
3. Testing and Maintenance (includes per-system testing schedules)
4. Records

**Section 23: Fire Risk Assessment Rating**
- Fire hazard (probability of ignition): selectField (Low / Medium / High)
- Consequences for life safety: selectField (Slight harm / Moderate harm / Extreme harm)
- Calculated risk level: computed display field using the PAS 79 matrix (Trivial / Tolerable / Moderate / Substantial / Intolerable)
- Recommended risk level to maintain: selectField (Trivial / Tolerable)

**Section 24: Significant Findings Action Plan**
- repeatingSectionGroup containing:
  - Category (selectField — list of all assessment section names)
  - Action required (textareaField)
  - Priority (selectField: 1 — Immediate / 2 — Within 3 months / 3 — Within 6 months / Recommendation Only)
  - Action completed by / date (textField)

### 6b. Site Risk Assessment template

**BLOCKED** — Matt has not provided the blank site risk template yet. Skip this. Same infrastructure as FRA, different schema. Can be built in < 1 day once the template arrives.

### 6c. Module 1 bridge (not Amjad's scope, but must be wired)

Form submission must emit a webhook event or write to a queue that the n8n workflow can pick up for AI report generation. At minimum:
- On submission with `status = 'submitted'`, fire a Supabase database webhook to an n8n endpoint
- Include: submission_id, template_id, version_id, submitted_by in the webhook payload
- The n8n workflow (Ayman's scope) will fetch the full submission data and generate the PDF report

### Phase 6 done criteria

- [ ] FRA template built using the form builder (all sections match the Blank FRA document)
- [ ] Template is seeded and assignable to clients
- [ ] Conditional sections work within the FRA (Yes/No → show/hide sub-fields)
- [ ] Per-field photo attachment works on all FRA text fields
- [ ] Speech-to-text enabled on all FRA text/textarea fields
- [ ] Risk matrix auto-calculates from the two input fields
- [ ] Action Plan uses repeating sections correctly
- [ ] Submission creates a record with webhook for the n8n report pipeline

---

## Estimated Timeline

| Phase (build prompt) | Roadmap phase | Days | Dependencies | Can parallelise? |
|-------|------|------|-------------|-----------------|
| 1. Foundation | 13 | 5-7 | None | No — everything depends on this |
| 2. Custom fields | 14 | 4-5 | Phase 13 complete | Yes — parallel with Phase 15 |
| 3. Conditional logic | 15 | 3-4 | Phase 13 complete | Yes — parallel with Phase 14 |
| 4. Multi-tenancy + fork | 16 | 4-5 | Phase 13 complete | After 13, parallel with 14+15 |
| 5. Scheduling + notifications | 17 | 2-3 | Phase 16 complete | After Phase 16 |
| 6. FRA seed template | 18 | 2-3 | Phases 14 + 15 complete | After custom fields + conditions |
| **Total** | | **20-27 days** | | **14+15+16 can overlap → ~4-5 weeks** |

---

## Technical notes

- **Do not use SurveyJS or any paid form library.** We chose coltorapps specifically because it's headless (zero UI opinions) and slots into the existing 888 dark-themed design.
- **Schema versioning is non-negotiable from day one.** Every save = new version. Every submission pinned to the version it was filled against. Never mutate a published version.
- **Mobile-first.** Matt's assessors fill forms on mobile (phones and tablets) on site. Every field component must work well on touch screens with minimum 44px tap targets.
- **Supabase Storage buckets:** Create `form-signatures` and `form-photos` buckets with appropriate RLS (scoped to the submitting user's org).
- **Image compression target: 1.2-1.5MB.** NOT 800KB. Inspection labels on equipment must remain legible in photos.
- **Offline/PWA is deferred.** Not in this build. May be added as a future phase.
