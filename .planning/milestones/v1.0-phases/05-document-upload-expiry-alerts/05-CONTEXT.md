# Phase 5: Document Upload, Notifications + Expiry Alerts - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Admin-side document upload interface, mock the notification pipelines (SMS and Email) for the upcoming demo, and implement the expiry alert cron logic that updates RAG statuses and sends daily warnings for documents expiring in 30, 14, or 7 days. This connects the Admin inputs to the Client Portal we built in Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Admin Document Upload UI
- **D-01:** We will build a dedicated "Client Details" page (`/admin/clients/[id]`) for Matt to manage a specific client's documents, rather than just a quick-action modal on the main dashboard. This provides a scalable foundation for future client-specific data.

### Notifications & Sign-off
- **D-02:** Notification sign-off will default to "888 Safety" temporarily until Matt provides his explicit preference. This satisfies the blocker for the demo.
- **D-03:** SMS dispatch (via Twilio) will be **mocked** for the demo. The API route `/api/sms/send` will simply log success instead of making an external request to avoid unverified sender ID failures.
- **D-04:** Email dispatch (via n8n) will also be **mocked** for the demo. The application will log the email payload or simulate a local success rather than wiring up a live n8n webhook right now.

### Expiry Alerts
- **D-05:** A daily cron job (simulated or real Vercel cron) will check for documents expiring in exactly 30, 14, or 7 days, and write to `notifications_sent` to ensure idempotency.
</decisions>

<canonical_refs>
## Canonical References

### Architecture & Schema
- `supabase/migrations/001_initial_schema.sql` — defines `documents` and `notifications_sent` tables and RLS constraints.
- `.planning/ROADMAP.md` § Phase 5
- `.planning/REQUIREMENTS.md` § DOCS-01 to DOCS-06, EXPIRY-01 to EXPIRY-07

</canonical_refs>

<code_context>
## Existing Code Insights

- We already have the client portal built (`app/client/compliance`) showing RAG status based on document expiry. Our uploaded documents will feed directly into this UI.
- Storage buckets (`client-documents`) are already provisioned with proper path-prefix RLS policies.
</code_context>

<deferred>
## Deferred Ideas

- Live Twilio and n8n webhook integration is deferred until after the customer demo to ensure maximum reliability.
</deferred>
