"use server";

import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase/admin";
import { getClientContext } from "@/lib/auth-helpers";
import { assertClientActive } from "@/lib/clients/require-active";
import { generateSigningToken, hashDocument } from "@/lib/signing";
import { logAppError } from "@/lib/observability/log";

/**
 * Portal entry point into the tokenized signing flow ("Accept & Sign" on the
 * proposal detail page).
 *
 * The shipped e-signature design (migration 020) is link-based: a one-time
 * token whose SHA-256 hash lives in proposals.signing_token, redeemed at
 * /sign/[token]. The email link is dispatched by sendProposalForSignature;
 * this action gives a signed-in client the same flow without needing the
 * email — it mints a fresh token for a proposal their org owns and redirects
 * straight to the signing page.
 *
 * Minting here ROTATES any previously emailed token (one column, single
 * signer — last link wins). status/sent_at are left untouched: the proposal
 * is already "Sent" and the original send timestamp must survive.
 */
export async function beginProposalSigning(proposalId: string): Promise<void> {
  const ctx = await getClientContext();
  if (!ctx?.client_id) throw new Error("Not a client user");

  // Deactivated orgs are write-frozen — signing is a write.
  await assertClientActive(ctx.client_id);

  // Ownership is enforced by the client_id filter — the admin client bypasses
  // RLS, so this query is the trust boundary (same pattern as the detail page).
  const { data, error } = await adminClient
    .from("proposals")
    .select("id, status, proposal_pdf_path, signing_document_hash")
    .eq("id", proposalId)
    .eq("client_id", ctx.client_id)
    .maybeSingle();

  if (error) {
    // A query failure is not "proposal not found" — record it before showing
    // the client the generic message.
    await logAppError({
      area: "client.proposals.begin_signing",
      source: "action",
      error,
      clientId: ctx.client_id,
      context: { proposalId, stage: "load" },
    });
  }
  if (error || !data) throw new Error("Proposal not found");

  const proposal = data as {
    id: string;
    status: string;
    proposal_pdf_path: string | null;
    signing_document_hash: string | null;
  };

  if (proposal.status !== "Sent") {
    throw new Error("This proposal can no longer be signed.");
  }
  if (!proposal.proposal_pdf_path) {
    throw new Error(
      "The proposal document is still being prepared. Please try again shortly."
    );
  }

  const { raw, hash } = generateSigningToken();
  // Keep the hash captured when Matt sent the proposal. Re-entering the
  // signing flow may rotate the link, but must never silently bless different
  // bytes at the same storage path.
  const documentHash =
    proposal.signing_document_hash ??
    (await hashDocument(proposal.proposal_pdf_path));
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: updateError } = await adminClient
    .from("proposals")
    .update({
      signing_token: hash,
      signing_token_expires_at: expiresAt,
      signing_token_used: false,
      signing_document_hash: documentHash,
    })
    .eq("id", proposal.id);

  if (updateError) {
    await logAppError({
      area: "client.proposals.begin_signing",
      source: "action",
      error: updateError,
      clientId: ctx.client_id,
      context: { proposalId, stage: "token_update" },
    });
    throw new Error("Could not start signing. Please try again.");
  }

  redirect(`/sign/${raw}`);
}
