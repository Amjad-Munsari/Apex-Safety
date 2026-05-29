// lib/ai/exemplars/yellow-broom-fra.ts
// 888 Safety Solutions — Phase 7 AI Report Pipeline
//
// Provenance: Sanitised condensation of the YELLOW BROOM 2023 Fire Risk
// Assessment. Per 07-CONTEXT §decisions D-02 and §specifics, the real client
// name was replaced with "Acme Properties Ltd" and the real site address with
// "12 Example Street". Hazard structure and recommended-action tone are
// preserved verbatim so the LLM can mimic professional UK FRA register.
//
// Shape: a JSON-stringified object matching `reportSchema` in
// app/admin/assessments/actions.ts (executiveSummary / hazards[] /
// complianceStatus). Loaded once at module init; no I/O, no functions.
// Byte budget: ≤ 2KB to stay well under the gpt-4o-mini context budget
// (asserted by the Plan 07-01 verify gate).

export const YELLOW_BROOM_EXEMPLAR: string = JSON.stringify({
  executiveSummary:
    "Fire Risk Assessment of Acme Properties Ltd at 12 Example Street, a three-storey mixed-use premises with ground-floor retail and two upper residential floors, conducted under the Regulatory Reform (Fire Safety) Order 2005. Arrangements are broadly satisfactory; several findings require remedial action before the next review. Priorities: compartmentation repairs to the second-floor service riser and reinstatement of routine emergency lighting tests on the main escape route. Means of escape, detection coverage and signage are otherwise adequate.",
  hazards: [
    {
      location: "Second-floor service riser cupboard",
      description:
        "Service penetrations through the riser ceiling slab have not been fire-stopped. The 60-minute compartment line between floors 2 and 3 is compromised, allowing potential smoke spread into the residential corridor.",
      severity: "High",
      recommendedAction:
        "Engage a competent passive fire protection contractor to seal all penetrations using a third-party-certificated fire-stopping system rated to the compartment line. Retain installation certificates.",
    },
    {
      location: "Ground-floor main escape corridor",
      description:
        "Two of seven emergency luminaires failed to illuminate during the simulated mains-failure test. Monthly flick tests have not been logged since the last assessment.",
      severity: "Medium",
      recommendedAction:
        "Replace failed luminaires with equivalent self-contained units and reinstate documented monthly function tests plus an annual full-duration discharge test per BS 5266-1.",
    },
    {
      location: "First-floor kitchenette",
      description:
        "A single domestic-grade smoke alarm covers a small staff kitchenette and is not linked to the Grade A fire alarm system serving the rest of the floor.",
      severity: "Low",
      recommendedAction:
        "Replace the domestic alarm with a heat detector wired into the existing addressable fire alarm system to ensure consistent detection coverage and central indication at the panel.",
    },
  ],
  complianceStatus: "Action Required",
});
