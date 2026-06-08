// Pure status-derivation for the client Assessments surface.
//
// Extracted from page.tsx so the mapping can be unit-tested without dragging in
// the server module graph (createClient, RSC components, …). page.tsx,
// [id]/page.tsx and assessments-list.tsx all import from here.

export type AssessmentStatus = "completed" | "submitted" | "in_progress" | "scheduled";

export interface AssessmentRow {
  id: string;
  name: string;
  date: string;
  status: AssessmentStatus;
}

/**
 * Map a form_submissions.status lifecycle value onto the display buckets the
 * client surface shows.
 *
 * The discriminator between an admin-led fill (Matt still has the site visit +
 * write-up to do) and a customer self-serve fill (terminal the moment the
 * client submits) is `assignmentId`:
 *   - NULL      → customer-built template self-fill (D-16). 'submitted' is terminal.
 *   - non-NULL  → admin-assigned fill. 'submitted' means the client handed over
 *                 their info and Matt is now working on it.
 *
 * A submission row only exists once a fill has started, so there is no
 * "scheduled" DB state — that bucket is kept on the type for display
 * completeness but is not produced here.
 */
export function statusForSubmission(
  s: string,
  assignmentId: string | null
): AssessmentStatus {
  if (s === "completed" || s === "delivered") return "completed";
  // Customer self-serve submissions have no admin assignment and are terminal
  // on submit — they must not show "Matt is currently working on this" (Bug #6)
  // nor sit forever on "IN PROGRESS" (Bug #7).
  if (s === "submitted" && assignmentId === null) return "submitted";
  return "in_progress";
}
