import { adminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewClientButton } from "@/components/clients/new-client-dialog";
import { ActivePill } from "./_components/active-pill";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { data: clients } = await adminClient
    .from("clients")
    .select(`
      id,
      name,
      hours_balance,
      documents (
        id,
        expiry_date,
        document_category
      ),
      proposals (
        id,
        status
      )
    `)
    .order("name", { ascending: true });

  // Aggregate active assignment count per client (single query, no N+1).
  // Active = pending or in_progress, not soft-deleted (T-16-08).
  const { data: activeRows } = await adminClient
    .from("form_assignments")
    .select("client_id")
    .in("status", ["pending", "in_progress"])
    .is("deleted_at", null);

  const activeCountByClient = new Map<string, number>();
  for (const r of activeRows ?? []) {
    activeCountByClient.set(r.client_id, (activeCountByClient.get(r.client_id) ?? 0) + 1);
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <Link href="/admin" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono text-xs uppercase tracking-widest">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#666] uppercase">
            <span className="text-white font-semibold">01</span>
            CLIENT MANAGEMENT
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-white">All Clients</h2>
          <p className="text-[#666] text-sm font-sans tracking-wide max-w-xl">
            {clients?.length || 0} active client records across all service lines.
          </p>
        </div>
        <NewClientButton />
      </div>

      {/* ─── TABLE ─── */}
      <Card className="bg-[#1c1c1c] border-white/5 rounded-sm overflow-hidden">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-[#151515]">
            <tr className="text-[10px] font-mono tracking-widest uppercase text-[#555]">
              <th className="font-normal px-6 py-4 border-b border-white/5">Client</th>
              <th className="font-normal px-4 py-4 border-b border-white/5">RAG</th>
              <th className="font-normal px-4 py-4 border-b border-white/5 text-right">Hours</th>
              <th className="font-normal px-4 py-4 border-b border-white/5">Next Expiry</th>
              <th className="font-normal px-4 py-4 border-b border-white/5">Proposal</th>
              <th className="font-normal px-6 py-4 border-b border-white/5 text-right">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {clients?.map((client) => {
              type DocRow = { expiry_date: string | null; document_category: string | null };
              type ProposalRow = { status: string | null };
              const expiries = (client.documents as DocRow[] | null)
                ?.map((d) => ({ date: new Date(d.expiry_date ?? ""), cat: d.document_category }))
                .filter((d) => !isNaN(d.date.getTime()))
                .sort((a, b) => a.date.getTime() - b.date.getTime());

              const nextExpiry = expiries?.[0];
              const proposalStatus = (client.proposals as ProposalRow[] | null)?.[0]?.status;
              const daysUntil = nextExpiry
                ? Math.ceil((nextExpiry.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null;

              let ragLabel = "Current";
              let ragColor = "success";

              if (nextExpiry) {
                if (daysUntil !== null) {
                  if (daysUntil < 0) { ragLabel = "Expired"; ragColor = "danger"; }
                  else if (daysUntil < 30) { ragLabel = "Expiring"; ragColor = "gold"; }
                }
              } else {
                ragLabel = "No Docs";
                ragColor = "[#555]";
              }

              return (
                <tr key={client.id} className="group hover:bg-white/[0.02] transition-colors cursor-pointer relative">
                  <td className="px-6 py-4">
                    <Link href={`/admin/clients/${client.id}`} className="absolute inset-0 z-0" />
                    <div className="flex items-start gap-4 relative z-10 pointer-events-none">
                      <span className="font-mono text-[10px] text-[#555] mt-1 w-10">CL-<br />{client.id.slice(0, 4).toUpperCase()}</span>
                      <div>
                        <div className="font-medium text-white mb-0.5 flex items-center">
                          {client.name}
                          <ActivePill count={activeCountByClient.get(client.id) ?? 0} />
                        </div>
                        <div className="text-xs text-white/40">Client Record</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 border border-${ragColor}/40 rounded text-${ragColor} text-[10px] font-mono uppercase tracking-wider bg-${ragColor}/5 leading-none`}>
                      <div className={`w-1.5 h-1.5 rounded-full bg-${ragColor}`} /> {ragLabel}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-white/70 text-right">{client.hours_balance}h</td>
                  <td className="px-4 py-4">
                    <div className="text-white text-sm mb-0.5">
                      {nextExpiry ? nextExpiry.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </div>
                    <div className="text-xs text-[#666]">{nextExpiry?.cat || "No upcoming"}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className={`inline-flex px-2.5 py-1 border border-${proposalStatus ? (proposalStatus === "Signed" ? "[#3b8273]" : "gold") : "white"}/40 text-${proposalStatus ? (proposalStatus === "Signed" ? "[#3b8273]" : "gold") : "white"}/60 text-[10px] font-mono uppercase tracking-wider rounded leading-none`}>
                      {proposalStatus || "None"}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-right text-white/50">
                    {(client.documents as { id: string }[] | null)?.length || 0} <span className="ml-2 text-white/20">&gt;</span>
                  </td>
                </tr>
              );
            })}
            {(!clients || clients.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-white/20 font-mono text-xs uppercase tracking-widest">
                  No clients found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
