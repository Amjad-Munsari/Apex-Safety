/**
 * Human-friendly descriptions for workflow_errors rows.
 *
 * The DB stores a machine `workflow_name` (e.g. "report_delivery_email") and a
 * raw technical `error_message` (e.g. "webhook returned 404"). Neither is
 * meaningful to Matt. This maps the known workflow names to a plain-English
 * title + a short explanation of what failed and what it means in practice.
 *
 * Keep the keys in sync with the `workflow_name` values written across the app
 * (search the codebase for `workflow_name:`).
 */

export type FriendlyError = {
  /** Short, plain-English headline of what failed. */
  title: string;
  /** One sentence: what didn't happen and the real-world impact. */
  message: string;
};

const FRIENDLY: Record<string, FriendlyError> = {
  report_delivery_email: {
    title: "Report email didn't send",
    message: "A finished report couldn't be emailed to the client, so they haven't received it yet.",
  },
  ai_report_draft: {
    title: "Report draft didn't generate",
    message: "The automatic draft for an assessment failed to generate. You can open the assessment and try again.",
  },
  "assessment-submission-webhook": {
    title: "Assessment didn't sync",
    message: "A submitted assessment couldn't be sent on for processing.",
  },
  assignment_reminder: {
    title: "Reminder didn't send",
    message: "A scheduled reminder to a client didn't go out.",
  },
  expiry_alert: {
    title: "Expiry alert didn't send",
    message: "An automatic document-expiry alert to a client failed to send.",
  },
  expiry_alert_manual: {
    title: "Expiry alert didn't send",
    message: "A document-expiry alert you triggered manually failed to send.",
  },
  document_uploaded: {
    title: "Upload notification didn't send",
    message: "The notification for a newly uploaded document didn't send. The document itself was saved safely.",
  },
};

/**
 * Returns a friendly title + message for a workflow error. Falls back to a
 * tidied-up version of the raw workflow name for any unmapped workflow.
 */
export function describeWorkflowError(workflowName: string): FriendlyError {
  const known = FRIENDLY[workflowName];
  if (known) return known;

  const tidied = workflowName
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${tidied} didn't complete`,
    message: "An automated task didn't finish as expected.",
  };
}
