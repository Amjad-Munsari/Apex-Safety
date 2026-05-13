"use server"

import { revalidatePath } from "next/cache"
import { adminClient } from "@/lib/supabase/admin"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "dummy-key",
  headers: {
    "HTTP-Referer": "https://888safety.co.uk", // Optional, for OpenRouter rankings
    "X-Title": "888 Safety Platform", // Optional, for OpenRouter rankings
  }
})

export async function draftProposalScope(services: any[]) {
  if (!process.env.OPENROUTER_API_KEY) {
    // In production the AI draft is non-negotiable per Milestone 2 spec — a
    // silent canned-text fallback shipped real proposals before the gap was
    // caught. Fail loudly so a missing/rotated key is visible immediately
    // (the wizard toasts the error message). In dev/preview keep the canned
    // fallback so contributors without an OpenRouter key can still iterate.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "OPENROUTER_API_KEY is not configured. Set it in the Vercel project env vars and redeploy."
      )
    }
    console.warn("OPENROUTER_API_KEY not set — returning canned draft (dev only).")
    const serviceNames = services.map(s => s.name).join(", ")
    return `888 Safety proposes to deliver comprehensive services including: ${serviceNames}. Our approach ensures full compliance with UK fire safety regulations and includes a detailed site assessment, customized reporting, and priority support. We will work closely with your team to minimize disruption while ensuring the highest standards of safety are met.`
  }

  const prompt = `
    You are an expert fire safety consultant writing a professional "Scope of Work" paragraph for a client proposal.
    The proposal includes the following services:
    ${services.map(s => `- ${s.name}: ${s.description || "No description provided."}`).join("\n")}
    
    Write a cohesive, professional paragraph (approx 3-5 sentences) summarizing what 888 Safety will deliver. 
    Do not use generic placeholders like [Client Name]. Keep it focused on the value and process of the selected services.
    Do not include greetings or sign-offs, just the core paragraph.
  `

  try {
    const { text } = await generateText({
      model: openrouter("openai/gpt-4o-mini"),
      prompt: prompt,
    })

    return text
  } catch (error) {
    console.error("Error generating proposal draft:", error)
    throw new Error("Failed to generate draft. Please try again.")
  }
}

const VAT_RATE = 0.2

export async function createProposal(data: {
  clientId: string
  servicesJson: any
  /** Sum of (unit_price × quantity) across all line items, BEFORE VAT. */
  subtotal: number
  scopeText: string
  /**
   * When true, leave the row at status="Draft" after upload (no sent_at).
   * Used by the "Save as draft" path so the admin can come back later and
   * promote it via the proposal detail page's "Send for signature" button.
   */
  saveAsDraft?: boolean
}) {
  // Insert the proposal record first to get an ID
  const { data: proposal, error } = await adminClient
    .from("proposals")
    .insert([
      {
        client_id: data.clientId,
        services_json: data.servicesJson,
        status: "Draft", // Will update to Sent/Signed later
      },
    ])
    .select()
    .single()

  if (error) {
    console.error("Error creating proposal:", error)
    throw new Error(error.message)
  }

  try {
    // 1. Get Client Name
    const { data: client } = await adminClient.from("clients").select("name, site_address, contact_name").eq("id", data.clientId).single()
    const clientName = client?.name || "Unknown Client"

    // 2. Generate PDF Buffer
    const { generateProposalPdfBuffer } = await import("@/lib/pdf/generator")

    // Map services to match PDF props
    const pdfServices = data.servicesJson.map((s: any) => ({
      name: s.service.name,
      description: s.service.description || "",
      quantity: s.quantity,
      unit_price: s.service.unit_price,
    }))

    const subtotal = data.subtotal
    const vat = subtotal * VAT_RATE
    const total = subtotal + vat

    const pdfBuffer = await generateProposalPdfBuffer({
      clientName,
      clientAddress: client?.site_address || "Address TBD",
      contactName: client?.contact_name || "Contact TBD",
      scopeText: data.scopeText,
      services: pdfServices,
      subtotalAmount: subtotal,
      vatAmount: vat,
      totalAmount: total,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    })

    // 3. Upload to Supabase Storage
    const fileName = `${data.clientId}/proposal_${proposal.id}.pdf`

    const { error: uploadError } = await adminClient
      .storage
      .from("proposals")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      })

    if (uploadError) {
      console.error("Error uploading PDF:", uploadError)
      throw new Error("Failed to upload proposal PDF")
    }

    // 4. Update the DB row with the storage path, VAT-inclusive total, and
    //    (on the Send path) advance status to "Sent" with a sent_at stamp.
    //    "Save as draft" callers leave status="Draft" — the row sits in the
    //    pipeline waiting for the admin to finalise it later.
    const update: Record<string, unknown> = {
      proposal_pdf_path: fileName,
      total_price: total,
    }
    if (!data.saveAsDraft) {
      update.status = "Sent"
      update.sent_at = new Date().toISOString()
    }

    await adminClient
      .from("proposals")
      .update(update)
      .eq("id", proposal.id)

  } catch (pdfError) {
    console.error("Error generating/uploading PDF:", pdfError)
    // We don't fail the whole creation if PDF fails, but we should log it.
    // The row remains status=Draft so the admin can retry from the proposal
    // detail page.
  }
  
  revalidatePath("/admin/proposals")
  return proposal.id
}

/**
 * Hard-delete a proposal row plus its PDF in storage. No soft delete — this
 * surface is admin-only and we don't want orphaned PDFs accumulating in the
 * bucket. Confirmation lives in the UI (AlertDialog on the detail page).
 */
export async function deleteProposal(proposalId: string) {
  // Fetch the storage path first so we can delete the PDF too.
  const { data: row } = await adminClient
    .from("proposals")
    .select("proposal_pdf_path")
    .eq("id", proposalId)
    .maybeSingle()

  const { error } = await adminClient
    .from("proposals")
    .delete()
    .eq("id", proposalId)

  if (error) {
    console.error("Error deleting proposal:", error)
    throw new Error(error.message)
  }

  if (row?.proposal_pdf_path) {
    const { error: rmError } = await adminClient.storage
      .from("proposals")
      .remove([row.proposal_pdf_path])
    if (rmError) {
      // Don't fail the whole delete just because storage cleanup failed —
      // the row is already gone. Log so we can clean orphans later.
      console.error("Failed to remove proposal PDF from storage:", rmError)
    }
  }

  revalidatePath("/admin/proposals")
  revalidatePath("/admin")
}

export async function updateProposalStatus(
  proposalId: string,
  status: "Draft" | "Sent" | "Signed" | "Contract Issued"
) {
  const patch: Record<string, unknown> = { status }
  if (status === "Sent") patch.sent_at = new Date().toISOString()

  const { error } = await adminClient
    .from("proposals")
    .update(patch)
    .eq("id", proposalId)

  if (error) {
    console.error("Error updating proposal status:", error)
    throw new Error(error.message)
  }

  revalidatePath("/admin/proposals")
  revalidatePath(`/admin/proposals/${proposalId}`)
}

/**
 * Stamp `viewed_at` the first time a client opens a proposal.
 * Idempotent: only writes if `viewed_at` is still NULL.
 */
export async function markProposalViewed(proposalId: string) {
  const { error } = await adminClient
    .from("proposals")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", proposalId)
    .is("viewed_at", null)

  if (error) {
    console.error("Error marking proposal viewed:", error)
    // Don't throw — viewing telemetry shouldn't break the page render.
  }
}
