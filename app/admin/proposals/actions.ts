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
    // Return a mock response if no key is provided yet
    console.warn("No OPENROUTER_API_KEY found, returning mock draft.")
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

export async function createProposal(data: {
  clientId: string
  servicesJson: any
  scopeText: string
  totalAmount: number
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

    const subtotal = data.totalAmount
    const vat = subtotal * 0.2
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

    // 4. Update the DB row with the storage path and total price
    await adminClient
      .from("proposals")
      .update({ 
        proposal_pdf_path: fileName,
        total_price: data.totalAmount 
      })
      .eq("id", proposal.id)

  } catch (pdfError) {
    console.error("Error generating/uploading PDF:", pdfError)
    // We don't fail the whole creation if PDF fails, but we should log it
    // In a real app we might mark the proposal status as 'Error' or retry
  }
  
  revalidatePath("/admin/proposals")
  return proposal.id
}

export async function updateProposalStatus(
  proposalId: string,
  status: "Draft" | "Sent" | "Signed" | "Contract Issued"
) {
  const { error } = await adminClient
    .from("proposals")
    .update({ status })
    .eq("id", proposalId)

  if (error) {
    console.error("Error updating proposal status:", error)
    throw new Error(error.message)
  }

  revalidatePath("/admin/proposals")
  revalidatePath(`/admin/proposals/${proposalId}`)
}
