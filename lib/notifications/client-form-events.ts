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

/**
 * Record a failed client-surface dispatch to workflow_errors.
 *
 * Every other dispatch caller does this; this one only console.error'd, so these
 * three events failed into the platform logs where nobody looks. The admin
 * Workflow Errors page — Matt's only visibility surface — read "ALL CLEAR" while
 * client form notifications were dropping on the floor. Best-effort and
 * never-throw: an audit-log write must not break the flow it is describing.
 */
async function recordDispatchFailure(
  payload: ClientFormEventPayload,
  error: unknown
): Promise<void> {
  const { logWorkflowFailure } = await import("./../observability/log")
  // logWorkflowFailure writes both surfaces and swallows its own transport
  // failures, so the local try/catch this replaced is no longer needed.
  await logWorkflowFailure({
    workflowName: payload.type,
    error,
    area: `notifications.${payload.type}`,
    source: "job",
    payload: { ...payload },
  })
}

export async function dispatchClientFormEvent(
  payload: ClientFormEventPayload
): Promise<void> {
  try {
    const { dispatchNotification } = await import("./dispatch")
    const result = await dispatchNotification(payload)
    if (!result.ok) {
      await recordDispatchFailure(payload, result.error ?? "unknown dispatch failure")
    }
  } catch (err) {
    // Swallowed to protect the client's flow: the database write they triggered
    // has already committed and must not be undone by a notification failure.
    await recordDispatchFailure(payload, err)
  }
}
