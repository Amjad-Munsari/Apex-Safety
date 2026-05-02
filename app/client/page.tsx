"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Download,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PdfPreviewDialog } from "@/components/client/pdf-preview-dialog";

interface AttentionDoc {
  id: string;
  title: string;
  status: string;
  date: string;
  type: "expired" | "expiring";
}

const attentionDocs: AttentionDoc[] = [
  { id: "DOC-1408", title: "Fire Risk Assessment (Type 3) — Main Building", status: "EXPIRED", date: "22 Nov 2025", type: "expired" },
  { id: "DOC-0941", title: "EICR 2024 — Electrical Installation Condition Report", status: "EXPIRED", date: "03 Apr 2026", type: "expired" },
  { id: "DOC-0903", title: "Legionella Risk Assessment", status: "EXPIRING", date: "19 Jun 2026", type: "expiring" },
  { id: "DOC-1455", title: "Gas Safety Certificate", status: "EXPIRING", date: "02 Sep 2026", type: "expiring" },
];

export default function ClientDashboard() {
  const [previewDoc, setPreviewDoc] = useState<AttentionDoc | null>(null);

  return (
    <div className="space-y-8">
      {/* ─── SECTION 01: TODAY / HERO ─── */}
      <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <span className="font-mono text-[8px] text-[#8a857f] tracking-[0.3em] font-bold uppercase">01 Today</span>
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-[30px] text-[#1a1a1a] font-medium tracking-tight leading-[1.1]">Good morning, Sarah.</h2>
            <p className="text-[#6b6560] text-[13px] font-sans tracking-tight">
              Here's where things stand for Hallam House Care Home as of Saturday, 18 April 2026.
            </p>
          </div>
        </div>

        {/* Global Warning Alert */}
        <div className="bg-[#fcf3f2] border border-[#f5dbd9] rounded-sm p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-1 h-1 rounded-full bg-[#d64030] shadow-[0_0_0_4px_rgba(214,64,48,0.08)]"></div>
             <div className="space-y-0.5">
               <h4 className="font-serif text-[18px] text-[#8b2b21] font-bold">2 documents have expired.</h4>
               <p className="text-[#8b2b21]/70 text-[12px] font-sans tracking-tight">Review what's due, renew directly, or message Matt.</p>
             </div>
          </div>
          <Link href="/client/compliance">
            <Button variant="outline" className="rounded-sm border-[#eec0bb] bg-[#fdf8f7] text-[#8b2b21] hover:bg-[#f9dcd8] h-8 px-5 font-bold text-[8.5px] uppercase tracking-[0.2em] shadow-none">
              Review
            </Button>
          </Link>
        </div>
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
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="text-center space-y-1">
                <div className="font-serif text-[42px] text-[#3b8273] leading-none">9</div>
                <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#8a857f] font-bold">Current</div>
              </div>
              <div className="text-center space-y-1">
                <div className="font-serif text-[42px] text-[#c0a66d] leading-none">2</div>
                <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#8a857f] font-bold">Expiring</div>
              </div>
              <div className="text-center space-y-1">
                <div className="font-serif text-[42px] text-[#8b2b21] leading-none">2</div>
                <div className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#8a857f] font-bold">Expired</div>
              </div>
            </div>

            {/* Custom Multi-Color Progress Bar */}
            <div className="space-y-3">
              <div className="h-1 w-full flex overflow-hidden">
                <div className="h-full w-[65%] bg-[#3b8273]"></div>
                <div className="h-full w-[15%] bg-[#c0a66d] ml-[1.5px]"></div>
                <div className="h-full w-[15%] bg-[#8b2b21] ml-[1.5px]"></div>
                <div className="h-full flex-1 bg-[#f0ede6] ml-[1.5px]"></div>
              </div>
              <p className="font-mono text-[8px] text-[#8a857f] italic tracking-widest font-bold">13 compliance documents tracked</p>
            </div>
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
                <span className="font-serif text-[46px] text-[#8b2b21] leading-none">4.5</span>
                <span className="font-serif text-[18px] text-[#6b6560] font-light">hours</span>
              </div>
            </div>

            {/* Low Balance Warning */}
            <div className="bg-[#fcf3f2] border border-[#f5dbd9] rounded-sm px-3.5 py-2.5 mb-6">
              <p className="text-[#8b2b21] text-[11px] font-medium tracking-tight leading-relaxed">
                Your balance is low. Matt can't schedule a full visit with this remaining.
              </p>
            </div>

            <p className="font-mono text-[8px] text-[#8a857f] tracking-[0.1em] font-bold mb-6">
              18.5h used this year &middot; last top-up 10 Apr
            </p>

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
      <section className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
        <div className="flex items-center gap-3">
           <span className="font-mono text-[8px] text-[#8a857f] tracking-[0.3em] font-bold uppercase">04</span>
           <h3 className="font-sans font-bold text-[8.5px] uppercase tracking-[0.25em] text-[#1a1a1a]">Needs attention</h3>
        </div>

        <div className="bg-white border border-[#e5e1d8] rounded-sm divide-y divide-[#f0ede6] shadow-sm overflow-hidden">
          {attentionDocs.map((doc) => (
            <div key={doc.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-5 group hover:bg-[#faf9f6]/80 transition-all">
              <div className="space-y-1 flex-1">
                <h4 className="font-sans font-extrabold text-[14px] text-[#1a1a1a] tracking-tight group-hover:text-black">{doc.title}</h4>
                <div className="flex items-center gap-3 font-mono text-[8px] tracking-[0.25em] text-[#8a857f] uppercase font-bold">
                   <span>{doc.id}</span>
                   <span className="opacity-50">&middot;</span>
                   <span>{doc.type} {doc.date}</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5 shrink-0">
                 <div className={cn(
                   "px-3 py-1 border rounded-full font-mono text-[8px] uppercase tracking-[0.16em] font-bold leading-none flex items-center gap-1.5",
                   doc.type === "expired" ? "border-[#8b2b21] text-[#8b2b21] bg-transparent" : "border-[#c0a66d] text-[#c0a66d] bg-transparent"
                 )}>
                   <div className={cn("w-0.5 h-0.5 rounded-full", doc.type === "expired" ? "bg-[#8b2b21]" : "bg-[#c0a66d]")}></div>
                   {doc.status.split('').join(' ')}
                 </div>

                 <Link href={`/client/compliance?doc=${doc.id}`}>
                   <Button variant="outline" className="rounded-sm border-[#1a1a1a] bg-transparent text-[#1a1a1a] hover:bg-[#1a1a1a]! hover:text-white! h-8 px-5 font-bold text-[8.5px] uppercase tracking-[0.25em] transition-all shadow-none">
                     Renew
                   </Button>
                 </Link>

                 <DropdownMenu>
                    <DropdownMenuTrigger
                       render={(props) => (
                         <Button {...props} variant="outline" className="rounded-sm border-[#e5e1d8] bg-transparent text-[#1a1a1a] hover:bg-[#f9f8f6] h-8 px-3.5 flex items-center gap-2 group/btn font-mono text-[8px] font-bold uppercase tracking-[0.2em] shadow-none">
                           <ChevronDown className="h-2 w-2 opacity-30 group-hover/btn:opacity-100 transition-opacity" />
                           PDF
                         </Button>
                       )}
                    />
                    <DropdownMenuContent align="end" className="rounded-sm border-[#e5e1d8] p-1.5">
                       <DropdownMenuItem
                         onClick={() => toast.success(`Downloading ${doc.title}…`)}
                         className="text-[10px] font-mono font-bold uppercase tracking-widest p-2 cursor-pointer h-10 flex items-center gap-3"
                       >
                          <Download className="h-3 w-3" /> Download Result
                       </DropdownMenuItem>
                       <DropdownMenuItem
                         onClick={() => setPreviewDoc(doc)}
                         className="text-[10px] font-mono font-bold uppercase tracking-widest p-2 cursor-pointer h-10 flex items-center gap-3"
                       >
                          <ExternalLink className="h-3 w-3" /> View Online
                       </DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PdfPreviewDialog
        open={previewDoc !== null}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
        title={previewDoc?.title || ""}
        subtitle={previewDoc ? `${previewDoc.status} · ${previewDoc.date}` : undefined}
        documentId={previewDoc?.id}
      />
    </div>
  );
}
