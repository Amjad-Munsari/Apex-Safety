"use client";

import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const goToClient = () => router.push(`/admin/clients/${id}`);

  // The whole row is the click target (router.push). Inner interactive
  // elements (the ActivePill tooltip trigger) stop propagation so they keep
  // their own behaviour without also navigating. This replaces the previous
  // `absolute inset-0` overlay <Link>, whose stacking against the static
  // table cells made most of the row dead to real pointer clicks.
  return (
    <tr
      onClick={goToClient}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToClient();
        }
      }}
      className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
    >
      <td className="px-6 py-4">
        <div className="flex items-start gap-4 min-w-0">
          <span className="font-mono text-[10px] text-[#555] mt-1 w-10 shrink-0">CL-<br />{id.slice(0, 4).toUpperCase()}</span>
          <div className="min-w-0">
            <div className="font-medium text-white mb-0.5 flex items-center min-w-0">
              <span className={`truncate ${active ? "" : "text-white/40"}`}>{name}</span>
              {!active && (
                <span className="ml-2 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-sm font-mono text-[9px] uppercase tracking-[0.25em] text-[#888] bg-white/5 border border-white/10 leading-none">
                  Inactive
                </span>
              )}
              <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <ActivePill count={activeCount} />
              </span>
            </div>
            <div className="text-xs text-white/40">Client Record</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 border border-${ragColor}/40 rounded text-${ragColor} text-[10px] font-mono uppercase tracking-wider bg-${ragColor}/5 leading-none whitespace-nowrap`}>
          <div className={`w-1.5 h-1.5 rounded-full bg-${ragColor} shrink-0`} /> {ragLabel}
        </div>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-white/70 text-center">{hoursBalance}h</td>
      <td className="px-4 py-4">
        <div className="text-white text-sm mb-0.5 truncate">{nextExpiryLabel}</div>
        <div className="text-xs text-[#666] truncate">{nextExpiryCategory}</div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className={`inline-flex whitespace-nowrap px-2.5 py-1 border border-${proposalStatus ? (proposalStatus === "Signed" ? "[#3b8273]" : "gold") : "white"}/40 text-${proposalStatus ? (proposalStatus === "Signed" ? "[#3b8273]" : "gold") : "white"}/60 text-[10px] font-mono uppercase tracking-wider rounded leading-none`}>
          {proposalStatus ? (proposalStatus === "Contract Issued" ? "Issued" : proposalStatus) : "None"}
        </div>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-center text-white/50">
        {docCount}
      </td>
    </tr>
  );
}
