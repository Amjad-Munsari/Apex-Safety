import { adminClient } from "@/lib/supabase/admin"
import { isAdmin } from "@/lib/auth-helpers"
import { NextResponse } from "next/server"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  // Admin-only endpoint. There is no route middleware enforcing this for API
  // routes, and it queries cross-tenant data via the service-role client below,
  // so the isAdmin() check (server-trusted admin_users) is the sole gate.
  if (!(await isAdmin())) {
    return NextResponse.json([], { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  // Neutralize PostgREST filter metacharacters before interpolating into the
  // .or() filter string (which is grammar, not a parameterized value) — commas,
  // parens, dots and wildcards there would otherwise inject extra predicates.
  const safe = query.replace(/[,().*\\%]/g, " ").trim()
  if (safe.length < 2) {
    return NextResponse.json([])
  }
  // client_id is a uuid column — only add the equality branch for valid UUIDs.
  const proposalsFilter = UUID_RE.test(query)
    ? `proposal_pdf_path.ilike.%${safe}%,client_id.eq.${query}`
    : `proposal_pdf_path.ilike.%${safe}%`

  // Service-role client: admin RLS policies key on a JWT claim that is never set
  // (see audit H6), so the RLS-bound client returns nothing for a real admin.
  const [clientsRes, docsRes, proposalsRes] = await Promise.all([
    adminClient
      .from("clients")
      .select("id, name")
      .ilike("name", `%${safe}%`)
      .limit(5),
    adminClient
      .from("documents")
      .select("id, filename, client_id, clients(name)")
      .ilike("filename", `%${safe}%`)
      .limit(5),
    adminClient
      .from("proposals")
      .select("id, client_id, clients(name), created_at")
      .or(proposalsFilter)
      .limit(5)
  ])

  const results = [
    ...(clientsRes.data?.map(c => ({
      id: c.id,
      title: c.name,
      type: "client",
      url: `/admin/clients/${c.id}`
    })) || []),
    ...(docsRes.data?.map(d => ({
      id: d.id,
      title: d.filename,
      type: "document",
      subtitle: (d.clients as { name?: string } | null)?.name,
      url: `/admin/clients/${d.client_id}`
    })) || []),
    ...(proposalsRes.data?.map(p => ({
      id: p.id,
      title: `Proposal for ${(p.clients as { name?: string } | null)?.name}`,
      subtitle: new Date(p.created_at).toLocaleDateString('en-GB'),
      type: "proposal",
      url: `/admin/proposals`
    })) || [])
  ]

  return NextResponse.json(results)
}
