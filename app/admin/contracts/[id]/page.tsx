import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Contracts feature has no DB backing yet. Admin proposals page used to deep-
// link here for "Contract Issued" proposals via a hardcoded mock id; that
// branch is now removed and points back to the proposal detail. See
// lib/mock-contracts.ts removal (code audit 2026-05-29).
export default function AdminContractDetailPage() {
  notFound();
}
