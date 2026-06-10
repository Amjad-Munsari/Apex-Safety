import Link from "next/link";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { adminClient } from "@/lib/supabase/admin";
import { getClientContext } from "@/lib/auth-helpers";
import { markProposalViewed } from "@/app/admin/proposals/actions";
import { calculateProposalTotal } from "@/lib/supabase/dashboard";
import { AcceptSignButton } from "./accept-sign-button";

export const dynamic = "force-dynamic";

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export default async function ClientProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getClientContext();
  if (!ctx?.client_id) {
    return (
      <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-[#8a857f]">
        No client context found
      </div>
    );
  }

  // Constrain by client_id so a client can't view another org's proposal even
  // if they have the UUID. The admin client bypasses RLS so this is the only
  // ownership check.
  const { data: proposal } = await adminClient
    .from("proposals")
    .select(
      "id, status, services_json, total_price, created_at, sent_at, proposal_pdf_path"
    )
    .eq("id", id)
    .eq("client_id", ctx.client_id)
    // Only surface proposals that have actually been sent to the client — a
    // guessed id must not expose an internal Draft (matches the list page).
    .in("status", ["Sent", "Signed", "Contract Issued"])
    .maybeSingle();

  if (!proposal) {
    return (
      <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-[#8a857f]">
        Proposal not found
      </div>
    );
  }

  // Fire-and-forget — first view stamps viewed_at, subsequent views are
  // no-ops thanks to the `.is('viewed_at', null)` filter inside the action.
  void markProposalViewed(proposal.id);

  const services = Array.isArray(proposal.services_json) ? proposal.services_json : [];
  const total =
    Number((proposal as { total_price?: number }).total_price) ||
    calculateProposalTotal(proposal.services_json);
  const issuedAt = proposal.sent_at ?? proposal.created_at;
  const reference = `PRO-${proposal.id.slice(0, 6).toUpperCase()}`;
  const title =
    services.length === 1
      ? services[0]?.service?.name ?? services[0]?.name ?? "Compliance Services"
      : "Compliance & Training Programme";

  let signedPdfUrl: string | null = null;
  if (proposal.proposal_pdf_path) {
    const { data: signed } = await adminClient.storage
      .from("proposals")
      .createSignedUrl(proposal.proposal_pdf_path, 60 * 60);
    signedPdfUrl = signed?.signedUrl ?? null;
  }

  const isSigned = proposal.status === "Signed" || proposal.status === "Contract Issued";

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Back */}
      <Link
        href="/client/proposals"
        className="inline-flex items-center gap-2 text-[#6b6560] hover:text-black transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
          Back to Proposals
        </span>
      </Link>

      {/* Header */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
          <span className="text-teal">{reference}</span>
          <span className="opacity-50">·</span>
          <span>Sent {new Date(issuedAt).toLocaleDateString("en-GB", DATE_FMT)}</span>
        </div>
        <h2 className="font-serif text-[40px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          {title}.
        </h2>
        <p className="text-[#6b6560] text-[13px] font-sans tracking-tight max-w-xl">
          £{Math.round(total).toLocaleString()} · {services.length} {services.length === 1 ? "service" : "services"} bundled
        </p>
      </section>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* PDF or services breakdown */}
        <div className="bg-white rounded-sm overflow-hidden ring-1 ring-[#e5e1d8] shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          {signedPdfUrl ? (
            <iframe
              src={signedPdfUrl}
              title={`Proposal ${reference}`}
              className="w-full bg-[#f7f5f0]"
              style={{ aspectRatio: "210 / 297", border: 0 }}
            />
          ) : (
            <div className="aspect-[210/297] w-full p-12 text-[#1a1a1a] flex flex-col items-center justify-center text-center">
              <FileText className="w-10 h-10 text-[#8a857f] mb-4" />
              <h3 className="font-serif text-[22px] mb-2">PDF not generated yet</h3>
              <p className="font-sans text-[13px] text-[#6b6560] max-w-sm">
                The proposal document is still being prepared. The services breakdown is
                visible on the right.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar — download + breakdown */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="bg-white border border-[#e5e1d8] rounded-sm p-6 space-y-4">
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#8a857f] font-bold">
              Your Proposal
            </div>
            <p className="font-sans text-[13px] text-[#1a1a1a]/80 leading-relaxed">
              {isSigned
                ? "This proposal has been accepted. Download a copy for your records."
                : "Review the document, then accept and sign below. You can download a copy at any time."}
            </p>
            {!isSigned && <AcceptSignButton proposalId={proposal.id} />}
            {signedPdfUrl ? (
              <a
                href={signedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={`${reference}.pdf`}
                className="bg-[#1a1a1a] hover:bg-black text-white text-[10px] uppercase tracking-[0.25em] font-bold h-12 rounded-sm shadow-none flex items-center gap-2 justify-center transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Proposal
              </a>
            ) : (
              <button
                disabled
                className="bg-[#1a1a1a]/40 text-white text-[10px] uppercase tracking-[0.25em] font-bold h-12 rounded-sm shadow-none flex items-center gap-2 justify-center cursor-not-allowed w-full"
              >
                <Download className="w-3.5 h-3.5" />
                Download Proposal
              </button>
            )}
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8a857f]">
              Status: <span className={isSigned ? "text-teal" : "text-[#c0a66d]"}>{proposal.status}</span>
            </p>
          </div>

          {/* Quick services list — secondary, in case PDF is slow to load */}
          {services.length > 0 && (
            <div className="bg-white border border-[#e5e1d8] rounded-sm p-6">
              <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#8a857f] font-bold mb-3">
                Scope
              </div>
              <ul className="space-y-2.5">
                {services.map((item: any, idx: number) => {
                  const name = item?.service?.name || item?.name || "Service";
                  const qty = Number(item?.quantity) || 1;
                  return (
                    <li key={idx} className="font-sans text-[12px] text-[#1a1a1a]/80 flex items-start gap-2">
                      <span className="font-mono text-[10px] text-[#8a857f] mt-0.5 w-5 shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span>
                        {name} <span className="text-[#8a857f]">× {qty}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
