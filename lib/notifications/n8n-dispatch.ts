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

export interface DispatchResult {
  ok: boolean
  status?: number
  error?: string
}

export async function dispatchNotification(payload: NotificationPayload): Promise<DispatchResult> {
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
