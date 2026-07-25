# 888 Safety — n8n Admin Notices

**Current contract: 26 July 2026**

n8n sends four operational notices to Matt. It does not send customer transactional email, generate report text, build PDFs, update application records, or back up files. Customer invites, resets, reminders, reports, signing messages, and contracts are rendered by the application and sent through Resend.

The deployed definitions are the source of truth:

- `docs/n8n/workflows/email-notifications.json`
- `docs/n8n/workflows/assessment-report-notifications.json`
- `docs/n8n/workflows/automation-failure-alerts.json`

## Active notices

| Event | Trigger | Admin subject | Required data |
|---|---|---|---|
| `client_form_created` | A client creates an organisation-owned template | `[888] Client created a form template` | `client_id`, `client_name`, `template_id`, `template_name`, `template_type`, `created_at` |
| `client_form_submitted` | A client submits an assigned or self-filled form | `[888] Client submitted a form` | `client_id`, `client_name`, `submission_id`, `submitted_at`; `assignment_id` may be empty for self-fill |
| `client_template_cloned` | A client selects **Customise first** and creates a fork | `[888] Client customised a form template` | `client_id`, `client_name`, `template_id`, `template_name`, `parent_template_id`, `cloned_at` |
| Assessment submitted | Matt submits an admin-led assessment | `[888] New assessment submitted` | `submissionId` |

All four notices go to `888FST@proton.me` through the credential named `Info@ Account`.

## Delivery contract

- Both webhooks require their configured header credential.
- Unknown or incomplete events return `422` with `{ "ok": false, "delivered": false, "error": "invalid_event" }`.
- Gmail is attempted up to three times with a one-second delay.
- A valid request returns `200` with `{ "ok": true, "delivered": true }` only after Gmail accepts the message.
- The application treats any other response, including an empty `200`, as a failure and writes Workflow Errors.
- The shared failure workflow emails Matt when either n8n workflow errors.
- Webhook success and error payloads are not retained in n8n. This avoids storing incoming secrets and client event data; use the controlled inbox plus Workflow Errors for canary confirmation.

## Deploying changes

Run `scripts/n8n/deploy-production.mjs --deploy` only with the owner API key in the process environment. The script resolves credentials by their exact names, updates the two fixed production workflow IDs, updates or creates the failure workflow, activates all three, and rewrites the versioned JSON definitions above.

Never put a webhook secret, API key, invite link, or signing link in this file or any workflow export.

## Controlled production verification

Use `scripts/verify-n8n.ps1` only after both application and n8n secrets have been set to the same values. It sends real email to Matt, so run one event at a time and record:

1. the HTTP status and terminal delivery receipt;
2. the single expected inbox message;
3. whether a related Workflow Error appeared;
4. the test organisation and record reference.

Do not resubmit a client form, recreate a template, or repeat an assessment merely to chase email. The application record is the source of truth, and successful n8n executions are intentionally not retained.
