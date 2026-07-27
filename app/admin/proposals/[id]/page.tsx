import { adminClient } from "@/lib/supabase/admin"
import { calculateProposalTotal, type ProposalLineItem } from "@/lib/supabase/dashboard"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building, Calendar, FileText, Download } from "lucide-react"
import { ProposalActions } from "./proposal-actions"

export const dynamic = "force-dynamic"

type ProposalStatus = "Draft" | "Sent" | "Signed" | "Contract Issued"

const STATUS_TONE: Record<ProposalStatus, { ring: string; dot: string; label: string }> = {
  Draft: { ring: "border-border text-foreground/70", dot: "bg-foreground/40", label: "DRAFT" },
  Sent: { ring: "border-gold/40 text-gold", dot: "bg-gold", label: "SENT" },
  Signed: { ring: "border-success/40 text-success", dot: "bg-success", label: "SIGNED" },
  "Contract Issued": {
    ring: "border-success/40 text-success",
    dot: "bg-success",
    label: "ISSUED",
  },
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: proposal, error } = await adminClient
    .from("proposals")
    .select(`*, client:clients(id, name, site_address, contact_name)`)
    .eq("id", id)
    .single()

  if (error || !proposal) {
    notFound()
  }

  const status = (proposal.status as ProposalStatus) || "Draft"
  const tone = STATUS_TONE[status] ?? STATUS_TONE.Draft
  const total =
    (proposal as { total_price?: number }).total_price ?? calculateProposalTotal(proposal.services_json)
  let documentUrl: string | null = null
  // Prefer the stamped copy (migration 029); original is immutable.
  const displayPdfPath =
    (proposal as { signed_pdf_path?: string | null }).signed_pdf_path ??
    proposal.proposal_pdf_path
  if (displayPdfPath) {
    const { data: signed, error: signError } = await adminClient.storage
      .from("proposals")
      .createSignedUrl(displayPdfPath, 60 * 60)
    if (signError) {
      console.error("Failed to sign proposal PDF URL:", signError)
    } else {
      documentUrl = signed?.signedUrl ?? null
    }
  }

  // Issued contract PDF (set by issueContract). Shown alongside the proposal so
  // the admin can download the counter-signed Service Agreement without a
  // separate Contracts section — a contract is just this proposal, issued.
  let contractUrl: string | null = null
  if (proposal.contract_pdf_path) {
    const { data: signed } = await adminClient.storage
      .from("proposals")
      .createSignedUrl(proposal.contract_pdf_path, 60 * 60)
    contractUrl = signed?.signedUrl ?? null
  }
  const clientRecord = proposal.client as { id?: string; name?: string; contact_name?: string } | null
  const clientName = clientRecord?.name ?? "Unknown client"
  const services = Array.isArray(proposal.services_json) ? proposal.services_json : []

  return (
    <div className="flex flex-col gap-8 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/proposals"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-2 w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-mono text-xs uppercase tracking-widest">Back to Pipeline</span>
        </Link>

        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 font-mono text-xs tracking-widest text-muted-foreground uppercase">
              <span className="text-gold font-semibold">06</span>
              SALES PIPELINE — DETAIL
            </div>
            <h2 className="font-serif text-[34px] leading-tight text-foreground">{clientName}</h2>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-transparent w-fit font-mono text-[10px] uppercase tracking-widest ${tone.ring}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
              {tone.label}
            </div>
          </div>

          <ProposalActions
            proposalId={proposal.id}
            clientId={clientRecord?.id ?? null}
            clientName={clientName}
            status={status}
            documentUrl={documentUrl}
            hasPdf={Boolean(displayPdfPath)}
          />
        </div>
      </div>

      {/* ─── SUMMARY CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-2">
            <Building className="w-3 h-3" /> Client
          </div>
          <div className="text-foreground/90 text-sm leading-relaxed">{clientName}</div>
          {clientRecord?.contact_name && (
            <div className="text-muted-foreground text-xs">{clientRecord.contact_name}</div>
          )}
        </Card>

        <Card className="bg-card border-border rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-2">
            <FileText className="w-3 h-3" /> Total
          </div>
          <div className="text-foreground font-serif text-3xl">
            £{Number(total).toLocaleString()}
          </div>
          <div className="text-muted-foreground text-xs">{services.length} services</div>
        </Card>

        <Card className="bg-card border-border rounded-sm p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground font-mono text-[10px] uppercase tracking-widest mb-2">
            <Calendar className="w-3 h-3" /> Created
          </div>
          <div className="text-foreground/90 text-sm leading-relaxed">
            {new Date(proposal.created_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </Card>
      </div>

      {/* ─── PDF PREVIEW ─── */}
      <Card className="bg-card border-border rounded-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 flex justify-between items-center border-b border-border">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">
              Proposal document
            </h3>
          </div>
          {documentUrl && (
            <a
              href={documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-widest text-gold hover:underline"
            >
              Open in new tab
            </a>
          )}
        </div>
        {documentUrl ? (
          <iframe
            src={documentUrl}
            title={`Proposal for ${clientName}`}
            className="w-full h-[720px] bg-background"
          />
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <FileText className="w-8 h-8 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              No PDF generated yet for this proposal.
            </p>
          </div>
        )}
      </Card>

      {/* ─── SERVICE AGREEMENT (contract) — only once issued ─── */}
      {contractUrl && (
        <Card className="bg-card border-border rounded-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 flex justify-between items-center border-b border-border">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-gold" />
              <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">
                Service agreement
              </h3>
            </div>
            <a
              href={contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={`CON-${proposal.id.slice(0, 6).toUpperCase()}.pdf`}
              className="inline-flex items-center gap-2 h-8 px-3 rounded-sm bg-muted hover:bg-muted text-foreground/80 font-mono text-[10px] uppercase tracking-widest transition-colors"
            >
              <Download className="w-3 h-3" /> Download contract
            </a>
          </div>
          <iframe
            src={contractUrl}
            title={`Service agreement for ${clientName}`}
            className="w-full h-[720px] bg-background"
          />
        </Card>
      )}

      {/* ─── SERVICES BREAKDOWN ─── */}
      {services.length > 0 && (
        <Card className="bg-card border-border rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-sans font-medium text-foreground tracking-wide text-lg">
              Services
            </h3>
          </div>
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-muted">
              <tr className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">
                <th className="font-normal px-6 py-3 border-b border-border">Service</th>
                <th className="font-normal px-4 py-3 border-b border-border text-right">Qty</th>
                <th className="font-normal px-6 py-3 border-b border-border text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((item: ProposalLineItem, idx: number) => {
                const name = item?.service?.name || item?.name || "Service"
                const qty = Number(item?.quantity) || 1
                const unit = Number(item?.service?.unit_price ?? item?.unit_price ?? item?.price) || 0
                return (
                  <tr key={idx} className="hover:bg-muted transition-colors">
                    <td className="px-6 py-4 text-foreground/90">{name}</td>
                    <td className="px-4 py-4 text-right font-mono text-foreground/60">{qty}</td>
                    <td className="px-6 py-4 text-right font-mono text-foreground">
                      £{(qty * unit).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
