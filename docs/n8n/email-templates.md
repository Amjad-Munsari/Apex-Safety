# 888 Safety — n8n email templates

One HTML email per `dispatchNotification` type. Paste the body into the n8n
email (Proton) node for the matching Switch branch, and use the suggested
subject line.

Conventions:
- Field refs assume the webhook payload lands at `$json.body` (matches the
  existing `document_uploaded` template). If your Switch/Set node reshapes it,
  adjust the path.
- Optional fields use an n8n fallback expression, e.g. `{{ $json.body.instructions || '—' }}`,
  so a `null` never renders as the literal text "null".
- Timestamp fields (`signed_at`, `issued_at`, `created_at`, `submitted_at`,
  `cloned_at`) arrive as ISO strings. To show a friendly date, wrap with a
  DateTime expression, e.g. `{{ $json.body.signed_at.toDateTime().format('d LLLL yyyy') }}`.
- CTA buttons are dark (#1a1a1a) to match the minimal house style.

Recipient column tells the email node who to send **To**:
- **Client** → the client contact (`client_email` / `recipient_email`).
- **Admin** → 888 / Matt (e.g. 888FST@proton.me). These are the `client_form_*`
  events; resolve the org name from `client_id` in a Supabase node first.

| Type | Recipient | Subject |
|---|---|---|
| expiry_alert | Client | Action needed: {{ document_name }} expires in {{ days }} days |
| document_uploaded | Client | A new document was added to your portal |
| assignment_reminder | Client | Reminder: {{ template_name }} is due {{ due_date }} |
| report_ready | Client | Your fire risk assessment report is ready |
| proposal_signature_request | Client | Please review and sign: {{ proposal_title }} |
| proposal_signed | Client | We've received your signature — thank you |
| contract_issued | Client | Your service agreement is ready |
| client_portal_invite | Client | You've been invited to the 888 Safety portal |
| client_form_created | Admin | A client created a new form template |
| client_form_submitted | Admin | A client submitted a form |
| client_template_cloned | Admin | A client forked one of your templates |

---

## expiry_alert
**To:** `{{ $json.body.client_email }}` · **Subject:** `Action needed: {{ $json.body.document_name }} expires in {{ $json.body.days_until_expiry }} days`

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Expiry Reminder
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    Hi {{ $json.body.client_name }},
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    A compliance document on your 888 Safety portal is approaching its expiry date.
    Please arrange a renewal to stay compliant.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Document</td><td style="font-size: 13px;">{{ $json.body.document_name }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Expires</td><td style="font-size: 13px;">{{ $json.body.expiry_date }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Days left</td><td style="font-size: 13px;">{{ $json.body.days_until_expiry }}</td></tr>
  </table>
  <p style="font-size: 14px; line-height: 1.6;">
    Reply to this email or contact us and we'll get the renewal booked in.
  </p>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; Matt Robinson, 888 Safety &amp; Training
  </p>
</div>
```

---

## document_uploaded
**To:** `{{ $json.body.client_email }}` · **Subject:** `A new document was added to your portal`

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Document Update
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    Hi {{ $json.body.client_name }},
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    A new document has been added to your 888 Safety compliance portal.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Document</td><td style="font-size: 13px;">{{ $json.body.document_name }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Category</td><td style="font-size: 13px;">{{ $json.body.document_category }}</td></tr>
  </table>
  <p style="font-size: 14px; line-height: 1.6;">
    You can view or download it from your compliance portal at any time.
  </p>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; Matt Robinson, 888 Safety &amp; Training
  </p>
</div>
```

---

## assignment_reminder
**To:** `{{ $json.body.client_email }}` · **Subject:** `Reminder: {{ $json.body.template_name }} is due {{ $json.body.due_date }}`

> Tip: the `cadence` field is `7d` | `1d` | `overdue`. If you want a sharper
> subject for overdue items, branch on `{{ $json.body.cadence }}` before this node.

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Action Required
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    Hi {{ $json.body.client_name }},
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    This is a reminder that a form assigned to you is due for completion.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Form</td><td style="font-size: 13px;">{{ $json.body.template_name }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Due</td><td style="font-size: 13px;">{{ $json.body.due_date }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Notes</td><td style="font-size: 13px;">{{ $json.body.instructions || '—' }}</td></tr>
  </table>
  <a href="{{ $json.body.assignment_url }}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; font-size: 13px; padding: 12px 24px; border-radius: 4px; margin: 8px 0;">
    Complete the form &rarr;
  </a>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; Matt Robinson, 888 Safety &amp; Training
  </p>
</div>
```

---

## report_ready
**To:** `{{ $json.body.client_email }}` · **Subject:** `Your fire risk assessment report is ready`

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Assessment Report
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    Hi {{ $json.body.client_name }},
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    Your fire risk assessment report has been completed and is ready to view.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Assessment date</td><td style="font-size: 13px;">{{ $json.body.assessment_date }}</td></tr>
  </table>
  <a href="{{ $json.body.report_url }}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; font-size: 13px; padding: 12px 24px; border-radius: 4px; margin: 8px 0;">
    Download report (PDF) &rarr;
  </a>
  <p style="font-size: 12px; color: #999; line-height: 1.6; margin-top: 16px;">
    This download link is valid for 7 days. A copy is always available in your
    compliance portal.
  </p>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; Matt Robinson, 888 Safety &amp; Training
  </p>
</div>
```

---

## proposal_signature_request
**To:** `{{ $json.body.client_email }}` · **Subject:** `Please review and sign: {{ $json.body.proposal_title }}`

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Signature Requested
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    Hi {{ $json.body.client_name }},
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    We've prepared a proposal for your review. Please take a look and add your
    signature when you're happy to proceed.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Proposal</td><td style="font-size: 13px;">{{ $json.body.proposal_title }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Sign by</td><td style="font-size: 13px;">{{ $json.body.expiry_date }}</td></tr>
  </table>
  <a href="{{ $json.body.signing_url }}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; font-size: 13px; padding: 12px 24px; border-radius: 4px; margin: 8px 0;">
    Review &amp; sign &rarr;
  </a>
  <p style="font-size: 12px; color: #999; line-height: 1.6; margin-top: 16px;">
    This signing link is personal to you — please don't forward it.
  </p>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; Matt Robinson, 888 Safety &amp; Training
  </p>
</div>
```

---

## proposal_signed
**To:** `{{ $json.body.client_email }}` · **Subject:** `We've received your signature — thank you`

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Signature Received
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    Hi {{ $json.body.client_name }},
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    Thank you &mdash; we've received your signed proposal. Your service agreement
    will follow shortly.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Proposal</td><td style="font-size: 13px;">{{ $json.body.proposal_title }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Signed</td><td style="font-size: 13px;">{{ $json.body.signed_at.toDateTime().format('d LLLL yyyy') }}</td></tr>
  </table>
  <p style="font-size: 14px; line-height: 1.6;">
    No further action is needed from you right now.
  </p>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; Matt Robinson, 888 Safety &amp; Training
  </p>
</div>
```

---

## contract_issued
**To:** `{{ $json.body.client_email }}` · **Subject:** `Your service agreement is ready`

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Service Agreement
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    Hi {{ $json.body.client_name }},
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    Your service agreement has been issued. A copy is attached/linked below and
    is also stored in your portal.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Agreement</td><td style="font-size: 13px;">{{ $json.body.proposal_title }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Issued</td><td style="font-size: 13px;">{{ $json.body.issued_at.toDateTime().format('d LLLL yyyy') }}</td></tr>
  </table>
  <a href="{{ $json.body.contract_url }}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; font-size: 13px; padding: 12px 24px; border-radius: 4px; margin: 8px 0;">
    Download agreement (PDF) &rarr;
  </a>
  <p style="font-size: 12px; color: #999; line-height: 1.6; margin-top: 16px;">
    This download link is valid for 7 days.
  </p>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; Matt Robinson, 888 Safety &amp; Training
  </p>
</div>
```

---

## client_portal_invite
**To:** `{{ $json.body.recipient_email }}` · **Subject:** `You've been invited to the 888 Safety portal`

> Works for both `status: "invited"` and `"resent"`. `client_name` here is the
> **organisation** name; `recipient_name` is the person.

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Portal Access
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    Hi {{ $json.body.recipient_name }},
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    You've been invited to access the 888 Safety compliance portal for
    <strong>{{ $json.body.client_name }}</strong>. Click below to set your
    password and sign in.
  </p>
  <a href="{{ $json.body.invite_url }}" style="display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none; font-size: 13px; padding: 12px 24px; border-radius: 4px; margin: 16px 0;">
    Set your password &rarr;
  </a>
  <p style="font-size: 12px; color: #999; line-height: 1.6; margin-top: 16px;">
    This link is single-use and personal to you. If you didn't expect this
    invitation, you can ignore this email.
  </p>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; Matt Robinson, 888 Safety &amp; Training
  </p>
</div>
```

---

## client_form_created  *(admin-facing)*
**To:** 888 / Matt · **Subject:** `A client created a new form template`

> Payload carries only `client_id` + template fields. Resolve the org name in a
> Supabase node (e.g. `SELECT name FROM clients WHERE id = client_id`) and
> reference it below as `{{ $json.client_name }}` — adjust the path to your node.

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Platform Activity
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    A client built a new form
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    A customer has created a new form template from scratch in the builder.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Client</td><td style="font-size: 13px;">{{ $json.client_name }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Template</td><td style="font-size: 13px;">{{ $json.body.template_name }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Type</td><td style="font-size: 13px;">{{ $json.body.template_type }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Created</td><td style="font-size: 13px;">{{ $json.body.created_at.toDateTime().format('d LLLL yyyy, HH:mm') }}</td></tr>
  </table>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; 888 Safety Platform
  </p>
</div>
```

---

## client_form_submitted  *(admin-facing)*
**To:** 888 / Matt · **Subject:** `A client submitted a form`

> Only IDs in the payload. Resolve the org name (and, if you want it, the form
> name via `submission_id`) in a Supabase node and reference as `{{ $json.client_name }}`.

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Platform Activity
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    A client submitted a form
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    A customer has completed and submitted a form. Review it in the admin queue.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Client</td><td style="font-size: 13px;">{{ $json.client_name }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Submission</td><td style="font-size: 13px;">{{ $json.body.submission_id }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Assignment</td><td style="font-size: 13px;">{{ $json.body.assignment_id || 'Self-fill (no assignment)' }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Submitted</td><td style="font-size: 13px;">{{ $json.body.submitted_at.toDateTime().format('d LLLL yyyy, HH:mm') }}</td></tr>
  </table>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; 888 Safety Platform
  </p>
</div>
```

---

## client_template_cloned  *(admin-facing)*
**To:** 888 / Matt · **Subject:** `A client forked one of your templates`

> Resolve the org name from `client_id` in a Supabase node → `{{ $json.client_name }}`.

```html
<div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
  <p style="font-family: monospace; font-size: 11px; letter-spacing: 0.2em; color: #888; text-transform: uppercase; margin-bottom: 24px;">
    888 Safety &middot; Platform Activity
  </p>
  <h1 style="font-family: Georgia, serif; font-size: 24px; font-weight: 500; margin: 0 0 16px 0;">
    A client forked a template
  </h1>
  <p style="font-size: 14px; line-height: 1.6;">
    A customer has cloned one of your master templates into their own version.
    Your master is unchanged.
  </p>
  <table style="margin: 24px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Client</td><td style="font-size: 13px;">{{ $json.client_name }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Their version</td><td style="font-size: 13px;">{{ $json.body.template_name }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">Forked from</td><td style="font-size: 13px;">{{ $json.body.parent_template_id }}</td></tr>
    <tr><td style="padding: 6px 16px 6px 0; font-size: 12px; color: #666;">When</td><td style="font-size: 13px;">{{ $json.body.cloned_at.toDateTime().format('d LLLL yyyy, HH:mm') }}</td></tr>
  </table>
  <p style="font-size: 13px; color: #666; margin-top: 32px;">
    &mdash; 888 Safety Platform
  </p>
</div>
```
