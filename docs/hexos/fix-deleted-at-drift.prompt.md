# Task: reconcile `deleted_at` usage with the real production schema

## What happened

A real client account (`Test Ltd`, contact `ayman@hexonasystems.com`) was created in
production and its portal Billing page rendered the load-error panel. Vercel runtime
logs give the cause:

```
[client/billing] failed to load billing data
  clientError: null
  transactionsError: {
    code: '42703',
    message: 'column hours_transactions.deleted_at does not exist'
  }
```

`supabase/migrations/001_initial_schema.sql:141` declares `deleted_at TIMESTAMPTZ` on
`hours_transactions`. Production does not have it. The repo migrations do not describe
the live schema.

`lib/supabase/database.types.ts` (generated from production) shows `deleted_at` on only
three tables: `clients`, `services`, `workflow_errors`. `001_initial_schema.sql` declares
it on ten. So the drift is probably wider than the one column that broke.

## Already done — do not redo

`app/client/billing/page.tsx` — removed `.is("deleted_at", null)` from the
`hours_transactions` query and left a comment explaining why. This change is uncommitted.
Verify it, keep it, include it in your commit.

## Step 1 — establish ground truth, do not guess

`supabase_migrations.schema_migrations` is stale and must not be trusted (see
`HANDOFF.md` §3). Inspect the live schema directly. DDL/read access is the Supabase
management token in `.env.local` as `SUPABASE_ACCESS_TOKEN`:

```
POST https://api.supabase.com/v1/projects/lksxdpgkbiuorjdvebdz/database/query
{"query": "..."}
```

Load it without printing it. Run:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public' and column_name = 'deleted_at'
order by table_name;
```

That is the authoritative list of tables that actually have the column.

## Step 2 — find every call site

Find every query that filters or selects `deleted_at`, and the table each one actually
targets. Grep is not sufficient on its own — chained Supabase builders mean a naive regex
misattributes filters to the wrong `.from()`. Confirm the table for each hit by reading
the surrounding code.

Cross-reference against Step 1. Candidates flagged by an earlier (unreliable) scan, to be
confirmed or dismissed, not trusted:

- `app/admin/assignments/actions.ts` → form_assignments
- `app/admin/clients/[id]/page.tsx` → form_assignments, form_templates, hours_transactions
- `app/admin/compliance/page.tsx` → documents
- `app/admin/directory/actions.ts` → contractors
- `app/admin/templates/actions.ts` → form_templates
- `app/client/assignments/actions.ts` → form_assignments
- `app/client/reports/actions.ts` → form_submissions
- `app/client/templates/[id]/fill/page.tsx`, `[id]/page.tsx`, `actions.ts` → form_templates
- `lib/data/contractors-server.ts` → contractors
- `lib/supabase/dashboard.ts` → documents

## Step 3 — decide per table, and say why

For each table where code filters `deleted_at` but production lacks the column, choose
one and record the reasoning in the commit message:

- **Remove the filter** if nothing in the codebase ever writes a soft-delete to that
  table. The filter is vestigial and the column is not wanted. This was the correct call
  for `hours_transactions`.
- **Add the column** via a new migration if the table genuinely has soft-delete semantics
  that something depends on — i.e. some code path sets `deleted_at`, or rows must survive
  deletion for audit. Prefer this for anything that is an audit trail or that admin
  "delete" actions are expected to reverse.

Do not add columns reflexively to make migration 001 look correct. Match the code's real
behaviour. Check whether anything writes `deleted_at` to the table before deciding.

Any new migration must follow the conventions in `supabase/migrations/`: schema-qualified,
`set search_path = ''` on any SECURITY DEFINER function, explicit REVOKE/GRANT, and applied
to production before the code that depends on it ships.

## Step 4 — stop this recurring

`001_initial_schema.sql` is now known to be fiction in at least one place. Either
reconcile it against the live schema, or add a short note at the top of the file recording
that it is historical and that `lib/supabase/database.types.ts` plus `information_schema`
are authoritative. Say which you did.

Regenerate `lib/supabase/database.types.ts` from production if any migration is applied.

## Gates

- `npm test` and `npm run build` both green before committing. Repo lint was taken to zero
  errors in `9236c46` — keep it there.
- Add a regression test asserting the billing ledger query succeeds against the real
  column set, so a reintroduced phantom column fails in CI rather than in a client's portal.
- Do not commit secrets. `.env.local` and `prod.env` are gitignored; keep it that way.

## Context worth knowing

Production has one client (`Test Ltd`, id `d2ee0708-f677-4e03-ad55-c822ab8c9217`), created
as a test and safe to query. It is otherwise empty — no templates, services, contractors,
or proposals. This bug was invisible until `6708882` made failed client-side queries render
an error panel instead of an empty list; before that, a failed billing query looked like a
client with no transactions.
