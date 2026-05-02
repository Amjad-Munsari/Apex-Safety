import type { FormSchema } from "@/types/forms"

// Hardcoded FRA template used when no DB-backed template is available (demo + fallback).
// 5 sections, 17 fields. Text/textarea fields render with a mic button via FormRenderer.
// Photo evidence uses `type: "media"` which renders an "Add Photo" tile.
export const HARDCODED_FRA_TEMPLATE: FormSchema = {
  version: 1,
  title: "Fire Risk Assessment (Type 3) — Single Premises",
  description:
    "Complete each section in order. Photographic evidence is required wherever a finding is recorded against a control measure.",
  sections: [
    {
      id: "premises",
      title: "01 — Premises Details",
      description: "Identify the premises and the responsible person.",
      fields: [
        {
          id: "premises_name",
          label: "Premises name",
          type: "text",
          placeholder: "e.g. Hallam House Care Home",
          required: true,
        },
        {
          id: "site_address",
          label: "Site address",
          type: "textarea",
          placeholder: "Full street address including postcode",
          required: true,
        },
        {
          id: "responsible_person",
          label: "Responsible person",
          type: "text",
          placeholder: "Name of duty holder",
          required: true,
        },
        {
          id: "occupancy_type",
          label: "Occupancy type",
          type: "dropdown",
          required: true,
          options: [
            { label: "Care home / sheltered housing", value: "care_home" },
            { label: "HMO / residential", value: "hmo" },
            { label: "Office / commercial", value: "office" },
            { label: "Hospitality", value: "hospitality" },
            { label: "Education", value: "education" },
            { label: "Retail", value: "retail" },
          ],
        },
      ],
    },
    {
      id: "fire_safety_management",
      title: "02 — Fire Safety Management",
      description: "Policies, procedures, and accountability.",
      fields: [
        {
          id: "policy_in_place",
          label: "Is a written fire safety policy in place?",
          type: "dropdown",
          required: true,
          options: [
            { label: "Yes — current and signed", value: "yes_current" },
            { label: "Yes — but out of date", value: "out_of_date" },
            { label: "No", value: "no" },
          ],
        },
        {
          id: "fire_warden_count",
          label: "Number of trained fire wardens",
          type: "text",
          placeholder: "e.g. 4",
        },
        {
          id: "policy_observations",
          label: "Observations on fire safety management",
          type: "textarea",
          placeholder: "Note training gaps, staff awareness, last drill date, etc.",
        },
      ],
    },
    {
      id: "means_of_escape",
      title: "03 — Means of Escape",
      description: "Travel distances, exits, signage, and emergency lighting.",
      fields: [
        {
          id: "escape_routes_clear",
          label: "Are all escape routes clear and unobstructed?",
          type: "dropdown",
          required: true,
          options: [
            { label: "Yes", value: "yes" },
            { label: "Partially — minor obstructions", value: "partial" },
            { label: "No — significant obstructions", value: "no" },
          ],
        },
        {
          id: "exit_signage_findings",
          label: "Exit signage and emergency lighting findings",
          type: "textarea",
          placeholder: "Note any missing or non-compliant signage and lights",
        },
        {
          id: "escape_route_photos",
          label: "Photographic evidence — escape routes",
          type: "media",
          helpText: "Capture each protected route, including final exits.",
        },
      ],
    },
    {
      id: "fire_protection",
      title: "04 — Fire Protection Measures",
      description:
        "Detection, suppression, and compartmentation systems.",
      fields: [
        {
          id: "detection_type",
          label: "Detection system",
          type: "dropdown",
          required: true,
          options: [
            { label: "L1 — full coverage", value: "l1" },
            { label: "L2", value: "l2" },
            { label: "L3", value: "l3" },
            { label: "L4 — escape route only", value: "l4" },
            { label: "None / domestic only", value: "none" },
          ],
        },
        {
          id: "extinguisher_servicing_date",
          label: "Last extinguisher service date",
          type: "text",
          placeholder: "e.g. 14 Feb 2026",
        },
        {
          id: "fire_door_findings",
          label: "Fire door inspection findings",
          type: "textarea",
          placeholder: "Cold smoke seals, intumescent strips, self-closers, gaps...",
        },
        {
          id: "fire_protection_photos",
          label: "Photographic evidence — fire protection",
          type: "media",
          helpText: "Photograph any defects on doors, alarms, or extinguishers.",
        },
      ],
    },
    {
      id: "findings_and_actions",
      title: "05 — Findings & Recommended Actions",
      description: "Capture the overall risk rating and any required remediation.",
      fields: [
        {
          id: "overall_risk_rating",
          label: "Overall risk rating",
          type: "dropdown",
          required: true,
          options: [
            { label: "Low — tolerable", value: "low" },
            { label: "Moderate — review controls", value: "moderate" },
            { label: "Substantial — action required", value: "substantial" },
            { label: "High — immediate action", value: "high" },
          ],
        },
        {
          id: "priority_actions",
          label: "Priority actions",
          type: "textarea",
          placeholder: "List of actions in order of priority with target dates",
          required: true,
        },
        {
          id: "general_observations",
          label: "General observations",
          type: "textarea",
          placeholder: "Anything else noted during the walk-around",
        },
      ],
    },
  ],
}
