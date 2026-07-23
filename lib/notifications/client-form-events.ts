// Two-way form builder — client-surface n8n event dispatch.
//
// Thin, never-throw wrapper around dispatchNotification for the three events
// the client portal fires: client_form_created, client_form_submitted,
// client_template_cloned.
//
// Two deliberate design choices:
//   1. The dispatcher is imported DYNAMICALLY inside a try/catch (not statically
//      at module top). dispatchNotification pulls in "server-only"; importing it
//      lazily keeps this helper safe to `import` from action modules that are
//      exercised in the jsdom test env without every test having to stub
//      "server-only". The type-only import below is erased at runtime.
//   2. A webhook failure must NEVER break the client's create/submit/clone flow.
//      dispatchNotification already swallows transport errors and returns a
//      DispatchResult; we additionally guard the dynamic import so even a load
//      failure degrades to a logged warning. Same non-blocking principle as the
//      report_ready path (D-08): the user's action is the artefact of record,
//      the notification is best-effort.

import type { NotificationPayload } from "./dispatch"

/** The client-surface subset of NotificationPayload. */
export type ClientFormEventPayload = Extract<
  NotificationPayload,
  { type: "client_form_created" | "client_form_submitted" | "client_template_cloned" }
>

export async function dispatchClientFormEvent(
  payload: ClientFormEventPayload
): Promise<void> {
  try {
    const { dispatchNotification } = await import("./dispatch")
    const result = await dispatchNotification(payload)
    if (!result.ok) {
      console.error(`[n8n] ${payload.type} dispatch failed:`, result.error)
    }
  } catch (err) {
    console.error(
      `[n8n] ${payload.type} dispatch threw — swallowed to protect client flow:`,
      err
    )
  }
}
