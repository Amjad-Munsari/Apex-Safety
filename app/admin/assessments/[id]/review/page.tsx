import { notFound } from "next/navigation"
import { adminClient } from "@/lib/supabase/admin"
import { ReviewClient } from "./review-client"

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const { data: submission, error } = await adminClient
    .from("form_submissions")
    .select(`*`)
    .eq("id", id)
    .single()
    
  if (error || !submission) {
    notFound()
  }
  
  return <ReviewClient submission={submission} />
}
