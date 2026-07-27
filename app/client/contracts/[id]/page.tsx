import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { adminClient } from "@/lib/supabase/admin"
import { getClientContext } from "@/lib/auth-helpers"
import { calculateProposalTotal } from "@/lib/supabase/dashboard"
import { FileDownloadUrl } from "@/components/client/file-download-url"
import { failedClientLoad } from "@/lib/observability/failed-client-load"

export const dynamic = "force-dynamic"

const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
}

interface ServiceJsonItem {
  name?: string
  service?: { name?: string; unit_price?: number }
  price?: number
  quantity?: number
}

export default async function ClientContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getClientContext()
  if (!ctx?.client_id) notFound()

  // adminClient bypasses RLS, so both the organisation filter and issued-state
  // filter are mandatory IDOR boundaries.
  const { data: contract, error } = await adminClient
    .from("proposals")
    .select(
      "id, contract_pdf_path, services_json, total_price, created_at, sent_at"
    )
    .eq("id", id)
    .eq("client_id", ctx.client_id)
    .eq("status", "Contract Issued")
    .not("contract_pdf_path", "is", null)
    .maybeSingle()

  // A query failure is not "this contract doesn't exist" — rendering 404 for
  // it hid the fault from both the client and Diagnostics.
  if (error) {
    return failedClientLoad({
      area: "client.contracts.detail.load",
      itemName: "contract",
      error,
      clientId: ctx.client_id,
      context: { contractId: id },
    })
  }
  if (!contract?.contract_pdf_path) notFound()

  const [view, download] = await Promise.all([
    adminClient.storage
      .from("proposals")
      .createSignedUrl(contract.contract_pdf_path, 60 * 60),
    adminClient.storage
      .from("proposals")
      .createSignedUrl(contract.contract_pdf_path, 60 * 60, {
        download: true,
      }),
  ])

  const services: ServiceJsonItem[] = Array.isArray(contract.services_json)
    ? (contract.services_json as ServiceJsonItem[])
    : []
  const total =
    Number(contract.total_price) ||
    calculateProposalTotal(contract.services_json)
  const issuedAt = contract.sent_at ?? contract.created_at
  const reference = `CON-${contract.id.slice(0, 6).toUpperCase()}`
  const firstName =
    services[0]?.service?.name ?? services[0]?.name ?? "Compliance Services"
  const title =
    services.length === 1 ? firstName : "Compliance & Training Programme"
  const viewUrl = view.data?.signedUrl ?? null
  const downloadUrl = download.data?.signedUrl ?? null

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Link
        href="/client/contracts"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] font-bold">
          Back to Contracts
        </span>
      </Link>

      <section className="space-y-3">
        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-muted-foreground uppercase font-bold">
          <span className="text-teal">{reference}</span>
          <span className="opacity-50">·</span>
          <span>
            Issued {new Date(issuedAt).toLocaleDateString("en-GB", DATE_FMT)}
          </span>
        </div>
        <h2 className="font-serif text-[40px] text-foreground font-normal tracking-tight leading-[1.05]">
          {title}.
        </h2>
        <p className="text-muted-foreground text-[13px] font-sans tracking-tight">
          £{Math.round(total).toLocaleString()} · {services.length}{" "}
          {services.length === 1 ? "service" : "services"}
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        <div className="bg-card rounded-sm overflow-hidden ring-1 ring-border shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          {viewUrl ? (
            <iframe
              src={viewUrl}
              title={`Contract ${reference}`}
              className="w-full bg-muted"
              style={{ aspectRatio: "210 / 297", border: 0 }}
            />
          ) : (
            <div className="aspect-[210/297] flex items-center justify-center p-10 text-center text-sm text-muted-foreground">
              The contract file could not be opened. Try the download again or
              contact Matt.
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 bg-card border border-border rounded-sm p-6 space-y-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-muted-foreground font-bold">
            Your Agreement
          </div>
          <p className="font-sans text-[13px] text-foreground/80 leading-relaxed">
            This is the issued service agreement for your records.
          </p>
          <FileDownloadUrl
            label="Download contract"
            downloadUrl={downloadUrl}
            viewUrl={viewUrl}
          />
          {services.length > 0 && (
            <ul className="border-t border-border pt-4 space-y-2.5">
              {services.map((item, index) => {
                const name =
                  item.service?.name ?? item.name ?? "Compliance service"
                const quantity = Number(item.quantity) || 1
                return (
                  <li
                    key={`${name}-${index}`}
                    className="font-sans text-[12px] text-foreground/80"
                  >
                    {name}{" "}
                    <span className="text-muted-foreground">× {quantity}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
