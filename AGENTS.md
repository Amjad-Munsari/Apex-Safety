<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Architectural decisions

## Form template ownership — customers can build and fork (resolved 2026-04-17)

**Decision:** Option 3. Customers get form-building capability. Confirmed via Finley (Arbitrage partner) → Matt. Supersedes the earlier "Option 1 (Matt-only editing)" working default.

**Two use cases the form builder must support:**

- **A. Master + fork-on-fill.** Matt creates a master FRA / Site Risk template. When a customer opens it to fill in, they may add/remove/reorder fields before submitting; doing so creates a forked template owned by the customer's org and linked back via `parent_template_id`. Matt's master is never mutated.
- **B. Customer-built from scratch.** Customers with the right role open the form builder directly and create templates that belong only to their org. These have `parent_template_id = NULL`.

**Schema contract** (`form_templates`, see `supabase/migrations/003_form_template_customer_ownership.sql`):

- `owner_id UUID` — polymorphic. References `admin_users.id` when `owner_type='admin'`, `clients.id` (org, not user) when `owner_type='customer'`. No DB-level FK; the discriminator is `owner_type`.
- `owner_type TEXT CHECK IN ('admin','customer')` — distinguishes Matt's masters from customer-owned rows.
- `parent_template_id UUID NULL REFERENCES form_templates(id)` — set on forked rows, NULL on originals and customer-built-from-scratch.
- RLS scopes customers to their own templates (full CRUD) plus read on Matt's published masters.

**What's done now (verified 2026-07-24):** schema + RLS in migration 003, fork-on-fill (`app/client/assignments/actions.ts` sets `parent_template_id` when a customer edits structure during fill), and the customer "Templates" surface at `app/client/templates` with its nav entry. Form builder code MUST NOT be hardcoded to admin-only — the component is shared across surfaces.

Don't reshape the schema without re-checking with Finley.
