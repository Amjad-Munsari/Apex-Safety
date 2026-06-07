import "server-only"

export type NotificationPayload =
  | {
      type: "expiry_alert"
      client_email: string
      client_name: string
      document_name: string
      expiry_date: string
      days_until_expiry: number
    }
  | {
      type: "document_uploaded"
      client_email: string
      client_name: string
      document_name: string
      document_category: string
      expiry_date: string | null
    }
  | {
      type: "assignment_reminder"
      cadence: "7d" | "1d" | "overdue"
      client_email: string
      client_name: string
      template_name: string
      due_date: string           // ISO date yyyy-mm-dd
      assignment_url: string     // absolute URL to /client/assignments/[id]
      instructions: string | null
    }
  | {
      type: "report_ready"
      client_email: string
      client_name: string
      report_url: string         // 7-day signed URL
      assessment_date: string    // en-GB formatted, matches PDF header
      report_storage_path: string // for n8n logging / dedup
    }
  | {
      type: "proposal_signature_request"
      client_name: string
      client_email: string
      proposal_title: string
      signing_url: string        // absolute public URL: ${siteUrl}/sign/${rawToken}
      expiry_date: string        // ISO date the signing link expires
    }
  | {
      type: "proposal_signed"
      client_name: string
      client_email: string
      proposal_title: string
      signed_at: string          // ISO timestamp the client completed signing
    }

export interface DispatchResult {
  ok: boolean
  status?: number
  error?: string
}

export async function dispatchNotification(payload: NotificationPayload): Promise<DispatchResult> {
  console.log("[n8n] dispatch", JSON.stringify({ type: payload.type, payload }))

  const url = process.env.N8N_WEBHOOK_URL
  const secret = process.env.N8N_WEBHOOK_SECRET

  if (!url || !secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "N8N_WEBHOOK_URL / N8N_WEBHOOK_SECRET not configured" }
    }
    console.warn(
      `[n8n] webhook URL or secret missing — dispatch skipped (type: ${payload.type}). Set N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET to enable in dev.`
    )
    return { ok: true, status: 0 }
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": secret,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      return { ok: false, status: res.status, error: `webhook returned ${res.status}` }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
