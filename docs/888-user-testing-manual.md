# 888 Safety & Training

## User Guide and Testing Manual

**First full draft — updated 26 July 2026**

This manual describes the source and production state checked on 25–26 July 2026. It is suitable for controlled testing, but the production account is not ready for normal client work until the setup and dependency items in Part 1 are completed. Database safeguards through migration 034 are applied in production.

# Part 1 — Overview

## What the platform does

The platform gives Matt one place to manage clients, compliance documents, assessments, reports, proposals, contracts, credits, and approved contractors. Each client gets a separate portal where its people can see their own records, complete assigned forms, build templates, sign proposals, and download completed documents.

## Who uses it

| Role | Person | What they do |
|---|---|---|
| Admin / consultant | Matt Robinson | Manages clients, creates templates, carries out assessments, reviews report drafts, issues proposals and contracts, adjusts credits, and watches reminders and errors. |
| Client | Building owner or facilities manager. The intended QA identity is Sarah Whitfield, Facilities Manager, Hallam House Care Home. | Reviews the organisation's documents, completes forms, builds or adapts templates, signs proposals, downloads contracts and reports, checks credits, and finds approved contractors. |

## The modules at a glance

| Module | What it replaces | What you get |
|---|---|---|
| Dashboard | Separate client lists, expiry notes, and work queues | One current view of clients, compliance, report reviews, proposals, credits, and failures |
| Clients | Contact spreadsheets and scattered client folders | One organisation record with contacts, documents, work, agreements, credits, and portal access |
| Compliance | Certificate folders and manual expiry diaries | Stored documents, red/amber/green status, reminders, and client downloads |
| Assessments and forms | Paper forms and fixed questionnaires | Versioned forms that Matt or the client can complete |
| Report generation | Copying assessment notes into a report | A draft prepared from submitted answers, followed by Matt's review and a final PDF |
| Proposals and contracts | Word quotes, email attachments, and separate signing tools | Service selection, pricing, PDF, signing link, signature record, and service agreement |
| Billing and credits | A separate retained-time ledger | Whole-credit balance, manual adjustments, purchase history, and a PayPal checkout path |
| Templates | Rebuilding the same form for each client | Matt-owned masters plus client-owned forms and forks |
| Service catalogue | Re-entering service descriptions and prices | Reusable proposal line items |
| Contractor Directory | An informal contact list | A list Matt controls and clients can browse |
| Notifications | Manual reminder emails | Automated expiry, assignment, report, proposal, contract, invite, and reset emails |
| Workflow Errors | Searching logs or waiting for a complaint | A visible list of failures that the platform recorded |

## Logging in

Use the production address:

`https://www.merlinsafetysystem.com`

| Person | Sign-in page | Current account | Password |
|---|---|---|---|
| Matt | `/login/admin` | `mathew.robinson@888safetyandtraining.com` | **UNVERIFIED.** Use Matt's current password or **Forgot?** to set a new one. |
| Sarah / client tester | `/login` | **No current Sarah account exists in production.** | **UNVERIFIED.** Matt must create Hallam House, invite Sarah, and let her set a password first. |

The two forms use the same account system, but each form checks the person's role after the password is accepted. If a client uses the operator form, or Matt uses the client form, the platform signs that session back out and tells the person which sign-in page to use. Someone who is already signed in and opens a login page is sent to the correct area automatically.

The repository also contains `admin@test.com` seed metadata and a non-production helper for `user@test.com`. The 25 July production check confirms that neither authentication account exists there. The helper refuses to run unless someone explicitly enables it and supplies a password of at least 16 characters. These are setup fixtures, not handover credentials; delete or rotate every temporary account and password before go-live.

## Where everything lives

### Matt's admin console

| Section | Route | What's there |
|---|---|---|
| Dashboard | `/admin` | Today's work, clients, expiries, report reviews, proposal totals, credits, and recent errors |
| Clients | `/admin/clients` | All active and inactive client organisations |
| Client record | `/admin/clients/[client ID]` | Contacts, documents, compliance, assessments, reports, proposals, credits, assigned forms, and access |
| Compliance | `/admin/compliance` | All documents split by current, expiring, expired, and no-expiry status |
| Upcoming expiries | `/admin/expiries` | Expiring and overdue documents with manual reminders |
| New assessment | `/admin/assessments/new` | Start an assessment for a client |
| Assessment form | `/admin/assessments/[assessment ID]` | Complete or resume an assessment |
| Saved answers | `/admin/assessments/[assessment ID]/view` | Read-only source answers |
| Report review | `/admin/assessments/[assessment ID]/review` | Check and edit the draft before producing the final PDF |
| Review queue | `/admin/review-queue` | Reports waiting for review and completed reports |
| Assigned forms | `/admin/assignments` | Pending, in-progress, and completed client assignments |
| Proposals | `/admin/proposals` | Draft, Sent, Signed, and Issued pipeline |
| New proposal | `/admin/proposals/new` | Select a client, services, prices, and scope |
| Proposal detail | `/admin/proposals/[proposal ID]` | Proposal PDF, status actions, services, and issued contract |
| Credit overview | `/admin/hours` | All client credit balances; the route keeps its old name |
| Month Summary | `/admin/month-summary` | This month's assessments, uploads, proposals, and errors |
| Form Templates | `/admin/templates` | Matt's master templates and read-only client templates |
| Template builder | `/admin/templates/[template ID]` | Build, save, publish, and assign a Matt-owned template |
| Service Catalog | `/admin/services` | Proposal services, descriptions, units, prices, and active status |
| Contractors | `/admin/directory` | Add, edit, hide, or delete approved contractors |
| Notifications | `/admin/notifications` | Successful expiry-reminder history only |
| Settings | `/admin/settings` | Logo, colours, reminders, email labels, credits rate, theme, and diagnostics |
| Workflow Errors | `/admin/errors` | The latest recorded failures |

Some working pages are reached from dashboard cards or client records rather than the left sidebar. A missing sidebar link does not mean the route is missing.

### Client portal

| Section | Route | What's there |
|---|---|---|
| Dashboard | `/client` | Compliance position, urgent documents, and credit balance |
| Compliance | `/client/compliance` | The organisation's compliance documents |
| Reports | `/client/reports` | Reports in review, failed drafts, and final PDFs |
| Assessments | `/client/assignments` | Assigned forms to start, resume, or review |
| Assignment start | `/client/assignments/[assignment ID]` | Instructions and Fill as-is / Customise first |
| Assignment form | `/client/assignments/[assignment ID]/fill` | The live form |
| Submitted answers | `/client/assignments/[assignment ID]/submission` | Read-only submitted answers |
| Templates | `/client/templates` | Forms owned by the client's organisation |
| Template builder | `/client/templates/[template ID]` | Build, save, and publish an organisation-owned form |
| Template fill | `/client/templates/[template ID]/fill` | Fill the client's own published template |
| Proposals | `/client/proposals` | Sent, signed, and issued proposals |
| Proposal detail | `/client/proposals/[proposal ID]` | View/download and sign a proposal |
| Contracts | `/client/contracts` | Issued service-agreement PDFs |
| Contract detail | `/client/contracts/[contract ID]` | Tenant-scoped agreement preview, services, total, and download |
| Directory | `/client/directory` | Active approved contractors |
| Billing | `/client/billing` | Credit balance, ledger, and PayPal packages |

The separate `/client/assessments` history also exists, but it overlaps with the Forms → Assessments area and is not the main navigation destination.

## Current state — read this first

This is a controlled-testing build, not a normal go-live account. The core application is real and reads live records, but production currently contains Matt's operator account and no clients, master templates, service catalogue, contractors, or proposals.

**Ready for controlled testing**

- Client records, invitations, password setup, and role separation are working.
- Admin and client dashboards use live organisation data.
- Compliance upload, status, download, and catch-up reminders are working.
- Matt and clients can build templates; clients can fork a master without changing Matt's original.
- Assigned forms, resumable drafts, validation, recurrence, and reminders are working.
- Report drafting, Matt's review step, final PDF creation, storage, email delivery, and client download are working when the AI service is available.
- Proposal creation, first-party signing, separate original/signed PDFs, and contract generation are implemented.
- Online signing now verifies the exact original PDF and commits the single-use token, Signed status, signed-file link, hashes, and evidence row together.
- Issued contracts have both a client list and a tenant-scoped detail page.
- Credits are the stored balance unit. The editable default reference rate is four credits per hour.
- The previously open payment-credit permission fault has been fixed and checked in production.
- Portal brand colours are stored centrally and follow Matt and clients across devices.
- The audited application dependency is upgraded to 16.2.11; the production build, 701 runnable tests, automation-change lint, and production dependency audit pass.

**Partial or held**

- PayPal cannot complete a purchase because the current production credentials are invalid. Do not test with real money until the correct live credentials are supplied and a controlled purchase plan is agreed.
- Email delivery is live and owner-confirmed as working. The system still has no complete sent-message outbox or automatic retry for every failed message, so use Workflow Errors and the recipient's inbox when investigating an individual send.
- The partner workflows have been rebuilt. Both incoming routes are protected; events are checked before sending; email is retried up to three times; success is returned only after the admin message is accepted; and a separate failure workflow alerts Matt. The assessment and failure-alert canaries passed. The matching production secrets and the three client-activity canaries are the remaining release gate.
- The sole n8n account does not have MFA enabled, two unused mail credentials remain stored there, and n8n reports one available bug-fix update. The audit key was shared in chat, and two historical failures still expose the old general webhook secret to that key. Rotate both, delete only those two historical records, and confirm ownership before removing either unused mail credential. These are partner-account hardening tasks, separate from the working customer email service.
- Client-assigned and client-owned form submissions start the same report-drafting process as Matt's submissions.
- A proposal PDF failure leaves the recoverable Draft and shows an error. A signature-email failure creates a Workflow Error and warns Matt; the proposal still says Sent and there is no automatic retry.
- Saved photos reload after refresh using temporary private previews, and Remove deletes the stored file and audit row. A Photos field marked Required still behaves as recommended and does not block submission.
- New Client accepts a site address and the client record has Edit details for organisation and primary-contact fields. Job title is still not stored, so “Facilities Manager” remains part of Sarah's QA persona only.
- Client Compliance, Reports, Proposals, Assignments, Assessments, Templates, Contracts, Billing, and Directory show a visible load error instead of pretending a failed query returned no records.
- Settings colours apply to both portals on every device, but generated PDF colours remain fixed.
- Saved sender and sign-off labels are staged for a future email-brand cutover. The real Resend From name and email brand still come from deployment settings, and the page now says so.
- Public contact details are inconsistent: the client footer shows `0161 552 0918`, while generated PDFs show `0114 555 0188`; email also defaults to the Merlin name unless its deployment setting is changed. Agree one public identity before handover.
- The current risk-score matrix still needs Matt's professional approval. Do not treat the computed wording as approved fire-safety guidance yet.
- Password reset is limited to three requests per account and 20 per source address each hour; the application change and migration 030 are live.
- Repository-wide lint still reports pre-existing issues in vendored developer tooling and older untouched files. The files changed for this release are lint-clean.

**Not built**

- Speech-to-text or dictation.
- SMS notifications.
- Offline use, installable app behaviour, or background syncing.
- Automatic payment receipt or VAT invoice.
- Retry or Resolve buttons in Workflow Errors.

## Pending dependencies

| Dependency | What it unlocks | Status |
|---|---|---|
| Matt's approved FRA/site-risk questions | A real master assessment that can be assigned | Required; no production templates |
| Matt's approved risk matrix and wording | Safe use of the Computed field | Required |
| Matt-approved service names and current prices | Proposal creation | Required; catalogue deliberately not loaded |
| Job-title storage decision | Store a contact role such as “Facilities Manager” | Not modelled; site address and profile editing are live |
| Valid PayPal Live Client ID and fresh secret | Real credit purchase | Blocked outside the platform |
| Controlled live-payment plan | A real-money QA purchase and reversal/price restoration | Not agreed |
| One public brand, phone number, sender, and monitored reply mailbox | Consistent portal, PDF, and email identity | Delivery works; identity is inconsistent |
| Deploy the two matching platform secrets and run one controlled test for each of the four admin notices | Working client activity and Matt-submitted assessment notices | Workflows rebuilt; assessment and failure-alert tests passed; production application cutover pending |
| Rotate the n8n audit key and old general webhook secret, delete only the two historical failures after cutover, enable MFA, remove unused mail credentials after ownership confirmation, and take the available bug-fix update | Reduce partner-automation account and credential exposure | Required before handover |
| Approved first-party signing approach | Formal acceptance of the in-app signature method | Unverified |
| Upload/report recipient rule | Predictable document-upload and final-report recipient; expiry reminders already use the organisation contact | Partially built |
| Speech-to-text choice and build | Dictation during site work | Not built |
| SMS and offline scope decision | Text alerts and offline field work | Not built |
| Privacy, processor, retention, and access decisions | Responsible handling of assessment data | Unverified |

# Part 2 — Module Guide

**Matt's admin modules**

## Dashboard

### What it does

The dashboard gathers Matt's live clients, overdue and expiring documents, report drafts, proposal activity, credits, and recent failures.

### How it works

Counts and lists are read when the page opens. “Items need you today” combines overdue documents and report drafts waiting for review; it is not a general health score.

### Your daily workflow

**Matt:** Open Dashboard, check Workflow errors first, then Drafts to review and Overdue docs. Open the relevant client or report card rather than relying on the count alone.

### What's live vs. what's pending

**Live:** current records and work queues. **Pending:** the greeting always says Matt even if another operator is added, and a zero count does not prove an external email or partner workflow succeeded.

### Common situations

- If a count differs from a list, refresh once and open the source section.
- If the page says there is work but no card appears, check Workflow Errors and the full Compliance or Review Queue page.
- A newly submitted form is not counted as a draft while the background drafting step is still running. It should then move to Awaiting Review or AI Draft Failed.

### Where to find things

`/admin`, with deeper links to Clients, Compliance, Review Queue, Proposals, Month Summary, and Workflow Errors.

## Clients

### What it does

Clients holds one record per organisation, including contacts, documents, assessments, reports, proposals, credits, assigned forms, and portal access.

### How it works

Creating a client saves the organisation, primary contact, email, optional phone, and optional site address, then tries to send that contact an owner invitation. Edit details can correct those fields later. Job title is not stored. Deactivating a client keeps its history but stops new uploads, proposals, assessments, form work, balance changes, and invites. Deleting a client removes its related data and portal users and cannot be undone.

### Your daily workflow

**Matt:** Create the organisation, confirm the contact email, open Access, send or copy the invite link, and verify that the person can sign in before assigning work.

### What's live vs. what's pending

**Live:** organisation, primary contact, site address, Edit details, access, deactivate, and delete flows. **Pending:** job title is not modelled, and production is empty, so Hallam House and Sarah must be created for QA.

### Common situations

- If email delivery fails, the client record can still exist. Copy the returned invite link and send it through an agreed safe channel.
- If the client is deactivated, existing records remain visible but new work is blocked.
- Delete only throwaway QA clients. There is no restore.

### Where to find things

Clients in the left sidebar, then select an organisation. Use the Access tab for invitations and the Credits tab for the ledger.

## Compliance

### What it does

Compliance stores client certificates and other evidence, assigns an optional expiry date, shows current/expiring/expired status, and gives the client short-lived view or download links.

### How it works

Matt uploads a PDF or image up to 25 MB, chooses a category, and may set an expiry date. The platform saves the file and record, optionally emails the client, and checks the expiry range every morning. Failed reminders are recorded and retried.

### Your daily workflow

**Matt:** Upload the document, confirm the client and expiry date, then open the client record or Compliance list to check its status. Use Upcoming Expiries for manual follow-up.

### What's live vs. what's pending

**Live:** upload, file-header validation, delete, status, download, email delivery, daily 30/14/7/expired reminders, and admin digest. Expiry reminders use the organisation's saved primary contact. **Pending:** upload notices still need an agreed recipient rule when an organisation has several portal users.

### Common situations

- The threshold uses the UK calendar date: today or earlier is Expired, 1–30 days ahead is Expiring, and more than 30 days ahead is Current.
- A document without a date appears under No Expiry Date for Matt, but the client dashboard counts it as Current.
- A successful upload can still have a failed email; check Workflow Errors.

### Where to find things

`/admin/compliance`, `/admin/expiries`, or the Documents and Compliance tabs inside a client record.

## Assessments and forms

### What it does

Matt can start and complete an assessment, or assign a published form for the client to complete. The form stays tied to the version chosen at the start.

### How it works

Starting an assessment creates a draft. Required and conditional fields are checked when any form is submitted. Matt can submit his own assessment, and a client can fill the assigned version, customise it first, or self-fill a client-owned template. Every committed submission enters the same report-drafting process.

### Your daily workflow

**Matt:** Choose an active client and published template, complete the form on desktop or tablet, review required-field warnings, and submit only when the answers are ready for report drafting.

**Client:** Open Forms → Assessments, read the instructions, choose Fill as-is or Customise first, complete the form, and submit.

### What's live vs. what's pending

**Live:** typed answers, numbers, dates, choices, photos, location, computed score, repeating sections, conditions, autosave/resume, assignment reminders, recurrence, fork-on-fill, client-submission report handoff, private photo previews, and complete photo removal. **Staged admin notices:** the four partner workflows are rebuilt and protected; the remaining gate is the production secret cutover and the three client-activity canaries. **Not built:** speech-to-text and offline work.

### Common situations

- A revoked assignment cannot be reopened.
- A completed assignment cannot be edited.
- A second submit is rejected instead of creating a duplicate.
- A completed client assignment should move through drafting and appear in Review Queue or AI Draft Failed. It may remain Submitted briefly while the background step runs.
- The client-form partner notice is only an internal activity email to Matt. It does not generate the report, change the submission, contact the client, or back up files.
- A Photos field marked Required is shown as recommended and does not block submission.
- The review panel is labelled Raw Answers. There is no speech recording.

### Where to find things

Use **+ New Assessment**, a template's **Assign to clients** action, `/admin/assignments`, or the Assigned Forms tab inside a client record.

## Report generation

### What it does

Report generation turns submitted answers into an editable draft, then produces the final client PDF only after Matt approves it.

### How it works

The drafting service reads the submitted answers and prepares a structured summary, compliance status, and hazards. Matt can compare it with the raw answers, change every section, or regenerate. **Approve & Generate PDF** is the commit point: it creates the final PDF, marks the report completed, and tries to email the client.

### Your daily workflow

**Matt:** Open Review Queue, read the raw answers, check every claim in the draft, correct the summary, status, hazards, severity, and actions, then approve. Do not use the AI draft as professional advice without checking it.

### What's live vs. what's pending

**Live:** draft, retry, edit, final PDF, private storage, client download, and delivery-error logging. **Pending:** sparse forms can produce invented detail, and the risk matrix still needs professional approval.

### Common situations

- **AI Draft Failed:** open Workflow Errors, correct any service/configuration fault, then select Retry Draft.
- **Report saved, but the delivery email failed:** the PDF is final and available in the portal, but no automatic retry is queued. Contact the client and resolve the delivery fault.
- You can read and edit the draft without approving it.

### Where to find things

Dashboard → Drafts to review, `/admin/review-queue`, or the Reports tab in a client record.

## Proposals

### What it does

Proposals combines client details, catalogue services, quantities, prices, scope wording, VAT, PDF generation, sending, and status tracking.

### How it works

Matt selects an active client and services. He can write the scope or ask the drafting service for a starting paragraph. The platform calculates line totals and 20% VAT on the server, creates the PDF, and either saves a Draft or sends a signing link.

### Your daily workflow

**Matt:** Confirm the client contact email and service prices, review the scope, save as Draft if uncertain, open the generated PDF, and only then send for signature.

### What's live vs. what's pending

**Live:** Draft/Sent/Signed/Issued pipeline, catalogue lines, custom price where needed, VAT, PDF, signing link, visible PDF failures, and a warning plus Workflow Error when a signature email fails. **Partial:** delivery failure does not change Sent and there is no automatic retry.

### Common situations

- **Generate the proposal PDF before sending:** use Generate PDF on the detail page.
- **Client has no contact email:** correct the client record first.
- If PDF generation fails, the Draft is retained for retry and the builder should show the failure. Open every completed PDF anyway before sending.
- Edit from a sent proposal starts a new proposal for that client; it does not edit the document already sent.

### Where to find things

Proposals in the sidebar, **+ New Proposal**, and the Proposals tab in a client record.

## Signing

### What it does

Signing gives the client a 30-day, single-use proposal link and records the signer, email, drawn or typed signature, time, network/browser information, and document fingerprint.

### How it works

The client opens the link, reviews the proposal, enters name and email, draws or types a signature, accepts the terms, and submits. The original proposal remains unchanged; a separate signed copy is created when stamping succeeds.

### Your daily workflow

**Matt:** Confirm the client received the link, watch the proposal move to Signed, and open the signed PDF. Use Mark as signed only for a genuine paper/email acceptance and keep the outside evidence.

**Client:** Read the proposal and PDF, enter your own details, sign, accept the terms, and submit once.

### What's live vs. what's pending

**Live:** single-use/expiry controls, exact-original verification, first-party signature pad, atomic evidence commit, separate content-addressed signed copy, and automatic contract attempt. **Pending:** Matt and Finley must formally accept the first-party signing approach.

### Common situations

- **Link expired:** Matt must send a new signing link.
- **Already signed:** the link has been used and cannot be reused.
- If the original cannot be verified or the stamped copy cannot be stored, signing does not commit and the token remains unused. Report the error before retrying.
- Once a proposal is Sent, its client, service lines, total, original PDF, and recorded original fingerprint cannot be materially changed.

### Where to find things

The client receives `/sign/[private token]`. Matt manages the record from `/admin/proposals/[proposal ID]`.

## Contracts

### What it does

Contracts creates a service-agreement PDF from a signed proposal and places it in Matt's proposal detail, the client's Contracts list, and a tenant-scoped detail page.

### How it works

Online signing attempts contract issue automatically. If that fails, Matt can use **Issue contract** on a Signed proposal. The agreement includes the selected services, totals, VAT, signer, and dates.

### Your daily workflow

**Matt:** After signing, confirm the proposal says Issued and open the Service agreement PDF. If it remains Signed, check Workflow Errors and select Issue contract.

### What's live vs. what's pending

**Live:** PDF generation, Issued status, list, detail preview, download, and contract email.

### Common situations

- Contract issue is blocked until the proposal is Signed.
- If the contract email fails, the PDF can still be present in the portal.

### Where to find things

Matt: proposal detail. Client: Agreements → Contracts, then select the agreement.

## Billing and credits

### What it does

Billing shows the organisation's whole-credit balance and ledger. Matt can adjust it; clients can see three PayPal packages.

### How it works

The default reference is four credits per hour, used only to help Matt convert when adjusting a balance. Changing that rate does not recalculate old balances. PayPal packages are 20 credits for £495, 40 for £950, and 80 for £1,800.

### Your daily workflow

**Matt:** Open the client Credits tab, choose credits or hours as the input aid, check the resulting whole-credit change, and submit. Add a business note outside the platform if the reason needs more detail; the current ledger labels only manual top-up or deduction.

**Client:** Open Billing to see the balance and movements. Do not attempt a real purchase until the PayPal dependency is cleared.

### What's live vs. what's pending

**Live:** stored credits, atomic manual adjustment, overdraft protection, ledger, package and capture logic. **Held:** current PayPal credentials fail. **Not built:** receipt or invoice email.

### Common situations

- A deduction cannot take the balance below zero.
- Deactivated clients cannot receive a manual balance change.
- If PayPal took payment but the balance did not move during a future test, keep the return page open, retry, and escalate with the order reference. The capture path is designed to avoid double credit.

### Where to find things

Client record → Credits, `/admin/hours`, and Client → Billing.

## Form Templates and builder

### What it does

Matt builds reusable masters. Clients can build their own forms or create a fork while filling an assigned master.

### How it works

Every Save draft and Publish creates a new version. Assignments use a published version and keep using that version even after the template changes. Matt can inspect client-owned templates but cannot edit, publish, delete, or assign them.

### Your daily workflow

**Matt:** Create a clearly named template, add fields, preview conditions, Save draft, test it, then Publish. Assign only the published version.

**Client:** Use Templates to create an organisation-owned form, or select Customise first on an assignment. Publish before self-filling.

### What's live vs. what's pending

**Live:** 11 field types, conditions, append-only version history, published/referenced-version protection, publishing, assignment, customer ownership, fork-on-fill, soft deletion, and self-fill. **Pending:** no production master exists.

### Common situations

- A Draft is not assignable; publish it first.
- Changing a published template creates a later version and does not change an existing assignment.
- Delete hides and unpublishes the template so it cannot be used for new work; existing assignments, submissions, and pinned versions remain intact.

### Where to find things

Matt: Form Templates. Client: Forms → Templates or Customise first on an assignment.

## Service Catalog

### What it does

The catalogue stores reusable services, descriptions, categories, units, and prices for proposals.

### How it works

Active services appear in the proposal builder. Inactive services remain in Matt's list but cannot be selected for a new proposal. A service without a fixed price asks Matt for a quote-specific value.

### Your daily workflow

**Matt:** Confirm every public price, add or edit the service, and keep it inactive until it is approved.

### What's live vs. what's pending

**Live:** add, edit, activate/deactivate, delete, grouping, and proposal use. **Pending:** production is empty because the seeded prices have not been approved.

### Common situations

- If the proposal builder is empty, check that services exist and are Active.
- Deleting a service does not rewrite old proposal line items because each proposal keeps its own copy.

### Where to find things

Service Catalog in the admin sidebar.

## Contractor Directory

### What it does

Matt maintains approved contractor contact details; clients see only active, non-deleted entries.

### How it works

Entries are grouped by category. Inactive keeps an entry for Matt while hiding it from clients; Delete removes it from normal views.

### Your daily workflow

**Matt:** Add the contractor, check the phone, email, website, category, and approval status, then activate it.

**Client:** Open Directory and use the listed contact details for follow-up work.

### What's live vs. what's pending

**Live code:** admin management and client browse. **Pending:** production has no contractors and written acceptance of this scope addition should be confirmed.

### Common situations

- If Matt sees an entry and the client does not, check whether it is Active.
- The directory says contractors are vetted; Matt owns the accuracy of that claim.

### Where to find things

Contractors in the admin sidebar; Directory in the client top navigation.

## Notifications

### What it does

Notifications lists successful automated and manually triggered expiry reminders so Matt can see which document window was sent.

### How it works

The page reads the reminder ledger. Other emails and form events do not appear there; their failures may appear under Workflow Errors.

### Your daily workflow

**Matt:** Use Notifications to confirm expiry sends, then use Workflow Errors for failed report, invite, contract, reminder, or partner-event delivery.

### What's live vs. what's pending

**Live:** latest successful automated and manual expiry reminders. **Pending:** there is no complete sent-message outbox, delivery/open status, or resend action.

### Common situations

- An empty Notifications page means no recorded successful expiry reminder, not “all messages are healthy.”
- A message accepted by the email service can still be filtered or rejected later; confirm in the test inbox.

### Where to find things

Notifications and Workflow Errors in the admin sidebar.

## Settings

### What it does

Settings stores the portal logo, practice-wide portal colours, reminder choices, future email-brand labels, credits-per-hour reference rate, and theme.

### How it works

The logo, colours, toggles, labels, and rate are stored centrally. Both portal layouts read the colours on every load. Generated PDF colours and the active email sender/brand remain controlled elsewhere.

### Your daily workflow

**Matt:** Change one setting at a time, Save Changes, reload, and confirm it persisted. Test notification changes with a controlled document rather than assuming the label changes delivery.

### What's live vs. what's pending

**Live:** logo, portal colours across devices, reminder toggles, upload notice toggle, credits rate, and theme. **Staged:** the saved sender and sign-off labels are not applied to current email; the screen labels this limitation.

### Common situations

- A saved colour change should appear on Matt's other device and the client's portal after reload; it does not recolour generated PDFs.
- Changing the credits rate does not alter existing balances.
- Turning reminders off pauses email; turning them back on lets the range-based job catch the latest crossed window.

### Where to find things

Settings in the admin sidebar.

## Workflow Errors

### What it does

Workflow Errors shows the latest failures recorded inside the platform by report drafting, email delivery, reminders, signing, contracts, and partner-event transport.

### How it works

Each row explains the failure type and any recognised client, form, proposal, or assignment detail. The page is read-only. For partner notices, the platform now accepts success only when the final admin email has been accepted; a rejection, timeout, empty success, or missing final receipt is recorded here. The partner service also sends Matt a separate failure alert when one of its workflows fails.

### Your daily workflow

**Matt:** Check this page at the start and end of testing, record the time and related client, fix the source problem, then repeat the original action if it is safe.

### What's live vs. what's pending

**Partial:** recent rows are readable, but only a minority of failure names have tailored explanations. **Not built:** acknowledge, resolve, retry, or assignment to an owner. Successful partner notices are deliberately not retained in the partner-service history, so the controlled inbox is the delivery check.

### Common situations

- “No operational errors detected” can mean either that no rows were returned or that the error log itself could not be read. It does not prove PayPal, inbox delivery, or n8n is healthy.
- Two historical partner failures remain only until the old exposed secret is rotated; do not treat them as current workflow behaviour.
- Avoid repeating a payment or signature action until its current state is checked.

### Where to find things

Workflow Errors in the sidebar or Settings → System Diagnostics.

**Client modules**

## Client Dashboard

### What it does

The client dashboard shows the organisation's document totals, urgent expiries, and current credits.

### How it works

It reads only the signed-in organisation's records and lists up to six most urgent documents, expired first.

### Your daily workflow

**Client:** Check expired and expiring items, open Compliance for the complete list, and use Billing for the full credit ledger.

### What's live vs. what's pending

**Live:** organisation-specific data and mobile navigation. **Partial:** a document with no expiry date counts as Current here.

### Common situations

- If everything is empty after the organisation should have data, sign out/in and ask Matt to verify the Access link and organisation.

### Where to find things

Dashboard in the top navigation.

## Client Compliance and Documents

### What it does

Clients can browse documents by category and open or download their own files.

### How it works

Each click creates a short-lived link to a private file. The client cannot upload from this screen; Matt owns uploads.

### Your daily workflow

**Client:** Open Compliance, choose the document, confirm the filename/date/status, then view or download it.

### What's live vs. what's pending

**Live:** organisation-scoped list, short-lived links, and a visible error instead of “No documents yet” when data loading fails.

### Common situations

- If the link expired, select the document again.
- If a document is missing, ask Matt to confirm the client, category, and deletion state.

### Where to find things

Documents → Compliance.

## Client Reports

### What it does

Reports shows assessments awaiting Matt's review, failed drafts, and completed report PDFs.

### How it works

Only completed rows have a final PDF. Selecting view or download creates a short-lived link.

### Your daily workflow

**Client:** Use the status to see progress; download only when the row is Final/Completed.

### What's live vs. what's pending

**Live:** live status and final PDF. **Pending:** delivery email is not guaranteed, so the portal is the reliable copy.

### Common situations

- Draft means Matt has not approved the final report.
- Pending after an AI failure needs Matt's attention; the client cannot retry it.
- A client-completed form may remain absent briefly while drafting runs. If it never appears, Matt should check Workflow Errors.

### Where to find things

Documents → Reports. Completed assessments also have report actions in `/client/assessments/[id]`.

## Client Billing

### What it does

Billing shows the current credit balance, recent additions/deductions, and credit packages.

### How it works

PayPal is the purchase provider. A successful approved order should add credits once and add a ledger row.

### Your daily workflow

**Client:** Review the balance and ledger. Until Matt says the payment test is open, do not select a live purchase.

### What's live vs. what's pending

**Live:** balance and ledger. **Held:** checkout credentials. **Not built:** receipt/invoice email.

### Common situations

- **Payments coming soon:** purchasing is switched off.
- **Could not start checkout:** credentials or PayPal are unavailable.
- Keep the return page and order reference if payment succeeds but credits do not appear.

### Where to find things

Billing in the client navigation.

## Client Assessments

### What it does

Forms → Assessments shows work assigned by Matt, including due dates, instructions, progress, and submitted answers.

### How it works

Opening a form creates or resumes one draft. Fill as-is keeps Matt's version; Customise first creates a client-owned fork. Submission completes the assignment, can create the next recurring occurrence, and starts report drafting.

### Your daily workflow

**Client:** Read the instructions, choose the correct path, complete required fields, wait for photo uploads to finish, and submit once.

### What's live vs. what's pending

**Live:** assignment, resume, validation, submit, reminders, recurrence, report handoff, saved-photo previews, and stored-photo removal. **Not built:** speech and offline.

### Common situations

- Overdue forms remain fillable until Matt revokes them.
- A form already submitted opens read-only.
- An error after submission may be a notification failure even when the answers were saved; return to the list before submitting again.

### Where to find things

Forms → Assessments.

## Client Templates

### What it does

Clients can build organisation-owned forms, publish them, and fill them without waiting for Matt.

### How it works

Each save creates a new draft version. Publish creates a published version. A fork shows that it came from Matt's master but remains owned by the client's organisation. Self-fill saves the answers and starts report drafting.

### Your daily workflow

**Client:** Create a clear name, add and order fields, Save draft, test the conditions, Publish, then Fill.

### What's live vs. what's pending

**Live:** create, append-only save/publish, fill, fork, soft delete, protected referenced versions, and self-fill report handoff.

### Common situations

- A template must have a published version before self-fill.
- Matt can view a client template but cannot edit it.

### Where to find things

Forms → Templates.

## Client Proposals

### What it does

Clients see proposals Matt has sent, open the PDF, and accept an unsigned proposal.

### How it works

Draft proposals stay hidden. A Sent proposal offers Accept & Sign; Signed and Issued proposals remain visible for reference.

### Your daily workflow

**Client:** Open the proposal, read the service lines, total and PDF, then sign only if the document is correct.

### What's live vs. what's pending

**Live:** organisation-specific view/download, email delivery, and first-party signing. **Pending:** business acceptance of the signing method.

### Common situations

- If the proposal appears in the portal but no email arrived, use the portal and tell Matt.
- Never sign after spotting a price or scope error; ask Matt for a corrected new proposal.

### Where to find things

Agreements → Proposals.

## Client Contracts

### What it does

Clients can open or download issued service agreements.

### How it works

The Contracts list reads issued proposals with a contract PDF. Selecting a contract opens a tenant-scoped detail page with an embedded one-hour preview, download, services, total, and issued date.

### Your daily workflow

**Client:** Open Contracts, select the agreement, check its services and total, then view or download it.

### What's live vs. what's pending

**Live:** tenant-scoped list, detail, embedded preview, and download.

### Common situations

- A contract detail URL returns not found if it belongs to another organisation, is not Issued, or has no stored agreement PDF.
- If the proposal is Signed but no contract appears, Matt must issue or retry the contract.

### Where to find things

Agreements → Contracts.

## Client Directory

### What it does

Clients can browse contractors Matt has marked active.

### How it works

The list is shared across signed-in clients and contains only active entries.

### Your daily workflow

**Client:** Find the correct category, then use the listed phone, email, or website.

### What's live vs. what's pending

**Live code:** browse and contact links. **Pending:** no production entries.

### Common situations

- Ask Matt if a known contractor is missing; it may be inactive or not yet added.

### Where to find things

Directory in the client navigation.

# Part 3 — Quick Reference

## Compliance status

| Badge | Meaning |
|---|---|
| **CURRENT** | Expiry is more than 30 UK calendar days ahead; the client dashboard's broad Current total also includes undated documents |
| **EXPIRING** | Expiry is 1–30 UK calendar days ahead, including exactly 30 days |
| **EXPIRED** | Expiry date is today or earlier |
| **NO EXPIRY DATE** | Matt's separate admin bucket for documents without a date |

Reminder email windows are 30 days, 14 days, 7 days, and expired. If a run was missed, the platform sends the latest crossed window rather than sending every missed reminder.

## Assessment and assignment status

| Status | Meaning |
|---|---|
| **Pending / Assigned** | Matt assigned the form; the client has not started |
| **In Progress** | A draft exists and can be resumed |
| **Submitted** | Answers are committed and no longer editable; this is normally the brief state before drafting succeeds or fails |
| **Awaiting Review** | The report draft is ready for Matt |
| **AI Draft Failed** | Drafting failed; Matt can inspect the error and retry |
| **Completed / Final** | Matt approved the report and the PDF exists |
| **Revoked** | Matt removed the assignment; it can no longer be used |

## Proposal status

| Status | Meaning |
|---|---|
| **Draft** | Saved for Matt; hidden from the client |
| **Sent** | Signing link created; confirm the client actually received it |
| **Signed** | Online signature or a paper/email acceptance recorded by Matt |
| **Issued** | Service-agreement PDF created |

## Template status

| Status | Meaning |
|---|---|
| **Draft** | Work can continue; it cannot be assigned or self-filled as the published version |
| **Published** | Available for assignment or self-fill |
| **Unpublished draft present** | A newer saved draft exists while an older published version remains available |
| **Forked** | Client-owned copy linked to a Matt-owned master |

## The 11 active field types

| Field | Use |
|---|---|
| Short Text | One line of typed text |
| Number | Numeric answer |
| Date | Calendar date |
| Select | One choice from a list |
| Long Text | Multi-line typed notes |
| Checkbox | A single tick/yes-no style answer |
| Section | Groups related fields |
| Photos | Multiple compressed images |
| Location | Coordinates and map preview |
| Computed | Automatic risk score from configured inputs |
| Repeating Section | Repeat a group for each door, hazard, floor, or similar item |

Signature and Rating are not active builder fields. The proposal signing pad is a separate agreement feature.

## Glossary

| Term | Plain-language meaning |
|---|---|
| Assignment | A form Matt has sent to a client to complete |
| Assessment | A completed or in-progress fire-safety form and its report work |
| Client | The organisation, such as Hallam House Care Home |
| Client user | A person allowed into that organisation's portal |
| Credits | The stored retained-work balance |
| Fork | A client-owned copy of Matt's template |
| Master | Matt's original reusable template |
| Pinned version | The exact form version kept with an assignment or submission |
| Proposal | Price and scope offered before agreement |
| Contract / service agreement | The issued agreement created after signing |
| RAG | Red/amber/green compliance position: expired, expiring, current |
| Signed link | A short-lived private file link; it can expire and be created again |
| Workflow error | A recorded background, drafting, email, signing, or partner-event failure |

## What to do when something looks wrong

1. **Check whether the action actually committed.** Return to the list and look for the new row, status, PDF, ledger movement, or submitted answer before repeating anything.
2. **Refresh once.** Some screens can hold an older view after a background step.
3. **Check Workflow Errors.** Record the time, client, form/proposal, and exact message.
4. **Check the client's portal.** A failed email does not always mean the file or report is missing.
5. **Do not repeat money or signing actions blindly.** Confirm the PayPal order, credit ledger, proposal status, and signature state first.
6. **Capture useful evidence.** Take a screenshot, copy the route without private tokens, and record the steps immediately before the problem.

## Pending-dependencies master list

- Real Hallam House and Sarah QA account.
- Matt's FRA/site-risk questions and approved risk matrix.
- Matt-approved service catalogue and prices.
- Valid PayPal live credentials and controlled payment test plan.
- One agreed public brand/sender; email delivery itself is working.
- Complete the two-secret production cutover and run the three client-activity canaries; the assessment and failure-alert canaries already pass.
- Enable n8n MFA, rotate the exposed audit API key and old general webhook secret together, delete only the two historical failures after cutover, remove confirmed-unused mail credentials, and apply the available n8n bug-fix update.
- Formal first-party signing acceptance.
- Upload/report recipient rule; expiry reminders already use the organisation contact.
- Speech-to-text.
- SMS and offline scope.
- Billing receipt/invoice.
- Privacy, retention, processor, and access decisions.
- Repository-wide legacy/vendored lint cleanup; changed files and release gates are clean.

## Who to ask

**Client:** Ask Matt through the contact details shown in the portal footer: `888FST@proton.me` or `0161 552 0918`.

**Matt:** Owns fire-safety content, risk wording, service prices, contractor approval, client access, and whether a report or agreement is professionally ready.

**Platform support:** The named technical contact is **UNVERIFIED**. Matt should ask whoever controls deployment, live data, email, and PayPal for configuration or security faults.

**Finley / partner automation:** The workflows are rebuilt. Ask the partner owner for MFA, API-key rotation, unused-credential confirmation, and the hosted update; the exact live workflow IDs, remaining cutover, and canary results are recorded in the research brief.

# Part 4 — QA Walkthroughs

Use throwaway records and controlled inboxes. Each walkthrough states its commit point so the tester can inspect the screen without creating a permanent record. Never use a real client, real signature, or real payment unless the walkthrough explicitly says that dependency has been approved.

## QA 1 — Login and role separation

### Before you start

Matt needs a working operator password. The client tester needs a separately invited client account. Use a private browser window for the second person.

1. **Matt:** Open `/login/admin`, enter the operator account, and sign in. Confirm the address ends in `/admin`.
2. **Matt:** Open `/client` directly. Confirm the platform returns you to the admin area without showing client content.
3. **Client:** Open `/login`, sign in, and confirm the address ends in `/client`.
4. **Client:** Open `/admin` directly. Confirm no admin content appears and the operator sign-in is shown.
5. **Client:** Sign out, try the client credentials at `/login/admin`, and confirm the page rejects operator access rather than opening the console.
6. **Matt:** Try the operator credentials at `/login` and confirm the page tells you to use Operator access.
7. **Matt:** Sign out, open **Forgot?**, enter the controlled operator address once, and confirm the page gives the same neutral response whether or not an account exists.
8. **Matt:** Open the reset message, set a temporary password, sign in, then replace it with the agreed handover password after QA.

### Errors / exception states you might see

- **Invalid login credentials:** the password or account is wrong.
- **Account doesn't have operator access:** the account is a client.
- **This is the client portal:** the account is Matt's operator account.
- No reset email after the neutral success message: check Workflow Errors and inbox filtering; the screen deliberately does not reveal whether an address exists.

### When nothing looks wrong but you want to be sure

Open a known admin-only client record while signed in as the client. It must not render, even briefly.

### When something looks wrong

Confirm the exact email, sign out fully, clear the private window, and ask Matt to check whether the account appears under the correct client Access tab.

### Known gaps until dependencies land

Sarah has no current production account. Create and invite her before running this walkthrough. The reset limit is live, but do not flood a real inbox to test the threshold manually.

## QA 2 — Create Hallam House and invite Sarah

### Before you start

Use Sarah's controlled QA inbox, not a real customer address. Decide whether the created Hallam House record will be retained or deleted after testing.

1. **Matt:** Open Clients and select New Client.
2. **Matt:** Enter `Hallam House Care Home`, Sarah Whitfield, her controlled email, an optional test phone number, and a test site address. Job title is not stored, so record “Facilities Manager” in the QA notes.
3. **Matt:** Stop before Create and review spelling and email. Selecting Create is the commit point.
4. **Matt:** Create the client, open its Access tab, and confirm Sarah appears or an invitation action is available.
5. **Matt:** Send or resend the invite. If the email reports a failure, copy the invitation link and record that fallback was used.
6. **Client:** Open the invitation once, set a new temporary QA password, and sign in.
7. **Client:** Confirm the portal header says Hallam House Care Home and Sarah Whitfield.
8. **Matt:** Return to Access and confirm Sarah is listed as Owner and the account state is consistent with the completed invitation.
9. **Matt:** Select Edit details, change one harmless contact value, save, reload, and restore it. Confirm the site address can also be corrected.

### Errors / exception states you might see

- The client can be created while invite delivery fails.
- An invite link is single use; opening it twice should not create a second session.
- A duplicate email may belong to an existing account and needs deliberate linking rather than a second identity.

### When nothing looks wrong but you want to be sure

As Sarah, verify that no other organisation's records appear in Dashboard, Compliance, Billing, Forms, Proposals, Contracts, or Directory.

### When something looks wrong

Check the Access tab, Sarah's spam folder, Workflow Errors, and the copied fallback link. Do not repeatedly create the same user.

### Known gaps until dependencies land

Email delivery is working; an individual missing message should still be checked in the recipient inbox and Workflow Errors. Job title remains unmodelled.

## QA 3 — Compliance document and expiry status

### Before you start

Prepare four harmless PDFs under 25 MB: one expired yesterday, one expiring in 14 days, one expiring in 31 calendar days, and one with no expiry date.

1. **Matt:** Open Compliance and choose Upload Document.
2. **Matt:** Select Hallam House, choose a category, attach the expired file, and set yesterday's date.
3. **Matt:** Stop before Upload and confirm client, category, file, and date. Upload is the commit point.
4. **Matt:** Upload the remaining three files with their matching dates.
5. **Matt:** Confirm the files appear under Expired, Expiring, Current, and No Expiry Date. The screen uses UK calendar dates, so 30 days is Expiring and 31 days is Current.
6. **Client:** Open Documents → Compliance and confirm all four files appear only for Hallam House.
7. **Client:** Open and download one file, then wait for its temporary link to expire or reopen later and confirm a fresh click works.
8. **Matt:** Open Upcoming Expiries and inspect the manual reminder option. Stop before sending if the inbox test has not been approved.
9. **Matt:** If approved, send one reminder and confirm the controlled inbox and Notifications ledger.

### Errors / exception states you might see

- Unsupported type, file above 25 MB, or file whose bytes do not match its claimed type is rejected.
- Upload can succeed while its notification email fails.
- The client dashboard counts the undated file as Current even though Matt has a separate No Expiry Date bucket.

### When nothing looks wrong but you want to be sure

Confirm the filename, client, category, expiry date, and actual downloaded bytes. Then sign in as a second test organisation and confirm the file is absent.

### When something looks wrong

Check Compliance filters, the client record's Documents tab, Workflow Errors, and whether the file was deleted or the client deactivated.

### Known gaps until dependencies land

Expiry reminders use Hallam House's saved primary contact. Upload notices still need an agreed rule if several portal users exist.

## QA 4 — Build and publish Matt's master template

### Before you start

Matt must supply safe QA questions. Do not label the Computed field as approved PAS 79 guidance until he approves the matrix.

1. **Matt:** Open Form Templates and create `QA Hallam House Assessment`.
2. **Matt:** Add all 11 field types once, using a Section and a Repeating Section to group sensible test questions.
3. **Matt:** Add one required field and one conditional field. Turn Required on for the Photos field, then verify during filling that the screen calls it recommended and does not use it to block submission.
4. **Matt:** Configure the Computed field only with clearly labelled test inputs.
5. **Matt:** Select Save draft. This writes a new draft version but does not make it assignable.
6. **Matt:** Reload and confirm the fields and order remain.
7. **Matt:** Stop before Publish and review every label, option, condition, and risk wording. Publish is the release point for assignments.
8. **Matt:** Publish and confirm the template shows Published.

### Errors / exception states you might see

- A rule loop or unsupported nested specialty field is rejected.
- A Draft cannot be assigned.
- Saving twice creates later versions; it does not overwrite the earlier version.

### When nothing looks wrong but you want to be sure

Open the template after reload, inspect the version number, and start an assignment without committing it to confirm the client picker and published version are available.

### When something looks wrong

Remove the most recent condition or nested field, save again, and read the exact validation message. Do not delete a template that has assignments.

### Known gaps until dependencies land

There is no real production master, and the risk matrix remains unapproved.

## QA 5 — Assign, fill as-is, and submit

### Before you start

QA 2 and QA 4 must be complete. Choose a due date at least eight days ahead if reminder testing is planned.

1. **Matt:** Open the published master and select Assign to clients.
2. **Matt:** Choose Hallam House, add test instructions and a due date.
3. **Matt:** Stop before Assign and verify the client and due date. Assign is the commit point.
4. **Matt:** Assign the form and confirm it appears in Assigned Forms or `/admin/assignments`.
5. **Client:** Open Forms → Assessments, select the assignment, read the instructions, and choose Fill as-is.
6. **Client:** Enter part of the form, leave the page, reopen it, and confirm the draft resumed.
7. **Client:** Try to submit with a required field empty and confirm the platform blocks submission.
8. **Client:** Complete all required fields. Add a test photo, wait until its upload finishes, leave and reopen the draft, confirm the saved preview appears, remove it, reload to confirm it stays removed, then add one final test photo.
9. **Client:** Stop before Submit and review every answer. Submit is the final commit point and the form becomes read-only.
10. **Client:** Submit once and confirm the assignment moves to Completed and submitted answers can be opened.
11. **Matt:** Confirm the assignment and submission appear under Hallam House. Refresh Review Queue until the submission becomes Awaiting Review or AI Draft Failed; it may remain Submitted briefly while drafting runs.

### Errors / exception states you might see

- **Already submitted:** a second click or repeat request was blocked.
- **Revoked assignment:** Matt removed it.
- **Saved photos could not be previewed:** refresh once. If the message remains, record the submission and field rather than re-uploading duplicates.

### When nothing looks wrong but you want to be sure

Compare the submitted answer view with the values entered, including conditional fields and repeating rows.

### When something looks wrong

Return to the assignment list before retrying. If it says Completed, do not submit again; inspect the submitted answers and Workflow Errors.

### Known gaps until dependencies land

Speech-to-text and offline queuing remain absent, and Required Photos remains non-blocking.

## QA 6 — Customise first and customer-owned templates

### Before you start

Create a fresh second assignment from Matt's master so QA 5's completed assignment remains unchanged.

1. **Client:** Open the new assignment and select Customise first.
2. **Client:** Confirm the builder opens a client-owned copy and shows that it was forked.
3. **Client:** Add, remove, or reorder a harmless test field, then Save draft.
4. **Client:** Stop before Publish and confirm Matt's original still looks unchanged in a separate session. Publish commits the forked version.
5. **Client:** Publish and return to the assignment.
6. **Client:** Fill and submit the forked form.
7. **Matt:** Open Form Templates and confirm the client template appears under Client templates and is read-only.
8. **Matt:** Open the master and confirm its fields did not change.
9. **Client:** Create a separate template from scratch, publish it, and self-fill it without an assignment. Confirm the answers are saved and the submission reaches Review Queue or AI Draft Failed.

### Errors / exception states you might see

- Matt should not see edit, publish, delete, or assign controls on a client-owned template.
- A customer template without a published version cannot be self-filled.

### When nothing looks wrong but you want to be sure

Compare the master and fork side by side, then confirm the submitted answers use the fork's extra field.

### When something looks wrong

Do not delete either template. Record the two names and version numbers, then check whether the assignment points to the fork.

### Known gaps until dependencies land

No additional template-integrity gap is known in this walkthrough; the remaining dependency is approved production content.

## QA 7 — Admin assessment, draft review, and final report

### Before you start

A published master and valid drafting-service key are required. Use deliberately simple answers whose correct report content is obvious.

1. **Matt:** Select + New Assessment, choose Hallam House and the QA template, and start.
2. **Matt:** Complete the form with one clear low-risk item and one clear urgent hazard.
3. **Matt:** Stop before Submit and copy the answers to the QA notes. Submit starts report drafting.
4. **Matt:** Open Review Queue. If drafting is still running, wait and refresh; if it failed, open Workflow Errors and use Retry Draft.
5. **Matt:** Open the report draft and expand Raw Answers. Confirm this contains typed source answers; no speech recording should exist.
6. **Matt:** Compare every generated claim with the source. Deliberately edit the summary, one severity, and one recommended action.
7. **Matt:** Stop before Approve & Generate PDF. Up to this point no final client report exists.
8. **Matt:** Approve, confirm a PDF opens, and confirm the submission leaves Awaiting Review.
9. **Client:** Open Reports and download the final PDF.
10. **Matt:** Compare the PDF with your approved edits, not with the first AI draft.
11. **Client:** Open the completed report in the portal and confirm it matches the final PDF Matt approved.

### Errors / exception states you might see

- **AI Draft Failed:** configuration/service failure or invalid output; inspect the error and retry.
- **Report saved, but the delivery email failed:** the PDF exists in the portal, but the current build does not automatically retry the email.
- Empty or overconfident draft text from sparse answers is a content-quality failure, even when the system technically succeeded.

### When nothing looks wrong but you want to be sure

Confirm the client can download the PDF, another client cannot, and a second approval click does not send another report.

### When something looks wrong

Do not approve. Copy the raw answers and draft, take a screenshot, and record whether the problem is source data, generated wording, or final PDF.

### Known gaps until dependencies land

Risk wording is unapproved, sparse answers can lead to invented detail, and dictation is absent.

## QA 8 — Service catalogue and proposal draft

### Before you start

Use test services and prices that cannot be mistaken for real quotes. Hallam House needs a contact email.

1. **Matt:** Open Service Catalog and add two test services, one with a fixed price and one without a fixed price.
2. **Matt:** Stop before Save on each item and confirm the category, unit, description, and price. Save commits the catalogue item.
3. **Matt:** Deactivate one service and confirm it remains in the catalogue but disappears from New Proposal.
4. **Matt:** Start a proposal for Hallam House and select the active services.
5. **Matt:** Enter a quote-specific price for the no-price service and change quantities.
6. **Matt:** Ask for a draft scope, then rewrite part of it so it matches the actual work.
7. **Matt:** Save as Draft. This is the proposal commit point but does not expose it to Sarah.
8. **Matt:** Open the Draft from the pipeline and confirm the line totals, 20% VAT, client, scope, and PDF.

### Errors / exception states you might see

- Missing drafting-service configuration should show an error in production.
- A PDF generation or upload failure should show that the proposal was retained as Draft and could not produce its PDF.
- If the builder reports success without a working PDF, log it as a regression.

### When nothing looks wrong but you want to be sure

Calculate subtotal, VAT, and total independently. Open the PDF rather than relying on the pipeline card.

### When something looks wrong

Keep the proposal as Draft, use Generate PDF if available, and do not send until the document opens and totals match.

### Known gaps until dependencies land

The real production service catalogue and prices are awaiting Matt's approval.

## QA 9 — Send, sign, and issue the contract

### Before you start

Use a controlled Sarah inbox and an explicitly test-only proposal. Agree that the typed/drawn test signature is not a real business acceptance.

1. **Matt:** Open the verified Draft and select Send for signature.
2. **Matt:** Stop before the final send action if the tester has not agreed to receive the link. Sending changes status to Sent and creates a 30-day link.
3. **Client:** Confirm the email arrived. If it did not, open the proposal through Agreements → Proposals and report the delivery failure.
4. **Client:** Open the proposal, PDF, service lines, and total. Stop before accepting if anything differs.
5. **Client:** Select Accept & Sign, enter the test signer details, test Draw and Type modes, accept the terms, and stop before the final submit.
6. **Client:** Submit once. Confirm the success screen and that a second use of the link says Already signed.
7. **Matt:** Confirm the pipeline moved to Signed or Issued and open the signed proposal copy.
8. **Matt:** If it remains Signed, check Workflow Errors and select Issue contract.
9. **Client:** Open Agreements → Contracts, select the agreement, and confirm the detail page shows the expected services, total, issued date, preview, and download.
10. **Client:** Copy the detail URL into the same signed-in session and confirm it still opens. A different organisation must receive not found.

### Errors / exception states you might see

- **Expired:** send a new link.
- **Already signed:** do not create a second signature.
- **Document changed / evidence unavailable:** signing did not commit. Keep the proposal and link state intact while Matt checks the original PDF and Workflow Errors.
- Proposal says Sent but inbox is empty: Matt should see a warning and a `proposal_signature_request` Workflow Error. Use the portal while that individual delivery is resolved; there is no automatic retry.
- Auto-issue can fail after signature; the signature remains valid and Matt can retry contract issue.

### When nothing looks wrong but you want to be sure

Compare the original and signed PDF, confirm the original content is unchanged, and confirm the contract uses the signed proposal's services and total.

### When something looks wrong

Do not mark a proposal manually signed to hide an online failure. Preserve the link state, proposal status, PDF, time, and Workflow Error for diagnosis.

### Known gaps until dependencies land

First-party signing still needs formal business acceptance.

## QA 10 — Manual credits and PayPal

### Before you start

Manual credits can be tested with Hallam House. PayPal must not be tested until valid credentials and an approved sandbox or controlled live-money plan exist.

1. **Matt:** Open Hallam House → Credits and note the starting balance.
2. **Matt:** Enter a +8 credit adjustment and inspect the hours conversion hint.
3. **Matt:** Stop before Submit. Submitting changes the balance and ledger together.
4. **Matt:** Submit, then confirm the balance increased by 8 and one ledger row appeared.
5. **Matt:** Enter −3 credits, submit, and confirm the balance and second ledger row.
6. **Matt:** Try a deduction larger than the balance and confirm it is rejected with no ledger row.
7. **Client:** Open Billing and confirm the same balance and movements.
8. **Client:** Inspect the 20/40/80 packages and prices. Stop here while credentials are broken.
9. **Client:** Only after the payment gate is approved, purchase the agreed test package and return to Billing.
10. **Client:** Confirm exactly one purchase ledger row and exactly one credit increase, even after refreshing the return page.

### Errors / exception states you might see

- **Payments coming soon:** checkout disabled.
- **Could not start checkout:** credentials or provider failure.
- **Payment capture failed:** keep the order return information and do not buy again.

### When nothing looks wrong but you want to be sure

Match the PayPal order, GBP amount, package, client, ledger row, and balance. Confirm no second credit after refresh.

### When something looks wrong

Do not “fix” a disputed payment with a manual top-up until the PayPal order and capture state are known.

### Known gaps until dependencies land

Production credentials are invalid, live money has not been tested, and receipts/invoices are absent.

## QA 11 — Contractor Directory

### Before you start

Use an obviously fictional contractor and controlled contact details.

1. **Matt:** Open Contractors and add the test company as Active.
2. **Matt:** Stop before Save and verify every public detail. Save makes it visible to signed-in clients.
3. **Client:** Open Directory and confirm the entry, category, phone, email, and website.
4. **Matt:** Change the entry to Inactive.
5. **Client:** Refresh and confirm the entry disappears.
6. **Matt:** Reactivate, edit one detail, and confirm the client sees the change.
7. **Matt:** Delete the throwaway contractor after the test.

### Errors / exception states you might see

- An inactive entry remains visible to Matt but not the client.
- Invalid website text may still produce a link; test the final URL.

### When nothing looks wrong but you want to be sure

Sign in as two client organisations and confirm both see the same active approved directory.

### When something looks wrong

Check Active status and whether the entry was deleted before creating a duplicate.

### Known gaps until dependencies land

Production is empty and the Directory's scope acceptance should be confirmed.

## QA 12 — Settings, notifications, and failure visibility

### Before you start

Record all current Settings values so they can be restored. Use a controlled test document and inbox.

1. **Matt:** Change Saved Sign-off Name, Save Changes, reload, and confirm the value persisted. This is a stored future label, not a current email change.
2. **Matt:** Restore it. Repeat with Credits per Hour, then restore 4. Confirm no existing balance changed.
3. **Matt:** Change a colour, save, reload in the same browser, and confirm it persists.
4. **Matt:** Open another signed-in admin device and Sarah's portal, reload, and confirm the saved colour follows to both.
5. **Matt:** Upload a temporary logo, confirm it appears in the client footer, then restore/remove it.
6. **Matt:** Turn Notify on document upload off, upload a test document, and confirm the document saves without an email.
7. **Matt:** Turn it back on, upload another test document, and check the controlled inbox and Workflow Errors.
8. **Matt:** Open Notifications and confirm it contains successful expiry reminders only.
9. **Matt:** Open Workflow Errors and inspect any failure created during QA. Confirm there is no Retry or Resolve action.

### Errors / exception states you might see

- A Settings success message does not mean the sender label changed real email.
- SVG logos and files whose real header does not match PNG, JPEG, or WebP are rejected.
- Partner notices are not tested from Settings. The rebuilt n8n routes reject unauthorised or incomplete events and confirm success only after the admin email is accepted; use QA 15 after the production secret cutover.
- An empty Workflow Errors page is not proof that email, PayPal, or the error-log read itself is healthy.

### When nothing looks wrong but you want to be sure

Reload, use a second browser, inspect the controlled inbox, and compare the portal record with Notifications and Workflow Errors.

### When something looks wrong

Restore the original settings first, then record which device/browser, action, client, and time produced the difference.

### Known gaps until dependencies land

PDF colours and email identity are configured elsewhere. Workflow Errors is read-only, and partner-notice testing remains paused until the two production secrets and current application release are confirmed.

## QA 13 — Dashboard and queue reconciliation

### Before you start

Complete the client, compliance, client-assignment, Matt-led report, proposal, and manual-credit walkthroughs first so the dashboards have known records. This walkthrough is read-only.

1. **Matt:** Open Dashboard and note the client, overdue/expiring, report-review, proposal, credit, and Workflow Error figures.
2. **Matt:** Open Clients and confirm Hallam House and its credit balance match the dashboard.
3. **Matt:** Open Compliance and compare the Expired and Expiring lists with the dashboard cards.
4. **Matt:** Open Review Queue. Confirm the Matt-led draft or completed report appears in the right tab.
5. **Matt:** Confirm the client-submitted assignment from QA 5 reached Awaiting Review or AI Draft Failed. A short Submitted period is expected; a submission that stays there needs investigation.
6. **Matt:** Open Proposals and Workflow Errors and reconcile their current rows with the dashboard.
7. **Matt:** Open Month Summary and compare records created in the current UTC month with the underlying assessment, upload, proposal, and error lists.
8. **Client:** Open Dashboard and compare its document totals and credit balance with Documents → Compliance and Billing.
9. **Client:** Confirm the urgent document list shows expired items before expiring items and contains no other organisation's record.

### Errors / exception states you might see

- On Compliance, Reports, and Proposals, a failed client data load should show an error panel. “No records” should be reserved for a successful empty result.
- A recently changed background status can need one refresh.
- An undated document counts as Current on the client dashboard but has its own admin bucket.

### When nothing looks wrong but you want to be sure

Compare specific record names and IDs, not only totals. Open every dashboard card used in the comparison and confirm it reaches the expected source list.

### When something looks wrong

Check the underlying list, current status, record date, and Workflow Errors. For Month Summary, record the timestamp and remember that its boundary is UTC.

### Known gaps until dependencies land

Dashboard counts do not prove an individual message reached its inbox or that PayPal and partner workflows are healthy.

## QA 14 — Tablet and mobile pass

### Before you start

Use Matt's Surface Pro or iPad for admin assessment work and a real phone-sized browser for Sarah. Keep the connection online throughout; offline mode is not supported.

1. **Matt:** On tablet, open Dashboard, Clients, a client record, New Assessment, the form, and Report Review.
2. **Matt:** Rotate the tablet and confirm buttons, field labels, repeating rows, photo capture, location, and approval controls remain usable.
3. **Matt:** Do not approve the report during layout testing; stop before Approve & Generate PDF.
4. **Client:** On mobile, open the menu and visit every top-level section.
5. **Client:** Start a throwaway assignment, type into each basic field, add a repeating row, and test a photo.
6. **Client:** Leave and resume online. Confirm saved text returns.
7. **Client:** Stop before Submit unless this is the dedicated submission walkthrough.
8. **Client:** Open a proposal, the signing page, Billing, a compliance document, and a report.

### Errors / exception states you might see

- Losing connection can lose unsaved work or leave an upload incomplete.
- Private-file links can expire and should be opened again from the portal.
- A saved-photo preview error should produce a visible message; repeated blank spinners or broken images are regressions.

### When nothing looks wrong but you want to be sure

Test portrait and landscape, browser zoom, the mobile menu, keyboard focus, scrolling, and the final action buttons without committing.

### When something looks wrong

Record device, operating-system version, browser, orientation, route, and whether the connection changed. Do not file offline failure as a regression; offline operation is not built.

### Known gaps until dependencies land

There is no offline/PWA mode, background sync, SMS, or speech-to-text.

## QA 15 — Partner activity notices

### Before you start

Do not create a test client record until platform support confirms that both production secrets are deployed, the old general secret has been rotated at both ends, and the current application release is live. The partner workflows themselves are rebuilt: both routes are protected, invalid events are rejected, Gmail is retried, success follows final mail acceptance, and the controlled failure alert has passed. Use a throwaway organisation and Matt's controlled admin inbox.

1. **Matt:** Confirm the secret cutover and current production release. Stop here without creating anything if either is still pending.
2. **Client:** Prepare a named test template. **Create** is the commit point; create it once, then confirm it appears in the portal.
3. **Matt:** Confirm one “client created a form template” message arrived and that no new related Workflow Error appeared. Successful partner runs are deliberately not retained.
4. **Client:** Self-fill the template. Stop before **Submit** until the record is safe to commit, then submit once and confirm report drafting starts.
5. **Matt:** Confirm one form-submitted message arrived and no related Workflow Error appeared. Do not resubmit to chase email.
6. **Client:** On a throwaway assignment, choose **Customise first** once and confirm Matt's master is unchanged.
7. **Matt:** Confirm one template-customised message arrived and no related Workflow Error appeared.
8. **Matt:** Submit one throwaway admin assessment. Confirm report drafting starts, one separate assessment-submitted message arrives, and no related Workflow Error appears.

### Errors / exception states you might see

- The client record can save while its admin notice fails; the portal record remains the source of truth.
- **403 / unauthorised:** the two ends do not have the same secret, or the request omitted it.
- **422 / invalid event:** a required event field is missing; record the event type and action, then check the current application release.
- **Success without delivery confirmation:** the partner route answered without proving the Gmail step; the application correctly records this as a failure.
- An “[888] Automation failed” message means the failure workflow worked. Use its workflow, step, and execution link to investigate.

### When nothing looks wrong but you want to be sure

Match every committed action to exactly one admin inbox message, confirm there is no related Workflow Error, and confirm ordinary customer email still comes only from the platform.

### When something looks wrong

Do not repeat the client write or assessment submission. Record the event type, organisation, record reference, time, application result, n8n execution result, and inbox result.

### Known gaps until dependencies land

MFA, API-key rotation, ownership checks for two unused mail credentials, and the hosted bug-fix update remain handover gates. They do not change the four notice contents, but the production walkthrough stays paused until the two-secret cutover and current application release are confirmed.
