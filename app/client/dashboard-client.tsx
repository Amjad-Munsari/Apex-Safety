"use client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileDownloadMenu } from "@/components/client/file-download-menu";
import { StatusPill } from "@/components/client/status-pill";
import { getClientComplianceDocSignedUrl } from "./compliance/actions";
import type { AttentionDoc, DashboardData } from "./page";

interface Props {
  data: DashboardData;
  greeting: string;
}

export function ClientDashboard({ data, greeting }: Props) {
  // Needs-attention items are compliance documents — serve the real signed URL
  // from the client-documents bucket (org-scoped), not a demo preview.
  const docAction = async (doc: AttentionDoc, mode: "view" | "download") => {
    const { url, filename } = await getClientComplianceDocSignedUrl(doc.id, { mode });
    if (!url) {
      toast.error(`Could not prepare ${doc.title}.`);
      return;
    }
    if (mode === "download") {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? doc.title;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const hasAlerts = data.expired > 0 || data.expiring > 0;
  const balanceLow = data.hoursBalance > 0 && data.hoursBalance < 5;
  const balanceZero = data.hoursBalance <= 0;

  return (
    <div className="space-y-8">
      {/* ─── SECTION 01: TODAY / HERO ─── */}
      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className="font-mono text-[10px] text-teal tracking-[0.4em] uppercase font-medium">01 Today</span>
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-[30px] text-[#1a1a1a] font-medium tracking-tight leading-[1.1]">
              {greeting}, {data.greetingName}.
            </h2>
            <p className="text-[#6b6560] text-[13px] font-sans tracking-tight">
              Here&rsquo;s where things stand for {data.clientName} as of {data.todayLabel}.
            </p>
          </div>
        </div>

        {/* Global Warning Alert — only when there are real expired/expiring docs */}
        {hasAlerts ? (
          <div className="bg-[#fcf3f2] border border-[#f5dbd9] rounded-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="w-1 h-1 rounded-full bg-[#d64030] shadow-[0_0_0_4px_rgba(214,64,48,0.08)]"></div>
               <div className="space-y-0.5">
                 <h4 className="font-serif text-[18px] text-[#8b2b21] font-bold">
                   {data.expired > 0
                     ? `${data.expired} document${data.expired === 1 ? "" : "s"} ${data.expired === 1 ? "has" : "have"} expired.`
                     : `${data.expiring} document${data.expiring === 1 ? "" : "s"} expiring soon.`}
                 </h4>
                 <p className="text-[#8b2b21]/70 text-[12px] font-sans tracking-tight">Review what&rsquo;s due below, or message Matt to arrange a renewal.</p>
               </div>
            </div>
            <Link href="/client/compliance">
              <Button variant="outline" className="rounded-sm border-[#eec0bb] bg-[#fdf8f7] text-[#8b2b21] hover:bg-[#f9dcd8] h-8 px-5 font-bold text-[8.5px] uppercase tracking-[0.2em] shadow-none">
                Review
              </Button>
            </Link>
          </div>
        ) : null}
      </section>

      {/* ─── ROW: 02 COMPLIANCE & 03 HOURS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

        {/* 02 COMPLIANCE SUMMARY */}
        <section className="bg-white border border-[#e5e1d8] rounded-sm p-6 flex flex-col h-full shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
               <span className="font-mono text-[8px] text-[#8a857f] tracking-[0.3em] font-bold uppercase">02</span>
               <h3 className="font-sans font-bold text-[8.5px] uppercase tracking-[0.25em] text-[#1a1a1a]">Compliance summary</h3>
            </div>
            <Link href="/client/compliance" className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#8a857f] hover:text-black border-b border-[#d8d4cc] pb-0.5 font-bold transition-all">View All</Link>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {data.total === 0 ? (
              <p className="text-center font-sans text-[12px] text-[#8a857f] py-6 leading-relaxed">
                No compliance documents yet. Your consultant&rsquo;s uploads will appear here.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="text-center space-y-1">
                    <div className="font-serif text-[42px] text-teal leading-none">{data.current}</div>
                    <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#8a857f] font-bold">Current</div>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="font-serif text-[42px] text-[#c0a66d] leading-none">{data.expiring}</div>
                    <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#8a857f] font-bold">Expiring</div>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="font-serif text-[42px] text-[#8b2b21] leading-none">{data.expired}</div>
                    <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#8a857f] font-bold">Expired</div>
                  </div>
                </div>

                {/* Custom Multi-Color Progress Bar — proportional to real counts */}
                <div className="space-y-3">
                  <div className="h-1 w-full flex overflow-hidden">
                    <div className="h-full bg-teal" style={{ width: `${(data.current / data.total) * 100}%` }}></div>
                    <div className="h-full bg-[#c0a66d] ml-[1.5px]" style={{ width: `${(data.expiring / data.total) * 100}%` }}></div>
                    <div className="h-full bg-[#8b2b21] ml-[1.5px]" style={{ width: `${(data.expired / data.total) * 100}%` }}></div>
                  </div>
                  <p className="font-mono text-[8px] text-[#8a857f] italic tracking-widest font-bold">
                    {data.total} compliance document{data.total === 1 ? "" : "s"} tracked
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* 03 CONSULTING HOURS */}
        <section className="bg-white border border-[#e5e1d8] rounded-sm p-6 flex flex-col h-full shadow-sm">
          <div className="flex items-center gap-3 mb-6">
             <span className="font-mono text-[8px] text-[#8a857f] tracking-[0.3em] font-bold uppercase">03</span>
             <h3 className="font-sans font-bold text-[8.5px] uppercase tracking-[0.25em] text-[#1a1a1a]">Consulting hours</h3>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="mb-5">
              <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#8a857f] font-bold">Current Balance</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={cn(
                  "font-serif text-[46px] leading-none",
                  balanceZero ? "text-[#8b2b21]" : balanceLow ? "text-[#c0a66d]" : "text-[#1a1a1a]"
                )}>
                  {data.hoursBalance.toFixed(1)}
                </span>
                <span className="font-serif text-[18px] text-[#6b6560] font-light">hours</span>
              </div>
            </div>

            {/* Low Balance Warning — only when actually low */}
            {balanceLow || balanceZero ? (
              <div className="bg-[#fcf3f2] border border-[#f5dbd9] rounded-sm px-3.5 py-2.5 mb-6">
                <p className="text-[#8b2b21] text-[11px] font-medium tracking-tight leading-relaxed">
                  {balanceZero
                    ? "No consulting hours remaining. Top up to schedule a visit."
                    : "Your balance is low. Matt can't schedule a full visit with this remaining."}
                </p>
              </div>
            ) : null}

            <div className="mt-auto flex gap-2.5">
              <Link href="/client/billing" className="flex-1">
                <Button className="w-full rounded-sm bg-[#1a1a1a] hover:bg-black text-white text-[8.5px] uppercase tracking-[0.25em] font-bold h-10 shadow-none transition-all">
                  Buy more hours &rarr;
                </Button>
              </Link>
              <Link href="/client/billing#history">
                <Button variant="outline" className="rounded-sm border-[#e5e1d8] bg-transparent hover:bg-[#f9f8f6] text-[8.5px] uppercase tracking-[0.25em] font-bold h-10 px-5 shadow-none transition-all">
                  History
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ─── SECTION 04: NEEDS ATTENTION ─── */}
      {data.attentionDocs.length > 0 ? (
        <section className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          <div className="flex items-center gap-3">
             <span className="font-mono text-[8px] text-[#8a857f] tracking-[0.3em] font-bold uppercase">04</span>
             <h3 className="font-sans font-bold text-[8.5px] uppercase tracking-[0.25em] text-[#1a1a1a]">Needs attention</h3>
          </div>

          <div className="bg-white border border-[#e5e1d8] rounded-sm divide-y divide-[#f0ede6] shadow-sm overflow-hidden">
            {data.attentionDocs.map((doc) => (
              <div key={doc.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-5 group hover:bg-[#faf9f6]/80 transition-all">
                <div className="space-y-1 flex-1">
                  <h4 className="font-sans font-extrabold text-[14px] text-[#1a1a1a] tracking-tight group-hover:text-black">{doc.title}</h4>
                  <div className="flex items-center gap-3 font-mono text-[8px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                     <span>{doc.id.slice(0, 8).toUpperCase()}</span>
                     <span className="opacity-50">&middot;</span>
                     <span>{doc.type} {doc.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 shrink-0">
                   <StatusPill tone={doc.type === "expired" ? "danger" : "warning"} label={doc.status} />

                   <FileDownloadMenu
                     size="sm"
                     label="Download"
                     onDownload={() => docAction(doc, "download")}
                     onView={() => docAction(doc, "view")}
                   />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
