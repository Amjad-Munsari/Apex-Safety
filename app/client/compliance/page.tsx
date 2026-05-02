"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
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

interface Document {
  id: string;
  title: string;
  size: string;
  issued: string;
  expires: string | null;
  status: "CURRENT" | "EXPIRING" | "EXPIRED";
}

interface Category {
  name: string;
  count: number;
  documents: Document[];
}

const complianceData: Category[] = [
  {
    name: "FIRE SAFETY",
    count: 5,
    documents: [
      { id: "DOC-1408", title: "Fire Risk Assessment (Type 3) — Main Building", size: "4.2MB", issued: "22 Nov 2024", expires: "22 Nov 2025", status: "EXPIRED" },
      { id: "DOC-1409", title: "Fire Risk Assessment (Type 1) — Annex Wing", size: "2.1MB", issued: "22 Nov 2024", expires: "22 Nov 2026", status: "CURRENT" },
      { id: "DOC-1510", title: "Fire Extinguisher Service Certificate", size: "0.6MB", issued: "14 Feb 2026", expires: "14 Feb 2027", status: "CURRENT" },
      { id: "DOC-1489", title: "Fire Warden Training — 4 staff", size: "1.3MB", issued: "08 Jan 2026", expires: "08 Jan 2029", status: "CURRENT" },
      { id: "DOC-1462", title: "Emergency Lighting Test Certificate", size: "0.4MB", issued: "02 Oct 2025", expires: "02 Oct 2026", status: "CURRENT" },
    ]
  },
  {
    name: "ELECTRICAL",
    count: 2,
    documents: [
      { id: "DOC-0941", title: "EICR 2024 — Electrical Installation Condition Report", size: "3.8MB", issued: "03 Apr 2021", expires: "03 Apr 2026", status: "EXPIRED" },
      { id: "DOC-1511", title: "PAT Testing Certificate — 42 items", size: "0.9MB", issued: "10 Mar 2026", expires: "10 Mar 2027", status: "CURRENT" },
    ]
  },
  {
    name: "TRAINING",
    count: 2,
    documents: [
      { id: "DOC-1344", title: "First Aid at Work — 3 staff", size: "0.7MB", issued: "14 May 2024", expires: "14 May 2027", status: "CURRENT" },
      { id: "DOC-1488", title: "Manual Handling Training", size: "0.5MB", issued: "08 Jan 2026", expires: "08 Jan 2028", status: "CURRENT" },
    ]
  },
  {
    name: "WATER HYGIENE",
    count: 2,
    documents: [
      { id: "DOC-0903", title: "Legionella Risk Assessment", size: "2.4MB", issued: "19 Jun 2024", expires: "19 Jun 2026", status: "EXPIRING" },
      { id: "DOC-1512", title: "Water Temperature Monitoring Log (Q1)", size: "0.3MB", issued: "31 Mar 2026", expires: null, status: "CURRENT" },
    ]
  },
  {
    name: "STRUCTURAL",
    count: 2,
    documents: [
      { id: "DOC-0712", title: "Asbestos Management Survey", size: "5.6MB", issued: "15 Aug 2022", expires: null, status: "CURRENT" },
      { id: "DOC-1455", title: "Gas Safety Certificate", size: "0.3MB", issued: "02 Sep 2025", expires: "02 Sep 2026", status: "EXPIRING" },
    ]
  }
];

export default function CompliancePage() {
  return (
    <Suspense fallback={null}>
      <ComplianceView />
    </Suspense>
  );
}

function ComplianceView() {
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get("doc") ?? null;
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId]);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* ─── PAGE HEADER ─── */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
           <span className="font-mono text-[10px] text-[#3b8273] tracking-[0.4em] uppercase font-medium">02 By Category</span>
        </div>
        <h2 className="font-serif text-[44px] text-[#1a1a1a] font-normal tracking-tight leading-[1.05]">
          Your compliance documents.
        </h2>
      </section>

      {/* ─── CATEGORY GROUPS ─── */}
      <div className="space-y-16">
        {complianceData.map((category) => (
          <section key={category.name} className="space-y-6">
            {/* Category Header */}
            <div className="flex items-baseline gap-3 px-1">
              <h3 className="font-mono text-[9px] tracking-[0.25em] font-medium text-[#777] uppercase">{category.name}</h3>
              <span className="font-mono text-[9px] text-[#bbb] font-normal tracking-[0.05em] lowercase">{category.count} documents</span>
            </div>

            {/* Document List Container */}
            <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="divide-y divide-[#f0ede6]">
                {category.documents.map((doc) => {
                  const isHighlighted = highlightId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      id={doc.id}
                      ref={isHighlighted ? highlightedRef : undefined}
                      className={cn(
                        "px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-8 group transition-all scroll-mt-28",
                        isHighlighted
                          ? "bg-[#fff7d6] ring-1 ring-inset ring-[#c0a66d]/40 animate-in fade-in"
                          : "hover:bg-[#faf9f6]/50"
                      )}
                    >

                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-sans font-semibold text-[14px] text-[#1a1a1a] tracking-tight group-hover:text-black truncate">
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.1em] text-[#bbb] uppercase font-medium mt-1.5">
                          <span>{doc.id}</span>
                          <span className="opacity-40 font-sans">&mdash;</span>
                          <span>{doc.size}</span>
                        </div>
                      </div>

                      {/* Center: Issued/Expires */}
                      <div className="flex items-center gap-12 shrink-0">
                        <div className="space-y-1.5 w-[100px]">
                          <span className="font-mono text-[8px] uppercase tracking-[0.25em] font-medium text-[#bbb] block">Issued</span>
                          <span className="font-mono text-[11px] font-medium text-[#1a1a1a] tracking-tight whitespace-nowrap">{doc.issued}</span>
                        </div>
                        <div className="space-y-1.5 w-[100px]">
                          <span className="font-mono text-[8px] uppercase tracking-[0.25em] font-medium text-[#bbb] block">Expires</span>
                          <span className="font-mono text-[11px] font-medium text-[#1a1a1a] tracking-tight whitespace-nowrap">
                            {doc.expires || "—"}
                          </span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 w-28 flex justify-center">
                        <div className={cn(
                          "w-full py-1.5 border rounded-[2px] font-mono text-[9px] uppercase tracking-[0.2em] font-bold leading-none flex items-center justify-center gap-2 whitespace-nowrap",
                          doc.status === "EXPIRED" ? "border-[#e06050]/40 text-[#e06050]" :
                          doc.status === "EXPIRING" ? "border-[#c0a66d]/40 text-[#c0a66d]" :
                          "border-[#3b8273]/40 text-[#3b8273]"
                        )}>
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0",
                            doc.status === "EXPIRED" ? "bg-[#e06050]" :
                            doc.status === "EXPIRING" ? "bg-[#c0a66d]" :
                            "bg-[#3b8273]"
                          )}></div>
                          <span>{doc.status}</span>
                        </div>
                      </div>

                      {/* Right: Action */}
                      <div className="shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="flex items-center border border-[#e5e1d8] rounded-sm group/btn cursor-pointer bg-white overflow-hidden h-12 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all p-0">
                            <div className="w-8 h-full flex items-center justify-center border-r border-[#e5e1d8] group-hover/btn:bg-[#faf9f6] transition-colors">
                              <ChevronDown className="h-3.5 w-3.5 text-[#bbb] group-hover/btn:text-[#1a1a1a] transition-colors" />
                            </div>
                            <div className="px-5 h-full flex flex-col items-center justify-center gap-0 group-hover/btn:bg-[#faf9f6] transition-colors">
                              <span className="font-sans text-[11px] font-bold tracking-tight text-[#1a1a1a]">Download</span>
                              <span className="font-mono text-[9px] font-bold text-[#bbb] tracking-[0.15em] uppercase -mt-0.5">PDF</span>
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-sm border-[#e5e1d8] p-1 shadow-md bg-white">
                            <DropdownMenuItem
                              onClick={() => toast.success(`Downloading ${doc.title}…`)}
                              className="text-[10px] font-mono font-bold uppercase tracking-widest p-3 cursor-pointer h-10 flex items-center gap-3 text-[#1a1a1a] hover:bg-[#faf9f6]"
                            >
                               <Download className="h-3.5 w-3.5" /> Download Result
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setPreviewDoc(doc)}
                              className="text-[10px] font-mono font-bold uppercase tracking-widest p-3 cursor-pointer h-10 flex items-center gap-3 text-[#1a1a1a] hover:bg-[#faf9f6]"
                            >
                               <ExternalLink className="h-3.5 w-3.5" /> View Online
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>

      <PdfPreviewDialog
        open={previewDoc !== null}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
        title={previewDoc?.title || ""}
        subtitle={previewDoc ? `${previewDoc.status} · Issued ${previewDoc.issued}` : undefined}
        documentId={previewDoc?.id}
      />
    </div>
  );
}
