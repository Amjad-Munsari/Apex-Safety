import { adminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { NewClientButton } from "@/components/clients/new-client-dialog";
import { ClientRow } from "./_components/client-row";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const { data: clients } = await adminClient
    .from("clients")
    .select(`
      id,
      name,
      hours_balance,
      active,
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
          <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            <span className="text-teal font-semibold">02</span>
            CLIENT MANAGEMENT
          </div>
          <h2 className="font-serif text-[34px] leading-tight text-foreground">All Clients</h2>
          <p className="text-muted-foreground text-sm font-sans tracking-wide max-w-xl">
            {clients?.length || 0} active client records across all service lines.
          </p>
        </div>
        <NewClientButton />
      </div>

      {/* ─── TABLE ─── */}
      <Card className="bg-card border-border rounded-sm overflow-hidden">
        <table className="w-full text-left font-sans text-sm">
          <thead className="bg-muted">
            <tr className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
              <th className="font-normal px-6 py-4 border-b border-border">Client</th>
              <th className="font-normal px-4 py-4 border-b border-border">RAG</th>
              <th className="font-normal px-4 py-4 border-b border-border text-right">Hours</th>
              <th className="font-normal px-4 py-4 border-b border-border">Next Expiry</th>
              <th className="font-normal px-4 py-4 border-b border-border">Proposal</th>
              <th className="font-normal px-6 py-4 border-b border-border text-right">Docs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
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
                <ClientRow
                  key={client.id}
                  id={client.id}
                  name={client.name}
                  hoursBalance={client.hours_balance}
                  ragLabel={ragLabel}
                  ragColor={ragColor}
                  nextExpiryLabel={nextExpiry ? nextExpiry.date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  nextExpiryCategory={nextExpiry?.cat || "No upcoming"}
                  proposalStatus={proposalStatus ?? null}
                  docCount={(client.documents as { id: string }[] | null)?.length || 0}
                  activeCount={activeCountByClient.get(client.id) ?? 0}
                  active={(client as { active?: boolean }).active ?? true}
                />
              );
            })}
            {(!clients || clients.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-foreground/20 font-mono text-xs uppercase tracking-widest">
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
