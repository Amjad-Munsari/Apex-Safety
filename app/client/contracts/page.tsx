import { adminClient } from "@/lib/supabase/admin";
import { getClientContext } from "@/lib/auth-helpers";
import { calculateProposalTotal } from "@/lib/supabase/dashboard";
import { FileDownloadUrl } from "@/components/client/file-download-url";
import Link from "next/link";
import { ClientDataLoadError } from "@/components/client/data-load-error";

export const dynamic = "force-dynamic";

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function shortRef(uuid: string): string {
  return `CON-${uuid.slice(0, 6).toUpperCase()}`;
}

/** Shape of a single line item in proposals.services_json (loosely typed in the DB). */
interface ServiceJsonItem {
  name?: string;
  service?: { name?: string; unit_price?: number };
  price?: number;
  quantity?: number;
}

export default async function ClientContractsPage() {
  const ctx = await getClientContext();
  if (!ctx?.client_id) {
    return (
      <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        No client context found
      </div>
    );
  }

  // Query proposals that have reached the counter-signed stage.
  // D-11: stored status is title-case "Contract Issued" — NOT "contract_signed".
  // adminClient bypasses RLS (RLS uses lowercase values that never match stored
  // title-case); the .eq("client_id") scope is the sole IDOR boundary (T-19-11).
  const { data: rows, error: queryError } = await adminClient
    .from("proposals")
    .select("id, contract_pdf_path, services_json, total_price, created_at, sent_at")
    .eq("client_id", ctx.client_id)
    .eq("status", "Contract Issued")
    .not("contract_pdf_path", "is", null)
    .order("created_at", { ascending: false });

  const contracts = rows ?? [];

  // Batch signed-URL generation — never expose the raw storage path (T-19-12).
  const paths = contracts
    .map((c) => c.contract_pdf_path)
    .filter((p): p is string => typeof p === "string");

  // Sign two URLs per contract: a view URL (opens inline) and a download URL
  // (download transform → force-save). Never expose the raw storage path (T-19-12).
  const viewUrlMap = new Map<string, string>();
  const downloadUrlMap = new Map<string, string>();
  if (paths.length > 0) {
    const [viewRes, downloadRes] = await Promise.all([
      adminClient.storage.from("proposals").createSignedUrls(paths, 60 * 60),
      adminClient.storage.from("proposals").createSignedUrls(paths, 60 * 60, { download: true }),
    ]);
    if (viewRes.error) {
      console.error("[contracts] createSignedUrls failed:", viewRes.error.message);
    }
    for (const item of viewRes.data ?? []) {
      if (item.path && item.signedUrl) viewUrlMap.set(item.path, item.signedUrl);
    }
    for (const item of downloadRes.data ?? []) {
      if (item.path && item.signedUrl) downloadUrlMap.set(item.path, item.signedUrl);
    }
  }

  const mappedContracts = contracts.map((c) => {
    const services: ServiceJsonItem[] = Array.isArray(c.services_json)
      ? (c.services_json as ServiceJsonItem[])
      : [];
    const total =
      Number((c as { total_price?: number }).total_price) ||
      calculateProposalTotal(c.services_json);
    const issuedAt = c.sent_at ?? c.created_at;
    const firstName =
      services[0]?.service?.name ?? services[0]?.name ?? "Compliance Services";
    const title =
      services.length === 1 ? firstName : "Compliance & Training Programme";
    const viewUrl = c.contract_pdf_path ? (viewUrlMap.get(c.contract_pdf_path) ?? null) : null;
    const downloadUrl = c.contract_pdf_path ? (downloadUrlMap.get(c.contract_pdf_path) ?? null) : null;
    return {
      id: c.id as string,
      reference: shortRef(c.id as string),
      title,
      issuedAt: new Date(issuedAt).toLocaleDateString("en-GB", DATE_FMT),
      total,
      serviceCount: services.length,
      viewUrl,
      downloadUrl,
    };
  });

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Page header — verbatim from the original stub */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            07 · Contracts
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-foreground font-normal tracking-tight leading-[1.05]">
          Service agreements.
        </h2>
      </section>

      {/* List or empty state */}
      {queryError ? (
        <ClientDataLoadError itemName="contracts" />
      ) : mappedContracts.length === 0 ? (
        /* Existing editorial empty-state card — verbatim */
        <div className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
          <p className="font-serif text-[20px] text-foreground mb-3">No contracts yet.</p>
          <p className="font-sans text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            Counter-signed service agreements will appear here once your proposal is accepted and issued
            by 888 Safety &amp; Training.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {mappedContracts.map((c) => (
            <div
              key={c.id}
              className="bg-card border border-border rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-7"
            >
              <div className="flex items-start justify-between gap-6">
                {/* Left */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-muted-foreground uppercase font-bold">
                    <Link
                      href={`/client/contracts/${c.id}`}
                      className="text-teal hover:text-teal/80 transition-colors"
                    >
                      {c.reference}
                    </Link>
                    <span className="opacity-50">·</span>
                    <span>Issued {c.issuedAt}</span>
                  </div>
                  <Link
                    href={`/client/contracts/${c.id}`}
                    className="block font-serif text-[24px] text-foreground hover:text-teal transition-colors tracking-tight leading-tight"
                  >
                    {c.title}
                  </Link>
                  <p className="font-sans text-[13px] text-muted-foreground">
                    {c.serviceCount} {c.serviceCount === 1 ? "service" : "services"} · £
                    {Math.round(c.total).toLocaleString()}
                  </p>
                </div>

                {/* Right — download affordance */}
                <div className="shrink-0 flex items-center">
                  <FileDownloadUrl
                    label="Download contract"
                    downloadUrl={c.downloadUrl}
                    viewUrl={c.viewUrl}
                  />
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
