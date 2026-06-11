"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileDownloadMenu } from "@/components/client/file-download-menu";
import { StatusPill, type StatusTone } from "@/components/client/status-pill";
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

const TONE: Record<ComplianceStatus, StatusTone> = {
  CURRENT: "success",
  EXPIRING: "warning",
  EXPIRED: "danger",
};

export function ComplianceView({ categories }: { categories: ComplianceCategory[] }) {
  const searchParams = useSearchParams();
  const highlightId = searchParams?.get("doc") ?? null;
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId]);

  const downloadDoc = async (doc: ComplianceDoc) => {
    const { url, filename } = await getClientComplianceDocSignedUrl(doc.id, { mode: "download" });
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
  };

  const viewDoc = async (doc: ComplianceDoc) => {
    const { url } = await getClientComplianceDocSignedUrl(doc.id, { mode: "view" });
    if (!url) {
      toast.error(`Could not open ${doc.title}.`);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
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
                      <h4 className="font-sans font-semibold text-[15px] text-[#1a1a1a] tracking-tight group-hover:text-black truncate">
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

                    <div className="shrink-0 w-32 flex justify-center">
                      <StatusPill tone={TONE[doc.status]} label={doc.status} />
                    </div>

                    <div className="shrink-0">
                      <FileDownloadMenu
                        label="Download"
                        onDownload={() => downloadDoc(doc)}
                        onView={() => viewDoc(doc)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
