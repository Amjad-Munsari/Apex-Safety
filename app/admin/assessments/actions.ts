"use server"

import { createClient } from "@/lib/supabase/server"
import { adminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"

export async function startAssessment(clientId: string, templateVersionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("Unauthorized: Authentication required to start assessment")
  }
  const userId = user.id

  // 1. Fetch template_id
  const { data: templateVersion, error: tvError } = await adminClient
    .from("template_versions")
    .select("template_id")
    .eq("id", templateVersionId)
    .single()
    
  if (tvError || !templateVersion) {
    throw new Error("Failed to fetch template version")
  }
  
  // 2. Insert form_assignment
  const { data: assignment, error: assignError } = await adminClient
    .from("form_assignments")
    .insert({
      client_id: clientId,
      template_id: templateVersion.template_id,
      template_version_id: templateVersionId,
      assigned_by: userId,
      status: "assigned"
    })
    .select()
    .single()
    
  if (assignError || !assignment) {
    throw new Error(`Failed to create assignment: ${assignError?.message || "Unknown error"}`)
  }
  
  // 3. Insert form_submission
  const { data: submission, error: submitError } = await adminClient
    .from("form_submissions")
    .insert({
      assignment_id: assignment.id,
      client_id: clientId,
      template_version_id: templateVersionId,
      answers_json: {},
      submitted_by: userId,
      status: "draft"
    })
    .select()
    .single()
    
  if (submitError || !submission) {
    throw new Error(`Failed to create draft submission: ${submitError?.message || "Unknown error"}`)
  }
  
  redirect(`/admin/assessments/${submission.id}`)
}

export async function autosaveAnswers(submissionId: string, answersJson: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("Unauthorized: Authentication required for autosave")
  }

  const { error } = await supabase
    .from("form_submissions")
    .update({ answers_json: answersJson })
    .eq("id", submissionId)
    .eq("status", "draft")
    .eq("submitted_by", user.id) // Extra safety check
    
  if (error) {
    throw new Error(`Failed to autosave: ${error.message}`)
  }
}

export async function submitAssessment(submissionId: string, finalAnswers: Record<string, unknown>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error("Unauthorized: Authentication required for submission")
  }

  // Update status to submitted
  const { data: submission, error } = await supabase
    .from("form_submissions")
    .update({ 
      answers_json: finalAnswers, 
      status: "submitted",
      submitted_at: new Date().toISOString()
    })
    .eq("id", submissionId)
    .eq("submitted_by", user.id) // Ensure user owns the submission
    .select("client_id")
    .single()
    
  if (error || !submission) {
    throw new Error(`Failed to submit: ${error?.message || "Ownership verification failed"}`)
  }
  
  // Fire and forget webhook
  const webhookUrl = process.env.N8N_ASSESSMENT_WEBHOOK_URL
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
        signal: AbortSignal.timeout(3000)
      })
    } catch (err) {
      console.error("Webhook trigger failed", err)
      // Log error to workflow_errors
      await adminClient.from("workflow_errors").insert({
        workflow_name: "assessment-submission-webhook",
        error_message: String(err),
        payload: { submissionId }
      })
    }
  }
  
  return { clientId: submission.client_id }
}
