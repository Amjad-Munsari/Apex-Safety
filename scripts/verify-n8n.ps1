<#
.SYNOPSIS
  Verify the two 888 Safety n8n webhooks by firing the exact payloads the app sends.

.DESCRIPTION
  The app talks to n8n over two separate webhooks (see lib/notifications/n8n-dispatch.ts
  and app/admin/assessments/actions.ts):

    1. General notifications  -> N8N_WEBHOOK_URL
       Header  : X-Webhook-Secret: <secret>
       Body    : typed payload, switched on `type` (11 types)

    2. Assessment report      -> N8N_ASSESSMENT_WEBHOOK_URL
       Header  : (none beyond Content-Type)
       Body    : { "submissionId": "<uuid>" }

  This script fires each one and prints the HTTP status + response body so you can
  see, per type, whether your n8n Switch has a matching branch and whether the
  Proton email goes out. Whichever `type` does NOT yield an email is a missing
  Switch branch -> that's your gap list.

  Secrets are passed as parameters at runtime. Nothing is written to disk.

.EXAMPLE
  # Fire ALL 11 general-webhook payloads:
  ./scripts/verify-n8n.ps1 `
      -GeneralUrl "https://n8n.example.com/webhook/notify" `
      -Secret     "your-shared-secret" `
      -ToEmail    "you@your-inbox.com"

.EXAMPLE
  # Fire just one type:
  ./scripts/verify-n8n.ps1 -GeneralUrl "..." -Secret "..." -ToEmail "..." -Only client_portal_invite

.EXAMPLE
  # Verify the assessment webhook with a REAL submission id from form_submissions:
  ./scripts/verify-n8n.ps1 -AssessmentUrl "https://n8n.example.com/webhook/assessment" -SubmissionId "<uuid>"
#>

[CmdletBinding()]
param(
  # --- General notifications webhook (N8N_WEBHOOK_URL) ---
  [string]$GeneralUrl,
  [string]$Secret,
  # Recipient inbox the test emails should arrive at. Use an inbox you control.
  [string]$ToEmail = "REPLACE-WITH-YOUR-INBOX@example.com",
  # Fire only this single `type` (omit to fire all 11).
  [string]$Only,

  # --- Assessment report webhook (N8N_ASSESSMENT_WEBHOOK_URL) ---
  [string]$AssessmentUrl,
  # A real form_submissions.id so the n8n workflow can resolve the rest from Supabase.
  [string]$SubmissionId
)

$ErrorActionPreference = "Stop"
$siteUrl = "https://example.com"   # only used to build plausible URLs in payloads

# ---------------------------------------------------------------------------
# The 11 general-webhook payloads, byte-shape-matched to the NotificationPayload
# union in lib/notifications/n8n-dispatch.ts. Edit field values freely.
# NOTE: the 3 client_form_* events deliberately carry ONLY client_id — n8n must
#       resolve recipient name/email from Supabase (service role) for those.
# ---------------------------------------------------------------------------
$payloads = [ordered]@{
  expiry_alert = @{
    type = "expiry_alert"; client_email = $ToEmail; client_name = "Acme Test Ltd"
    document_name = "Fire Risk Assessment"; expiry_date = "2026-07-15"; days_until_expiry = 14
  }
  document_uploaded = @{
    type = "document_uploaded"; client_email = $ToEmail; client_name = "Acme Test Ltd"
    document_name = "Gas Safety Certificate.pdf"; document_category = "Gas Safety"; expiry_date = "2027-06-01"
  }
  assignment_reminder = @{
    type = "assignment_reminder"; cadence = "7d"; client_email = $ToEmail; client_name = "Acme Test Ltd"
    template_name = "Monthly Site Risk Check"; due_date = "2026-06-30"
    assignment_url = "$siteUrl/client/assignments/00000000-0000-0000-0000-000000000001"
    instructions = "Please complete before month end."
  }
  report_ready = @{
    type = "report_ready"; client_email = $ToEmail; client_name = "Acme Test Ltd"
    report_url = "$siteUrl/signed/report.pdf"; assessment_date = "12 June 2026"
    report_storage_path = "client-uuid/report_submission-uuid.pdf"
  }
  proposal_signature_request = @{
    type = "proposal_signature_request"; client_name = "Acme Test Ltd"; client_email = $ToEmail
    proposal_title = "Fire Safety Compliance Programme"; signing_url = "$siteUrl/sign/test-raw-token"
    expiry_date = "2026-06-26"
  }
  proposal_signed = @{
    type = "proposal_signed"; client_name = "Acme Test Ltd"; client_email = $ToEmail
    proposal_title = "Fire Safety Compliance Programme"; signed_at = "2026-06-12T10:30:00.000Z"
  }
  contract_issued = @{
    type = "contract_issued"; client_name = "Acme Test Ltd"; client_email = $ToEmail
    proposal_title = "Fire Safety Compliance Programme"; contract_url = "$siteUrl/signed/contract.pdf"
    issued_at = "2026-06-12T10:35:00.000Z"
  }
  client_portal_invite = @{
    type = "client_portal_invite"; client_name = "Acme Test Ltd"; recipient_name = "Jane Tester"
    recipient_email = $ToEmail; invite_url = "$siteUrl/auth/invite/single-use-token"; status = "invited"
  }
  # --- ID-only events: n8n must resolve recipient from Supabase ---
  client_form_created = @{
    type = "client_form_created"; client_id = "00000000-0000-0000-0000-000000000001"
    template_id = "00000000-0000-0000-0000-0000000000a1"; template_name = "Custom Site Checklist"
    template_type = "site_risk"; created_at = "2026-06-12T09:00:00.000Z"
  }
  client_form_submitted = @{
    type = "client_form_submitted"; client_id = "00000000-0000-0000-0000-000000000001"
    submission_id = "00000000-0000-0000-0000-0000000000b1"; assignment_id = $null
    submitted_at = "2026-06-12T09:15:00.000Z"
  }
  client_template_cloned = @{
    type = "client_template_cloned"; client_id = "00000000-0000-0000-0000-000000000001"
    template_id = "00000000-0000-0000-0000-0000000000c1"; template_name = "FRA (our version)"
    parent_template_id = "00000000-0000-0000-0000-0000000000d1"; cloned_at = "2026-06-12T09:20:00.000Z"
  }
}

function Send-Webhook {
  param([string]$Url, [hashtable]$Headers, $BodyObj, [string]$Label)
  $json = $BodyObj | ConvertTo-Json -Depth 6 -Compress
  Write-Host ""
  Write-Host "POST $Label" -ForegroundColor Cyan
  Write-Host "  body: $json" -ForegroundColor DarkGray
  try {
    $resp = Invoke-WebRequest -Uri $Url -Method Post -Headers $Headers -Body $json -ContentType "application/json" -SkipHttpErrorCheck
    $color = if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) { "Green" } else { "Yellow" }
    Write-Host "  -> HTTP $($resp.StatusCode)" -ForegroundColor $color
    if ($resp.Content) { Write-Host "  -> $($resp.Content)" -ForegroundColor DarkGray }
  } catch {
    Write-Host "  -> TRANSPORT ERROR: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# ---------------------------------------------------------------------------
# 1. General webhook
# ---------------------------------------------------------------------------
if ($GeneralUrl) {
  if (-not $Secret) { throw "-Secret is required when -GeneralUrl is set (X-Webhook-Secret header)." }
  $headers = @{ "X-Webhook-Secret" = $Secret }
  Write-Host "=== General notifications webhook ===" -ForegroundColor White
  Write-Host "    $GeneralUrl"
  $targets = if ($Only) { @($Only) } else { $payloads.Keys }
  foreach ($t in $targets) {
    if (-not $payloads.Contains($t)) { Write-Host "Unknown type: $t" -ForegroundColor Red; continue }
    Send-Webhook -Url $GeneralUrl -Headers $headers -BodyObj $payloads[$t] -Label $t
  }
}

# ---------------------------------------------------------------------------
# 2. Assessment webhook
# ---------------------------------------------------------------------------
if ($AssessmentUrl) {
  if (-not $SubmissionId) { throw "-SubmissionId is required when -AssessmentUrl is set." }
  Write-Host ""
  Write-Host "=== Assessment report webhook ===" -ForegroundColor White
  Write-Host "    $AssessmentUrl"
  Send-Webhook -Url $AssessmentUrl -Headers @{} -BodyObj @{ submissionId = $SubmissionId } -Label "assessment-submission"
}

if (-not $GeneralUrl -and -not $AssessmentUrl) {
  Write-Host "Nothing to do. Pass -GeneralUrl (+ -Secret) and/or -AssessmentUrl (+ -SubmissionId)." -ForegroundColor Yellow
  Write-Host "See: Get-Help ./scripts/verify-n8n.ps1 -Full"
}
