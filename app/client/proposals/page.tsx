import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { adminClient } from "@/lib/supabase/admin";
import { getClientContext } from "@/lib/auth-helpers";
import { calculateProposalTotal } from "@/lib/supabase/dashboard";
import { StatusPill, type StatusTone } from "@/components/client/status-pill";
import { ClientDataLoadError } from "@/components/client/data-load-error";

export const dynamic = "force-dynamic";

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

type Status = "Draft" | "Sent" | "Signed" | "Contract Issued";

function shortRef(uuid: string): string {
  return `PRO-${uuid.slice(0, 6).toUpperCase()}`;
}

function statusPill(status: Status): { tone: StatusTone; label: string } {
  if (status === "Signed") return { tone: "success", label: "Signed" };
  if (status === "Contract Issued") return { tone: "success", label: "Issued" };
  return { tone: "warning", label: "Awaiting Signature" };
}

export default async function ClientProposalsPage() {
  const ctx = await getClientContext();
  if (!ctx?.client_id) {
    return (
      <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        No client context found
      </div>
    );
  }

  const { data: rows, error } = await adminClient
    .from("proposals")
    .select("id, status, services_json, total_price, created_at, sent_at, proposal_pdf_path")
    .eq("client_id", ctx.client_id)
    .in("status", ["Sent", "Signed", "Contract Issued"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[client/proposals] failed to load proposals", error);
  }

  const proposals = (rows ?? []).map((p) => {
    const services = Array.isArray(p.services_json) ? p.services_json : [];
    const total =
      Number((p as { total_price?: number }).total_price) || calculateProposalTotal(p.services_json);
    const issuedAt = p.sent_at ?? p.created_at;
    // Pull a working title from the first service if available so each card
    // reads more concretely than just "Proposal".
    const firstName =
      services[0]?.service?.name ?? services[0]?.name ?? "Compliance Services";
    return {
      id: p.id as string,
      reference: shortRef(p.id as string),
      title: services.length === 1 ? firstName : "Compliance & Training Programme",
      issuedAt: new Date(issuedAt).toLocaleDateString("en-GB", DATE_FMT),
      total,
      serviceCount: services.length,
      status: (p.status as Status) || "Sent",
    };
  });

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Hero */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            06 · Proposals
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-foreground font-normal tracking-tight leading-[1.05]">
          Proposals from Matt.
        </h2>
        <p className="text-muted-foreground text-[13px] font-sans tracking-tight max-w-xl">
          Review what&apos;s been quoted and download the PDF for your records.
        </p>
      </section>

      {/* List */}
      <section className="space-y-4">
        {error ? (
          <ClientDataLoadError itemName="proposals" />
        ) : proposals.length === 0 ? (
          <div className="bg-card border border-border rounded-sm p-12 text-center">
            <p className="font-serif text-[20px] text-foreground mb-2">No proposals yet.</p>
            <p className="font-sans text-[13px] text-muted-foreground">
              When Matt sends you a proposal, it will appear here.
            </p>
          </div>
        ) : (
          proposals.map((p) => {
            const pill = statusPill(p.status);
            return (
              <Link
                key={p.id}
                href={`/client/proposals/${p.id}`}
                className="block bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-border/70 transition-all p-7 group"
              >
                <div className="flex items-start justify-between gap-6">
                  {/* Left */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-muted-foreground uppercase font-bold">
                      <span>{p.reference}</span>
                      <span className="opacity-50">·</span>
                      <span>Sent {p.issuedAt}</span>
                    </div>
                    <h3 className="font-serif text-[24px] text-foreground tracking-tight leading-tight group-hover:text-foreground">
                      {p.title}
                    </h3>
                    <p className="font-sans text-[13px] text-muted-foreground">
                      {p.serviceCount} {p.serviceCount === 1 ? "service" : "services"} · £
                      {Math.round(p.total).toLocaleString()}
                    </p>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <StatusPill tone={pill.tone} label={pill.label} />
                    <div className="flex items-center gap-1.5 text-muted-foreground group-hover:text-foreground transition-colors font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
                      Open
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
