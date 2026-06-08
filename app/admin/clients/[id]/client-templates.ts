// Normalization for the "Client-built forms" panel on the admin client-detail
// page. These are form_templates with owner_type='customer' and owner_id=<this
// client> — templates the client either built from scratch or forked from one of
// Matt's masters. Admin sees them read-only (RLS form_templates_admin_all already
// grants the read; the page uses the service-role adminClient).
//
// Supabase can return the self-referential `parent:form_templates!parent_template_id(name)`
// embed as an ARRAY or an OBJECT depending on how it infers the relationship —
// the same footgun handled for the assignment/assessment joins in page.tsx.
// Normalize to a flat, render-safe shape so the panel can't blow up.

export interface ClientBuiltTemplate {
  id: string
  name: string
  template_type: string
  is_published: boolean
  created_at: string
  /** The master this was forked from, or null if built from scratch. */
  parent_template_id: string | null
  /** Display name of the parent master, when the join resolved it. */
  parentName: string | null
}

export function normalizeClientTemplateRows(
  rows: unknown[] | null | undefined
): ClientBuiltTemplate[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((raw: any) => {
    const parent = Array.isArray(raw.parent)
      ? raw.parent[0] ?? null
      : raw.parent ?? null
    return {
      id: raw.id,
      name: raw.name,
      template_type: raw.template_type,
      is_published: !!raw.is_published,
      created_at: raw.created_at,
      parent_template_id: raw.parent_template_id ?? null,
      parentName: parent?.name ?? null,
    }
  })
}
