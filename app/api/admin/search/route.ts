import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  const supabase = await createClient()

  // Parallel searches across clients, documents, and proposals
  const [clientsRes, docsRes, proposalsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name")
      .ilike("name", `%${query}%`)
      .limit(5),
    supabase
      .from("documents")
      .select("id, filename, client_id, clients(name)")
      .ilike("filename", `%${query}%`)
      .limit(5),
    supabase
      .from("proposals")
      .select("id, client_id, clients(name), created_at")
      .or(`proposal_pdf_path.ilike.%${query}%,client_id.eq.${query}`)
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
