import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Contracts feature has no DB backing yet — the list page renders an empty
// state instead of mock fixtures. Any direct URL hit lands here. See
// lib/mock-client-docs.ts removal (code audit 2026-05-29).
export default function ClientContractDetailPage() {
  notFound();
}
