"use client";

import Link from "next/link";
import { ActivePill } from "./active-pill";

export interface ClientRowProps {
  id: string;
  name: string;
  hoursBalance: number | null;
  ragLabel: string;
  ragColor: string;
  nextExpiryLabel: string;
  nextExpiryCategory: string;
  proposalStatus: string | null;
  docCount: number;
  activeCount: number;
  /** Client's active flag — inactive clients get a badge but stay listed. */
  active?: boolean;
}

export function ClientRow({
  id,
  name,
  hoursBalance,
  ragLabel,
  ragColor,
  nextExpiryLabel,
  nextExpiryCategory,
  proposalStatus,
  docCount,
  activeCount,
  active = true,
}: ClientRowProps) {
  // A full-cell <Link> overlay in the first cell carries navigation. Using
  // next/link gives viewport prefetch + useLinkStatus-eligible pending state.
  // The link is absolutely positioned to fill its `relative` cell rather than
  // wrapping the whole <tr>, which previously made cells dead to clicks via a
  // stacking overlay. Inner interactive elements (the ActivePill tooltip
  // trigger) stop propagation so they keep their own behaviour.
  return (
    <tr className="group hover:bg-muted transition-colors cursor-pointer">
      <td className="px-6 py-4 relative">
        <Link
          href={`/admin/clients/${id}`}
          aria-label={`Open ${name}`}
          className="absolute inset-0 z-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-border"
        />
        <div className="flex items-start gap-4 pointer-events-none relative z-10 min-w-0">
          <span className="font-mono text-[10px] text-muted-foreground mt-1 w-10 shrink-0">CL-<br />{id.slice(0, 4).toUpperCase()}</span>
          <div className="min-w-0">
            <div className="font-medium text-foreground mb-0.5 flex items-center min-w-0">
              <span className={`truncate ${active ? "" : "text-foreground/40"}`}>{name}</span>
              {!active && (
                <span className="ml-2 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground bg-muted border border-border leading-none">
                  Inactive
                </span>
              )}
              <span className="pointer-events-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                <ActivePill count={activeCount} />
              </span>
            </div>
            <div className="text-xs text-foreground/40">Client Record</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 border border-${ragColor}/40 rounded text-${ragColor} text-[10px] font-mono uppercase tracking-wider bg-${ragColor}/5 leading-none whitespace-nowrap`}>
          <div className={`w-1.5 h-1.5 rounded-full bg-${ragColor} shrink-0`} /> {ragLabel}
        </div>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-foreground/70 text-center">{hoursBalance}</td>
      <td className="px-4 py-4">
        <div className="text-foreground text-sm mb-0.5 truncate">{nextExpiryLabel}</div>
        <div className="text-xs text-muted-foreground truncate">{nextExpiryCategory}</div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className={`inline-flex whitespace-nowrap px-2.5 py-1 border border-${proposalStatus ? (proposalStatus === "Signed" ? "[#3b8273]" : "gold") : "foreground"}/40 text-${proposalStatus ? (proposalStatus === "Signed" ? "[#3b8273]" : "gold") : "foreground"}/60 text-[10px] font-mono uppercase tracking-wider rounded leading-none`}>
          {proposalStatus ? (proposalStatus === "Contract Issued" ? "Issued" : proposalStatus) : "None"}
        </div>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-center text-muted-foreground">
        {docCount}
      </td>
    </tr>
  );
}
