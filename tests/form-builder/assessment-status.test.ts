// Bug #6/#7 — client self-serve submissions must not collapse into "in_progress".
//
// statusForSubmission maps a form_submissions.status lifecycle value onto the
// client-surface display buckets. The discriminator between an admin-led fill
// (Matt still working) and a customer self-serve fill (terminal on submit) is
// assignment_id: NULL => self-serve, non-NULL => admin-led.
//
// Before the fix, status='submitted' always returned "in_progress", which
//   (a) showed "Matt is currently working on this assessment" for self-serve
//       submissions the client had just completed (Bug #6), and
//   (b) left the assessment stuck on "IN PROGRESS" after submit (Bug #7).

import { describe, it, expect } from "vitest";
import { statusForSubmission } from "@/app/client/assessments/status";

describe("statusForSubmission", () => {
  it("maps completed/delivered to 'completed' regardless of assignment", () => {
    expect(statusForSubmission("completed", null)).toBe("completed");
    expect(statusForSubmission("completed", "asg-1")).toBe("completed");
    expect(statusForSubmission("delivered", null)).toBe("completed");
    expect(statusForSubmission("delivered", "asg-1")).toBe("completed");
  });

  it("maps a self-serve submitted fill (assignment_id NULL) to 'submitted'", () => {
    // Customer-built template fill: terminal once the client submits.
    expect(statusForSubmission("submitted", null)).toBe("submitted");
  });

  it("keeps an admin-led submitted fill (assignment_id set) as 'in_progress'", () => {
    // Matt still has the site visit + write-up to do — "working on it" is correct.
    expect(statusForSubmission("submitted", "asg-1")).toBe("in_progress");
  });

  it("maps draft / unknown lifecycle values to 'in_progress'", () => {
    expect(statusForSubmission("draft", null)).toBe("in_progress");
    expect(statusForSubmission("draft", "asg-1")).toBe("in_progress");
    expect(statusForSubmission("draft_ready_for_review", "asg-1")).toBe("in_progress");
  });
});
