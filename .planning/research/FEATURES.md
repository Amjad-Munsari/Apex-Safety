# Feature Research

**Domain:** UK Health & Safety / Fire-Risk Compliance SaaS — solo consultancy (888 Safety & Training)
**Researched:** 2026-04-15
**Confidence:** HIGH for inspection-workflow and proposal/e-sign categories (well-documented prior art); MEDIUM for client-portal and AI-review-gate categories (patterns clear, specific prior art thinner for solo-consultant scale)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that inspectors, consultants, and their clients assume exist. Absence makes the product feel broken or untrustworthy. Prior art: SafetyCulture (iAuditor), SiteDocs, AssessKit, Aurora FRA, Mobiess, Re-Flow, simPRO, PandaDoc, SignWell.

#### A — Assessment / Inspection Workflow (Matt's primary tool)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Tablet-first responsive form renderer | Every competitor (SiteDocs, iAuditor, Re-Flow, Mobiess) leads with mobile/tablet capture; Surface Pro / iPad is Matt's stated primary device | MEDIUM | Next.js + Tailwind; large tap targets, no hover-dependent UI |
| Per-field photo attachment | iAuditor and Aurora support inline photo capture; a photo gallery at the bottom (the old approach) breaks the evidence chain by dissociating finding from photo | HIGH | Hard requirement per PROJECT.md; store as separate `field_media` rows linked to `submission_id` + `field_key` |
| Speech-to-text on every text field | Matt's existing dictaphone workflow proves the need; Web Speech API covers Chrome/Safari on tablet without server round-trip | MEDIUM | Web Speech API (browser-native); must degrade to manual typing with a clear "mic unavailable" indicator; no cloud STT dependency for MVP |
| Offline form fill with background sync | SiteDocs "Offline Jobsite Mode" and iAuditor offline caching are table stakes; building sites have poor signal | HIGH | Phase 2 (PWA + IndexedDB); Phase 1 requires clear "no offline" warning rather than silent failure |
| Form template engine (schema-driven render) | FRA and Site Risk ride on the same renderer; without this any new assessment type needs a deploy | HIGH | Unified template architecture per PROJECT.md; schema versioning non-negotiable from day one |
| Schema versioning (submissions pin to their version) | iAuditor and SiteDocs both snapshot form versions at submission time; editing a template must not retroactively corrupt historical reports | HIGH | Pre-condition for any form submission feature; must ship before D1 |
| Conditional field visibility (show/hide on answer) | iAuditor's logic engine is a widely-cited competitive advantage; "N/A" answer types are endemic in fire-risk forms | MEDIUM | Phase 2 form builder; Phase 1 FRA seed template can hard-code simple conditionals if needed |
| Structured field types (text, yes/no/n-a, rating, date, photo, signature, repeating-section) | Every inspection product from Mobiess to Aurora supports this range; missing types force workarounds that corrupt report quality | MEDIUM | Phase 2 form builder adds drag-drop; Phase 1 needs at minimum text, yes/no/na, and photo fields |
| Short text labels tagging photos/audio | Matt's stated workflow: "Basement", "No PAT testing" tags a photo or audio clip; label-less photo galleries lose context | LOW | Stored as `label` on each `field_media` row |
| Audit trail (who did what and when) | PAS 79:2020 and the Regulatory Reform (Fire Safety) Order 2005 both imply evidence of assessment currency; Aurora explicitly surfaces an audit trail as a selling point | MEDIUM | Supabase row-level timestamps + a `submission_events` table; immutable after submission |
| Save-as-draft / resume incomplete form | iAuditor and Re-Flow both support interrupted inspections; site visits are rarely completed in one sitting | MEDIUM | `status = draft | submitted`; autosave on field blur |
| Submission read-only freeze post-submit | Industry standard: once submitted, a report is an evidence artefact and must not be editable | LOW | Enforce via RLS policy on submitted rows |

#### B — AI Report Generation (core value prop)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Branded PDF output matching Matt's existing template | AssessKit explicitly targets "5-minute branded PDF" as its headline; iAuditor generates "professional-looking reports"; any variance from Matt's established format undermines client trust | HIGH | n8n workflow → OpenAI GPT-4 → PDF renderer; YELLOW BROOM FRA is the few-shot reference |
| Human review gate before delivery | Harvey, Spellbook, and all legal AI SaaS enforce a lawyer-in-the-loop before output is sent; Matt reviews every report today — removing that is a trust failure | LOW | `status` state machine: `draft_ready_for_review → approved → delivered`; admin-only `approve` action |
| Admin report preview (rendered PDF in-browser) | Attorneys reviewing AI drafts need to see exactly what the client will receive; a plain JSON diff is not usable | MEDIUM | Serve the generated PDF from Supabase Storage behind a signed URL in an `<iframe>` |
| Reject / request-regeneration action | Corollary of the review gate; Matt must be able to discard a bad draft and trigger re-generation with corrective notes | LOW | `status → rejected`; optional note field fed back to the n8n prompt as additional context |
| Report section traceability (form answer → report paragraph) | Harvey and similar tools surface "source grounding" so reviewers can verify the AI hasn't hallucinated; critical for a fire safety legal document | MEDIUM | Include field key references in the prompt; consider a side-by-side view in the admin preview |
| Photo evidence embedded in PDF | Aurora, iAuditor, and PAS 79 guidance all expect photographic evidence to appear within the report body, not as an appendix link | HIGH | n8n must pull signed Storage URLs and embed images into the PDF at the correct section |

#### C — Client Compliance Portal (client-facing)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Magic-link auth (no password at signup) | simPRO and ServiceM8 portals are invite-only; Matt controls who gets access; password reset flows add support burden | LOW | Supabase Auth magic link; Supabase RLS enforces per-client data isolation |
| Compliance status dashboard (RAG — Red/Amber/Green per document/area) | Aurora client portal, FireHub, and iProtectU all surface a visual "fire risk position" dashboard; clients expect to know at a glance whether they are compliant | MEDIUM | Derived from expiry dates and document statuses; status badge component |
| Document library (assessments, certificates, uploaded documents) | simPRO customer portal, Aurora, and the FireHub portal all provide a structured document library; clients expect to download their FRA PDF from the portal | LOW | Supabase Storage + RLS-isolated file listing |
| Expiry tracking per document / certificate | simPRO surfaces "assets and other important information"; iProtectU offers "automated reminders"; renewal date management is a table-stakes feature for any compliance product | MEDIUM | `compliance_documents` table with `expires_at`; status derived at query time |
| 30/14/7-day expiry alert emails/SMS | AssessKit sends "automated reminders 30 days before reassessments are due" as a headline feature; clients who miss renewal deadlines expose themselves to regulatory risk and will blame the platform | MEDIUM | n8n daily cron (D7); dedup via `(document_id, window, recipient)` |
| Notification on new document upload | Baseline expectation in any portal: clients must know when Matt has uploaded something new | LOW | Twilio SMS + n8n email (D6) |
| Hours balance display | simPRO shows "balance outstanding"; clients who have pre-purchased consulting hours need a live view to avoid surprise invoices | LOW | Read from `hours_balance` table; read-only client view |
| PayPal checkout for hours top-up | Clients need a self-serve payment route; simPRO and ServiceM8 both support in-portal invoice payment | MEDIUM | PayPal Orders v2 + webhook (D5) |
| Mobile-responsive portal | ServiceM8 is explicitly mobile-first; clients checking compliance status do so on their phones | MEDIUM | Tailwind responsive layout; test at 375px |

#### D — Proposal + Contract Pipeline

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Service selection → draft proposal | PandaDoc and Proposify generate proposals from a product/service catalogue; manually typing pricing into a document is error-prone and slow | MEDIUM | Service catalogue from Packages.docx + Course List Master.xlsx; OpenAI via OpenRouter drafts the text |
| Variable merge (client name, site, services, pricing) | Every proposal tool from PandaDoc to Proposify to SignWell supports dynamic variable substitution in templates; a proposal without a client's name filled in looks unprofessional | LOW | Template variables resolved at generation time |
| Branded one-page proposal PDF | Matt's existing "Blank Proposal One Page Template" is the reference; output must match format/branding | MEDIUM | n8n generates against template; brand assets (logo, colours) embedded |
| Proposal state machine (draft → sent → accepted/declined → contract issued) | PandaDoc and Proposify both enforce document lifecycle states; without this, Matt cannot tell which proposals are open vs accepted | LOW | `status` enum on `proposals` table; state transitions triggered by e-sign webhook or admin action |
| E-signature on proposal | PandaDoc and Proposify include embedded e-sign as standard; a proposal without a signature mechanism requires a separate DocuSign/SignWell account | MEDIUM | SignWell API (default per PROJECT.md); embedded signing preferred |
| Auto-generate Service Agreement on proposal acceptance | Corollary of e-sign acceptance; PandaDoc can auto-trigger document generation workflows; Matt's Blank Service Agreement (20 clauses + 3 schedules) is the template | HIGH | n8n workflow triggered by SignWell webhook on proposal sign; fills clauses from proposal data |
| Dual-sign on Service Agreement (Matt + client) | Standard contract law requirement; both parties must sign; PandaDoc and SignWell both support ordered multi-party signing | MEDIUM | SignWell `signers` array with defined order |
| Signed document stored and accessible via portal | simPRO and PandaDoc both archive completed documents; clients expect to retrieve their signed contract from the portal | LOW | Store in Supabase Storage; link from portal document library |

#### E — Admin Dashboard

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single-pane view of all active clients | simPRO, Re-Flow, and every FSM platform leads with a client/site overview dashboard | LOW | Aggregated query across clients table |
| Expiry calendar / upcoming renewals | Aurora, iProtectU, and AssessKit all surface "renewal dates" prominently in the admin view | MEDIUM | Date-range query on `compliance_documents.expires_at` |
| Assessment submission status (draft/submitted/report-ready/delivered) | iAuditor and Re-Flow provide job/inspection progress tracking | LOW | Derived from `submissions.status` |
| Report review queue | Corollary of the review gate; Matt needs to see "reports awaiting my approval" without digging through all submissions | LOW | Filter submissions by `status = draft_ready_for_review` |
| Proposal pipeline view | Proposify and PandaDoc both offer a pipeline / deal-status view | LOW | Filter proposals by status |
| Hours balance per client | simPRO surfaces "balance outstanding" per customer; Matt needs to know who is running low | LOW | Read from `hours_balance` |
| Seed data (5–10 clients from Sample Contacts.xlsx) | Necessary for Matt to see the product working at handover; empty-state dashboards are unconvincing at demos | LOW | One-time migration script (D10/D11) |

---

### Differentiators (Why Replace SiteDocs)

Features that make 888's platform feel better than SiteDocs or AssessKit for Matt's specific workflow — the "why replace" case.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-field photo + audio label (not gallery-at-bottom) | SiteDocs and iAuditor attach photos to the overall inspection or section; Matt's workflow requires "Basement photo" attached to the Basement field, not floating in a gallery at the end — this is a genuine workflow gap in mainstream tools | HIGH | `field_media` table keyed to `(submission_id, field_key)`; photo displayed inline beneath the field during review |
| STT on every text field with visible mic indicator | No mainstream UK FRA software offers per-field voice dictation inline; the closest is Re-Flow's block-based forms which don't have field-level STT | MEDIUM | Web Speech API with fallback; visible "Listening..." state per field; keeps Matt's dictaphone muscle-memory |
| Minutes-not-days turnaround (dictate → PDF in same session) | Matt's current 5-day PA turnaround is the core pain; AssessKit promises "under 5 minutes" but only for report generation after manual form fill; this product combines STT-assisted fill + AI generation in one session | HIGH | End-to-end: Matt narrates on-site → STT populates fields → submit → n8n generates report → Matt reviews on tablet → deliver same day |
| Tablet-native UX (not phone-squished or desktop-shrunk) | iAuditor is phone-first and desktop-accessible but not optimised for Surface Pro / iPad landscape; SiteDocs is construction-crew oriented, not assessor-oriented | MEDIUM | Large form fields, large photo upload zones, side-by-side field + preview layout at tablet breakpoint |
| AI-assisted proposal drafting from service catalogue | No UK FRA-specific tool has this; Matt selects services from Packages.docx, AI drafts the covering narrative, total auto-calculates | HIGH | Differentiates from AssessKit/Aurora which stop at the assessment; turns 888 into an end-to-end business ops tool |
| Seamless assessment → proposal → contract pipeline | SiteDocs stops at the inspection report; simPRO handles proposals/contracts but not FRA-specific assessments; this product closes the loop in one place | HIGH | Linked `assessment_id` on proposals; Service Agreement auto-generated from accepted proposal |
| Branded output that matches Matt's existing design | Generic PDF templates from iAuditor or SiteDocs look generic; Matt's clients already receive a specific branded format — maintaining that instils trust from day one | MEDIUM | Few-shot prompting with YELLOW BROOM FRA + Blank Proposal template |
| Client portal with hours-balance top-up (PayPal) | No FRA-specific tool offers a client-facing hours wallet; clients can self-serve without calling Matt | MEDIUM | Unique to this build for this market |
| RLS-enforced per-client data isolation with a no-code portal | Multi-tenant correctness is standard SaaS practice but rare in small-consultancy tools; clients can confidently log in knowing they only see their own data | MEDIUM | Non-negotiable per PROJECT.md; Supabase RLS verified by adversarial test |

---

### Anti-Features (Deliberately NOT in MVP)

Features that seem logical or are commonly requested but should not be built in Phase 1. Each has a rationale and a "what to do instead" path.

| Feature | Why Requested | Why NOT in MVP | Alternative |
|---------|---------------|----------------|-------------|
| Auto-deliver AI reports (no Matt review) | Faster delivery, less manual work | Matt reviews every report today; a wrong fire safety report is a liability, not a minor bug; removing the review gate in MVP is a trust failure, not an efficiency gain. PROJECT.md explicitly calls this out. | Ship review gate; add opt-in auto-deliver toggle only after Matt has reviewed 20–30 AI drafts and trusts the quality |
| Email/password signup for client portal | Clients want a "normal" login | Adds password-reset flow, account-lockout handling, brute-force protection — all non-trivial surface area for a product with 7–8 clients. Magic-link is secure and simpler. | Magic-link invite flow (D4); optional password set later if Matt requests it |
| In-app messaging / client-consultancy chat | Clients want to "ask Matt a question" | Whatsapp/email already works for 7–8 clients; a custom chat system is months of work and maintenance for no workflow gain at this scale. Matt communicates via WhatsApp group — that's not broken. | Notification on document upload (D6) handles the "something happened" signal; status badges handle the "are we compliant" question |
| Full CRM (contacts, pipeline, lead tracking) | Matt has a list of clients | simPRO costs £££/month partly because of its CRM; 888 has 7–8 clients and a Contacts spreadsheet. A CRM at this scale is overhead, not value. | Seed the client table from Sample Contacts.xlsx (D11); portal handles client relationship |
| Multi-user / team access (other consultants logging in) | Scalability planning | Matt is a solo operator; no other consultants are in scope. Multi-user roles add permission matrices, audit complexity, and test surface that will never be used in Phase 1. | Single admin role (Matt) + single client-portal role. Multi-user can be added if 888 grows. |
| Marketplace / service catalogue for clients to self-book | Clients could book assessments without calling | Self-booking requires scheduling, availability management, and payment confirmation flows that are all orthogonal to the core value. The proposal pipeline already covers the "client buys a service" flow. | Proposal pipeline (D8) covers the commercial interaction; rebooking on expiry is a Stage 5+ feature per PROJECT.md |
| Xero / QuickBooks accounting integration | Accounting automation | Explicitly deferred in PROJECT.md; 7–8 clients don't generate enough invoice volume to justify an integration build. | PayPal receipts + manual export; optionally an n8n Xero workflow post-MVP |
| Gamification (badges, streaks, safety scores) | "Engagement" | Completely misaligned with fire-safety compliance; a fire assessor's credibility depends on rigour, not gamification metrics. Clients would find it insulting. | Compliance status badges (RAG) are already the right engagement surface |
| Photo annotation (draw arrows, circles on photos) | Richer evidence | Aurora and iAuditor offer annotation but it requires a canvas editor (significant complexity). Matt's current workflow is "photo + short label" — annotation is not in his existing toolkit. | Per-field label text (short string) is sufficient for MVP; annotation can be added if Matt requests it post-launch |
| Offline mode in Phase 1 | Site signal is poor | Offline-first (PWA + IndexedDB) is correctly scoped to Phase 2 per PROJECT.md. Shipping a broken offline mode is worse than a clear "requires signal" warning. | "You are offline — data will not save" banner; Phase 2 service worker |
| Aggressive image compression (under 1MB) | Storage cost | Destroys fusebox/label legibility on high-res inspection photos. Project.md explicitly calls 1.2–1.5MB as the target, tested against `photo-fusebox-01.jpg`. | Compress to 1.2–1.5MB, verify legibility; accept storage cost |
| Rebooking / auto-quoting on expiry | "Close the loop automatically" | Flag + alert is the correct MVP default; auto-quoting requires Matt to approve pricing without human involvement in a regulated domain. Out of scope per PROJECT.md. | Expiry alert (D7) flags the renewal; Matt creates proposal manually from the admin dashboard |
| Public-facing marketing / landing page | "The product needs to be discoverable" | 888 is not a self-serve SaaS product; clients come via Matt's existing network, not SEO. A marketing site is a distraction from core product. | Handover walkthrough (D10) is the onboarding; share portal link with clients directly |
| Form builder UI exposed to clients | "Let clients build their own checklists" | Scope ambiguity explicitly flagged in PROJECT.md as pending Finley's answer; default assumption is Matt-only template editing. Client-facing form builder is Phase 2+ at best. | Matt-edits-templates workflow (Phase 1 default); revisit if Matt confirms client-editable forms |
| Stripe payment integration | Stripe is more widely used | Matt explicitly switched to PayPal on 2026-04-06 per PROJECT.md. Stripe implementation would directly contradict the signed scope. | PayPal Orders v2 only |

---

## Feature Dependencies

```
Schema versioning
    └──required-before──> Any form submission (D1, D2)
                              └──required-before──> AI report generation (D3)
                                                        └──required-before──> Report delivery to client portal (D4)

Form renderer (seed templates)
    └──required-before──> FRA assessment form (D1)
    └──required-before──> Site Risk assessment form (D2)

Client table + RLS + magic-link auth
    └──required-before──> Client compliance portal (D4)
    └──required-before──> Hours balance (D5)
    └──required-before──> Document upload notifications (D6)
    └──required-before──> Expiry alerts (D7)

Per-field photo upload
    └──required-before──> Photo embedding in generated PDF (D3)

PayPal Orders v2 + webhook
    └──required-before──> Hours top-up checkout (D5)

Proposal generation (D8)
    └──required-before──> E-sign on proposal (D8)
    └──required-before──> Auto-generate Service Agreement (D8)
                              └──required-before──> Dual-sign on Service Agreement (D8)
                                                        └──required-before──> Signed doc in portal (D4)

Admin dashboard (D9)
    └──enhances──> Report review queue (report gate in D3)
    └──enhances──> Proposal pipeline (D8)
    └──enhances──> Expiry calendar (D7)

Expiry alert cron (D7)
    └──requires──> Compliance document taxonomy + renewal periods (open question — blocks full D4/D7)
```

### Dependency Notes

- **Schema versioning required before D1:** Editing the FRA template after go-live must not corrupt historical submissions. The submission must pin to its schema version at capture time. This is a day-one structural requirement, not a Phase 2 addition.
- **Per-field photo required before D3:** The PDF generator must receive typed photo references (field key → signed URL) to embed images in the correct report section. A gallery-based approach would require a post-processing mapping step that is error-prone.
- **Client auth required before D4–D7:** RLS policies depend on `auth.uid()` being populated; the portal, hours, notifications, and alerts all live inside the RLS boundary.
- **Compliance taxonomy blocks D4/D7:** The expiry alert system cannot be built without knowing what document categories exist and their renewal periods. This is an open question requiring input from Matt (see PROJECT.md open questions register).
- **Proposal state machine must reach "accepted" before D8 contract generation:** The Service Agreement generation is triggered by the e-sign webhook on the proposal; if the proposal state machine is not implemented first, contract generation has no trigger.

---

## MVP Definition

### Launch With (Phase 1 — D1–D11)

These map directly to the signed 11-deliverable scope in PROJECT.md.

- [ ] Schema-versioned form renderer with FRA seed template (D1) — gating dependency for everything else
- [ ] Per-field photo + audio label upload (D1) — hard requirement; cannot be approximated with a gallery
- [ ] STT on every text field with fallback (D1) — core value prop; not deferrable
- [ ] AI report generation with review gate (D3) — core value prop; auto-deliver is explicitly out of scope
- [ ] Branded PDF output matching Matt's template (D3) — trust/credibility at day one
- [ ] Client compliance portal with magic-link auth + RLS (D4) — client-facing; required for handover
- [ ] Compliance status dashboard + document library (D4) — table stakes for client portal
- [ ] Expiry tracking + 30/14/7-day alerts (D7) — regulatory obligation for Matt's clients
- [ ] Hours balance + PayPal checkout (D5) — revenue mechanism; blocked on pricing model from Matt
- [ ] Document upload notifications — SMS + email (D6) — client trust signal
- [ ] Proposal + auto-contract pipeline with e-sign (D8) — commercial pipeline; replaces manual process
- [ ] Admin single-pane dashboard (D9) — Matt's daily-use tool
- [ ] Seed data + handover (D10/D11) — demo-readiness at go-live

### Add After Validation (Phase 1.x / Stage 5)

- [ ] Site Risk Assessment form (D2) — blocked on template + example from Matt; add as soon as unblocked
- [ ] Hours pricing model fine-tuning (D5) — blocked on Matt's pricing decision; plumbing ships in Phase 1
- [ ] Xero integration (optional n8n workflow) — deferred; add if Matt requests post-launch

### Future Consideration (Phase 2+)

- [ ] Drag-drop form builder with full field palette (Phase 2 — @coltorapps/builder)
- [ ] Conditional logic engine (Phase 2)
- [ ] Form assignment + scheduling with cron reminders (Phase 2)
- [ ] Offline PWA / service worker + IndexedDB sync (Phase 2)
- [ ] Repeating sections, signature fields, geolocation fields (Phase 2)
- [ ] Client-facing form editing (pending scope clarification with Matt)
- [ ] Rebooking / auto-quoting on expiry (Stage 5+ per PROJECT.md)
- [ ] Multi-user / team access for additional consultants
- [ ] Photo annotation (canvas editor on field photos)
- [ ] Auto-deliver toggle for AI reports (opt-in, after Matt trusts quality)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Schema versioning | HIGH | MEDIUM | P1 — gate for all form features |
| Per-field photo + label | HIGH | MEDIUM | P1 — hard requirement |
| STT on every text field | HIGH | LOW | P1 — core differentiator |
| AI report generation (n8n) | HIGH | HIGH | P1 — core value prop |
| Review gate (draft→approved→delivered) | HIGH | LOW | P1 — trust/liability requirement |
| Branded PDF output | HIGH | MEDIUM | P1 — client trust |
| Magic-link client auth + RLS | HIGH | LOW | P1 — portal foundation |
| Compliance status dashboard | HIGH | MEDIUM | P1 — client-facing table stakes |
| Document library (portal) | HIGH | LOW | P1 — client-facing table stakes |
| Expiry tracking + 30/14/7 alerts | HIGH | MEDIUM | P1 — regulatory obligation |
| Proposal pipeline + e-sign | HIGH | HIGH | P1 — commercial pipeline |
| Auto-contract generation | HIGH | HIGH | P1 — commercial pipeline |
| Hours balance display | MEDIUM | LOW | P1 — client trust |
| PayPal checkout | MEDIUM | MEDIUM | P1 — revenue mechanism |
| Upload notifications (SMS + email) | MEDIUM | LOW | P1 — client trust signal |
| Admin dashboard | HIGH | LOW | P1 — Matt's daily tool |
| Save-as-draft / autosave | HIGH | LOW | P1 — data safety |
| Audit trail | MEDIUM | LOW | P1 — regulatory/legal |
| Site Risk Assessment form (D2) | HIGH | LOW | P1 — blocked on template |
| Offline mode (PWA) | HIGH | HIGH | P2 — Phase 2 scope |
| Drag-drop form builder | HIGH | HIGH | P2 — Phase 2 scope |
| Conditional logic engine | MEDIUM | HIGH | P2 — Phase 2 scope |
| Photo annotation | LOW | HIGH | P3 — nice to have |
| Auto-deliver toggle | LOW | LOW | P3 — after quality validation |

**Priority key:**
- P1: Must have for Phase 1 launch (signed scope)
- P2: Phase 2 scope (form builder milestone)
- P3: Nice to have, defer until product-market fit confirmed

---

## Competitor Feature Analysis

| Feature | SiteDocs | iAuditor (SafetyCulture) | AssessKit | Aurora FRA | 888 Platform |
|---------|----------|--------------------------|-----------|------------|--------------|
| Mobile/tablet form fill | Yes (phone-first) | Yes (phone-first) | Yes | Yes | Tablet-first (Surface Pro / iPad primary) |
| Per-field photo (not gallery) | No — form-level photos | Attachable to questions (section-level) | Yes (on-site capture) | Yes (floorplan tagging) | Yes — per `field_key`, with short text label |
| STT / voice input | No | No | No | No | Yes — Web Speech API on every text field |
| Offline mode | Yes (Offline Jobsite Mode) | Partial (caches templates, limited offline creation) | Unconfirmed | Yes (testimonials) | Phase 2 (PWA + IndexedDB) |
| Conditional logic | Unclear | Yes (show/hide on answer) | Unconfirmed | Unconfirmed | Phase 2 |
| AI report generation | No | No (Copilot for analytics, not full report gen) | No (template-fill only) | No | Yes — GPT-4 via n8n, few-shot |
| Human review gate | N/A | N/A | N/A | N/A | Yes — explicit draft→approved→delivered state machine |
| Branded PDF export | Generic template | Customisable template | Yes (PAS 79 branded) | Yes | Yes — matches Matt's existing template |
| Client compliance portal | No | No | No | Yes (interactive portal) | Yes — magic-link, RAG status, doc library |
| Expiry alerts | No (construction cert tracking only) | No | Yes (30-day reminders) | Yes | Yes — 30/14/7-day, n8n cron |
| Proposal + e-sign pipeline | No | No | No | No | Yes — OpenAI draft + SignWell |
| Auto-contract generation | No | No | No | No | Yes — n8n on e-sign webhook |
| Hours balance + payment | No | No | No | No | Yes — PayPal Orders v2 |
| PAS 79:2020 alignment | No (construction focused) | Generic | Yes | Yes | Yes — YELLOW BROOM FRA as few-shot reference |
| UK market focus | No (global) | No (global) | Yes | Yes | Yes |

---

## Sources

- SafetyCulture (iAuditor) feature documentation: [Capterra comparison](https://www.capterra.com/compare/141080-143579/iAuditor-vs-SiteDocs), [GetApp 2025](https://www.getapp.com/operations-management-software/a/iauditor/)
- SiteDocs: [SafetyCulture vs SiteDocs — Software Advice 2026](https://www.softwareadvice.com/cmms/iauditor-profile/vs/sitedocs/)
- Re-Flow UK field management: [Features page](https://re-flow.co.uk/product/features)
- Aurora FRA software: [Features page](https://auroradataltd.co.uk/features/)
- AssessKit UK fire risk assessment: [assesskit.co.uk](https://assesskit.co.uk/)
- FlowForma UK fire risk assessment software roundup: [10 Best Fire Risk Assessment Software 2026](https://www.flowforma.com/en-gb/blog/best-fire-risk-assessment-software)
- BS 9792 vs PAS 79 2025 update: [Anstey Horne](https://www.ansteyhorne.co.uk/news/bs-9792-vs-pas-79)
- iProtectU fire risk: [iprotectu.com](https://iprotectu.com/fire-risk-assessment-software/)
- simPRO customer portal: [Customer Portal Guide](https://helpguide.simprogroup.com/Content/Service-and-Enterprise/Customer-Portal.htm)
- PandaDoc vs Proposify features: [Oneflow comparison 2026](https://oneflow.com/blog/pandadoc-vs-proposify/), [PandaDoc alternatives — SignWell](https://www.signwell.com/resources/pandadoc-alternatives/)
- SignWell API and audit trail: [SignWell eSignature for SaaS](https://www.signwell.com/industries/technology-and-saas-enterprises/)
- AI review gate patterns (legal SaaS): [AI workflows in legal practice](https://blog.promise.legal/ai-workflows-in-legal-practice-a-practical-transformation-guide/)
- Speech-to-text accuracy 2025: [Zapier STT roundup 2026](https://zapier.com/blog/best-text-dictation-software/)
- SafetyCulture alternatives 2025: [Field1st roundup](https://field1st.com/blog/safetyculture-alternatives-competitors/)

---

*Feature research for: 888 Safety & Training — UK H&S / Fire-Risk Compliance SaaS*
*Researched: 2026-04-15*
