// Normalization for the "Client-built forms" panel on the admin client-detail
// page. These are form_templates with owner_type='customer' and owner_id=<this
// client> — templates the client either built from scratch or forked from one of
// Matt's masters. Admin sees them read-only (RLS form_templates_admin_all already
// grants the read; the page uses the service-role adminClient).
//
// Fork lineage comes from an explicit parentNames map (parent_template_id →
// master name) built by a second query in page.tsx. We deliberately do NOT use
// the PostgREST self-referential embed form_templates!parent_template_id(name):
// verified against the live DB, PostgREST resolves that embed in the CHILDREN
// direction, so it always returned [] and the "Cloned from …" badge never named
// the master.

export interface ClientBuiltTemplate {
  id: string
  name: string
  template_type: string
  is_published: boolean
  created_at: string
  /** The master this was forked from, or null if built from scratch. */
  parent_template_id: string | null
  /** Display name of the parent master, when the lookup resolved it. */
  parentName: string | null
}

export function normalizeClientTemplateRows(
  rows: unknown[] | null | undefined,
  parentNames: Record<string, string> = {}
): ClientBuiltTemplate[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rows ?? []).map((raw: any) => {
    const parentId: string | null = raw.parent_template_id ?? null
    return {
      id: raw.id,
      name: raw.name,
      template_type: raw.template_type,
      is_published: !!raw.is_published,
      created_at: raw.created_at,
      parent_template_id: parentId,
      parentName: (parentId && parentNames[parentId]) || null,
    }
  })
}
