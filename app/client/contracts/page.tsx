import { Download } from "lucide-react";
import { adminClient } from "@/lib/supabase/admin";
import { getClientContext } from "@/lib/auth-helpers";
import { calculateProposalTotal } from "@/lib/supabase/dashboard";

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
      <div className="py-24 text-center font-mono text-xs uppercase tracking-widest text-[#8a857f]">
        No client context found
      </div>
    );
  }

  // Query proposals that have reached the counter-signed stage.
  // D-11: stored status is title-case "Contract Issued" — NOT "contract_signed".
  // adminClient bypasses RLS (RLS uses lowercase values that never match stored
  // title-case); the .eq("client_id") scope is the sole IDOR boundary (T-19-11).
  const { data: rows } = await adminClient
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

  const signedUrlMap = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signedItems, error: signError } = await adminClient.storage
      .from("proposals")
      .createSignedUrls(paths, 60 * 60);
    if (signError) {
      // Don't swallow storage failures — a silent disabled Download button is
      // otherwise indistinguishable from "no contract" (code review WR-02).
      console.error("[contracts] createSignedUrls failed:", signError.message);
    }
    if (signedItems) {
      for (const item of signedItems) {
        if (item.path && item.signedUrl) {
          signedUrlMap.set(item.path, item.signedUrl);
        }
      }
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
    const signedUrl = c.contract_pdf_path
      ? (signedUrlMap.get(c.contract_pdf_path) ?? null)
      : null;
    return {
      id: c.id as string,
      reference: shortRef(c.id as string),
      title,
      issuedAt: new Date(issuedAt).toLocaleDateString("en-GB", DATE_FMT),
      total,
      serviceCount: services.length,
      signedUrl,
    };
  });

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Page header — verbatim from the original stub */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">
            08 · Contracts
          </span>
        </div>
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Service agreements.
        </h2>
      </section>

      {/* List or empty state */}
      {mappedContracts.length === 0 ? (
        /* Existing editorial empty-state card — verbatim */
        <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] px-10 py-16 text-center">
          <p className="font-serif text-[20px] text-[#1a1a1a] mb-3">No contracts yet.</p>
          <p className="font-sans text-[13px] text-[#8a857f] max-w-md mx-auto leading-relaxed">
            Counter-signed service agreements will appear here once your proposal is accepted and issued
            by 888 Safety &amp; Training.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {mappedContracts.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] p-7"
            >
              <div className="flex items-start justify-between gap-6">
                {/* Left */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                    <span>{c.reference}</span>
                    <span className="opacity-50">·</span>
                    <span>Issued {c.issuedAt}</span>
                  </div>
                  <h3 className="font-serif text-[24px] text-[#1a1a1a] tracking-tight leading-tight">
                    {c.title}
                  </h3>
                  <p className="font-sans text-[13px] text-[#6b6560]">
                    {c.serviceCount} {c.serviceCount === 1 ? "service" : "services"} · £
                    {Math.round(c.total).toLocaleString()}
                  </p>
                </div>

                {/* Right — download affordance */}
                <div className="shrink-0 flex items-center">
                  {c.signedUrl ? (
                    <a
                      href={c.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={`${c.reference}.pdf`}
                      className="bg-[#1a1a1a] hover:bg-black text-white text-[10px] uppercase tracking-[0.25em] font-bold h-10 px-5 rounded-sm flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  ) : (
                    <button
                      disabled
                      className="bg-[#1a1a1a]/40 text-white text-[10px] uppercase tracking-[0.25em] font-bold h-10 px-5 rounded-sm flex items-center gap-2 cursor-not-allowed"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
