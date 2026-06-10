"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { ComplianceBreakdown, ComplianceDocSummary } from "@/lib/supabase/dashboard";

interface ComplianceData {
  name: string;
  value: number;
  color: string;
}

interface ComplianceChartProps {
  data: ComplianceData[];
  breakdown?: ComplianceBreakdown;
}

type StatusName = keyof ComplianceBreakdown;

const STATUS_NAMES: StatusName[] = ["Current", "Expiring", "Expired"];

function isStatusName(name: string): name is StatusName {
  return (STATUS_NAMES as string[]).includes(name);
}

const ComplianceChartImpl = dynamic(
  () => import("./compliance-chart-impl").then((m) => ({ default: m.ComplianceChartImpl })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 relative flex items-center justify-center min-h-[200px] animate-pulse">
        <div className="w-[200px] h-[200px] rounded-full border-[20px] border-[#333]" />
      </div>
    ),
  }
);

function formatExpiry(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function BreakdownPanel({
  status,
  color,
  docs,
  pinned,
  onClose,
}: {
  status: StatusName;
  color: string;
  docs: ComplianceDocSummary[];
  pinned: boolean;
  onClose: () => void;
}) {
  // Group docs under their client so the panel answers "which clients" first
  const byClient = useMemo(() => {
    const groups = new Map<string, ComplianceDocSummary[]>();
    for (const doc of docs) {
      const existing = groups.get(doc.clientName);
      if (existing) existing.push(doc);
      else groups.set(doc.clientName, [doc]);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [docs]);

  return (
    <div
      role="region"
      aria-label={`${status} documents by client`}
      className="flex flex-col max-h-[320px] bg-[#161616] border border-white/10 rounded-sm shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="font-mono text-[10px] uppercase tracking-widest text-white">{status}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          {docs.length} {docs.length === 1 ? "doc" : "docs"}
        </span>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close breakdown"
            className="ml-auto font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white px-1"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {byClient.length === 0 ? (
          <div className="py-6 text-center font-mono text-[10px] uppercase tracking-widest text-white/25">
            No documents in this bucket
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {byClient.map(([clientName, clientDocs]) => (
              <div key={clientName}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-xs font-medium text-white/90 truncate">{clientName}</span>
                  <span className="font-mono text-[10px] text-white/30 shrink-0">{clientDocs.length}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {clientDocs.map((doc) => (
                    <div key={doc.id} className="flex items-baseline justify-between gap-3 pl-3">
                      <span className="text-[11px] text-white/50 truncate">{doc.filename}</span>
                      <span className="font-mono text-[10px] text-white/35 uppercase shrink-0">
                        {formatExpiry(doc.expiryDate)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-white/5 shrink-0">
        <Link
          href="/admin/compliance"
          className="font-mono text-[10px] uppercase tracking-widest text-white/50 hover:text-white"
        >
          Open compliance &rarr;
        </Link>
      </div>
    </div>
  );
}

export function ComplianceChart({ data, breakdown }: ComplianceChartProps) {
  const [hovered, setHovered] = useState<StatusName | null>(null);
  const [pinned, setPinned] = useState<StatusName | null>(null);
  const active = pinned ?? hovered;

  // Calculate total and percentage for the center text
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const currentVal = data.find((d) => d.name === "Current")?.value || 0;
  const percentage = total > 0 ? Math.round((currentVal / total) * 100) : 0;

  const handleEnter = (name: string) => {
    if (isStatusName(name)) setHovered(name);
  };

  const clearAll = () => {
    setPinned(null);
    setHovered(null);
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0 relative"
      onMouseLeave={() => setHovered(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") clearAll();
      }}
    >
      <div className="flex-1 relative min-h-0">
        <ComplianceChartImpl
          data={data}
          percentage={percentage}
          activeStatus={active}
          onStatusEnter={handleEnter}
        />
      </div>

      <div className="flex justify-center gap-1 mt-4 font-mono text-[10px]">
        {data.map((entry) => {
          const isActive = active === entry.name;
          return (
            <button
              key={entry.name}
              type="button"
              aria-expanded={isActive}
              onMouseEnter={() => handleEnter(entry.name)}
              onFocus={() => handleEnter(entry.name)}
              onBlur={() => setHovered((h) => (h === entry.name ? null : h))}
              onClick={() =>
                setPinned((p) => (p === entry.name ? null : isStatusName(entry.name) ? entry.name : p))
              }
              className={`flex items-center gap-1.5 px-2 py-1 rounded-sm border transition-colors ${
                isActive
                  ? "border-white/15 bg-white/5 text-white"
                  : "border-transparent text-white/80 hover:text-white"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
              <span className="whitespace-nowrap">
                {entry.name} {entry.value}
              </span>
            </button>
          );
        })}
      </div>

      {active && breakdown && (
        // Dropdown anchored under the legend; pt-2 bridges the hover gap so the
        // pointer can travel from a chip into the panel without it closing.
        <div className="absolute inset-x-0 top-full z-20 pt-2">
          <BreakdownPanel
            status={active}
            color={data.find((d) => d.name === active)?.color || "#888"}
            docs={breakdown[active]}
            pinned={pinned === active}
            onClose={clearAll}
          />
        </div>
      )}
    </div>
  );
}
