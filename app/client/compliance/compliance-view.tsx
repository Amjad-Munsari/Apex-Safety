"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Download, ExternalLink, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getClientComplianceDocSignedUrl } from "./actions";

export type ComplianceStatus = "CURRENT" | "EXPIRING" | "EXPIRED";

export interface ComplianceDoc {
  id: string;
  title: string;
  size: string;
  issued: string;
  expires: string | null;
  status: ComplianceStatus;
}

export interface ComplianceCategory {
  name: string;
  count: number;
  documents: ComplianceDoc[];
}

export function ComplianceView({ categories }: { categories: ComplianceCategory[] }) {
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get("doc") ?? null;
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId]);

  const handleDownload = (doc: ComplianceDoc) => {
    setPendingDocId(doc.id);
    startTransition(async () => {
      const { url, filename } = await getClientComplianceDocSignedUrl(doc.id, { mode: "download" });
      setPendingDocId(null);
      if (!url) {
        toast.error(`Could not prepare ${doc.title} for download.`);
        return;
      }
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? doc.title;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const handleView = (doc: ComplianceDoc) => {
    setPendingDocId(doc.id);
    startTransition(async () => {
      const { url } = await getClientComplianceDocSignedUrl(doc.id, { mode: "view" });
      setPendingDocId(null);
      if (!url) {
        toast.error(`Could not open ${doc.title}.`);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <>
      <div className="space-y-16">
        {categories.map((category) => (
          <section key={category.name} className="space-y-6">
            <div className="flex items-baseline gap-3 px-1">
              <h3 className="font-mono text-[9px] tracking-[0.25em] font-medium text-[#8a857f] uppercase">
                {category.name}
              </h3>
              <span className="font-mono text-[9px] text-[#8a857f] font-normal tracking-[0.05em] lowercase">
                {category.count} document{category.count === 1 ? "" : "s"}
              </span>
            </div>

            <div className="bg-white border border-[#e5e1d8] rounded-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="divide-y divide-[#f0ede6]">
                {category.documents.map((doc) => {
                  const isHighlighted = highlightId === doc.id;
                  const isPending = pendingDocId === doc.id;
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
                      <div className="flex-1 min-w-0">
                        <h4 className="font-sans font-semibold text-[14px] text-[#1a1a1a] tracking-tight group-hover:text-black truncate">
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.1em] text-[#8a857f] uppercase font-medium mt-1.5">
                          <span>{doc.id.slice(0, 8).toUpperCase()}</span>
                          <span className="opacity-60 font-sans">&mdash;</span>
                          <span>{doc.size}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-12 shrink-0">
                        <div className="space-y-1.5 w-[100px]">
                          <span className="font-mono text-[8px] uppercase tracking-[0.25em] font-medium text-[#8a857f] block">
                            Issued
                          </span>
                          <span className="font-mono text-[11px] font-medium text-[#1a1a1a] tracking-tight whitespace-nowrap">
                            {doc.issued}
                          </span>
                        </div>
                        <div className="space-y-1.5 w-[100px]">
                          <span className="font-mono text-[8px] uppercase tracking-[0.25em] font-medium text-[#8a857f] block">
                            Expires
                          </span>
                          <span className="font-mono text-[11px] font-medium text-[#1a1a1a] tracking-tight whitespace-nowrap">
                            {doc.expires || "—"}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 w-28 flex justify-center">
                        <div
                          className={cn(
                            "w-full py-1.5 border rounded-[2px] font-mono text-[9px] uppercase tracking-[0.2em] font-bold leading-none flex items-center justify-center gap-2 whitespace-nowrap",
                            doc.status === "EXPIRED"
                              ? "border-[#e06050]/40 text-[#e06050]"
                              : doc.status === "EXPIRING"
                              ? "border-[#c0a66d]/40 text-[#c0a66d]"
                              : "border-[#3b8273]/40 text-[#3b8273]"
                          )}
                        >
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              doc.status === "EXPIRED"
                                ? "bg-[#e06050]"
                                : doc.status === "EXPIRING"
                                ? "bg-[#c0a66d]"
                                : "bg-[#3b8273]"
                            )}
                          ></div>
                          <span>{doc.status}</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            disabled={isPending}
                            className="flex items-center border border-[#e5e1d8] rounded-sm group/btn cursor-pointer bg-white overflow-hidden h-12 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all p-0 disabled:opacity-50 disabled:cursor-progress"
                          >
                            <div className="w-8 h-full flex items-center justify-center border-r border-[#e5e1d8] group-hover/btn:bg-[#faf9f6] transition-colors">
                              <ChevronDown className="h-3.5 w-3.5 text-[#8a857f] group-hover/btn:text-[#1a1a1a] transition-colors" />
                            </div>
                            <div className="px-5 h-full flex flex-col items-center justify-center gap-0 group-hover/btn:bg-[#faf9f6] transition-colors">
                              <span className="font-sans text-[11px] font-bold tracking-tight text-[#1a1a1a]">
                                {isPending ? "Preparing…" : "Download"}
                              </span>
                              <span className="font-mono text-[9px] font-bold text-[#8a857f] tracking-[0.15em] uppercase -mt-0.5">
                                PDF
                              </span>
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="rounded-sm border-[#e5e1d8] p-1 shadow-md bg-white"
                          >
                            <DropdownMenuItem
                              onClick={() => handleDownload(doc)}
                              className="text-[10px] font-mono font-bold uppercase tracking-widest p-3 cursor-pointer h-10 flex items-center gap-3 text-[#1a1a1a] hover:bg-[#faf9f6]"
                            >
                              <Download className="h-3.5 w-3.5" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleView(doc)}
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
    </>
  );
}
