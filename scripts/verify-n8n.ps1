<#
.SYNOPSIS
  Run controlled canaries against the two production Merlin n8n webhooks.

.DESCRIPTION
  The app uses n8n for four admin activity emails:

    1. General activity webhook -> N8N_WEBHOOK_URL
       Header: X-Webhook-Secret: <secret>
       Events: client_form_created, client_form_submitted,
               client_template_cloned

    2. Assessment webhook -> N8N_ASSESSMENT_WEBHOOK_URL
       Header: Authorization: Bearer <secret>
       Event: a submitted assessment id

  A passing response is HTTP 200 with {"ok":true,"delivered":true}. n8n sends
  these canaries to the workflow's fixed admin inbox, so every invocation sends
  a real email. The script never writes or prints either secret.

.EXAMPLE
  ./scripts/verify-n8n.ps1 `
    -GeneralUrl "https://example.app.n8n.cloud/webhook/888-notifications" `
    -GeneralSecret "shared-secret" `
    -Only client_form_submitted

.EXAMPLE
  ./scripts/verify-n8n.ps1 `
    -AssessmentUrl "https://example.app.n8n.cloud/webhook/assessment-report" `
    -AssessmentSecret "assessment-secret"
#>

[CmdletBinding()]
param(
  [string]$GeneralUrl,
  [string]$GeneralSecret,
  [ValidateSet(
    "client_form_created",
    "client_form_submitted",
    "client_template_cloned"
  )]
  [string]$Only,
  [string]$AssessmentUrl,
  [string]$AssessmentSecret
)

$ErrorActionPreference = "Stop"
$canaryId = [guid]::NewGuid().ToString()
$now = [DateTime]::UtcNow.ToString("o")

$payloads = [ordered]@{
  client_form_created = @{
    type = "client_form_created"
    client_id = "canary-client-$canaryId"
    client_name = "888 n8n canary"
    template_id = "canary-template-$canaryId"
    template_name = "Canary form template"
    template_type = "custom"
    created_at = $now
  }
  client_form_submitted = @{
    type = "client_form_submitted"
    client_id = "canary-client-$canaryId"
    client_name = "888 n8n canary"
    submission_id = "canary-submission-$canaryId"
    assignment_id = $null
    submitted_at = $now
  }
  client_template_cloned = @{
    type = "client_template_cloned"
    client_id = "canary-client-$canaryId"
    client_name = "888 n8n canary"
    template_id = "canary-fork-$canaryId"
    template_name = "Canary copied template"
    parent_template_id = "canary-master-$canaryId"
    cloned_at = $now
  }
}

function Send-Canary {
  param(
    [string]$Url,
    [hashtable]$Headers,
    [hashtable]$Body,
    [string]$Label
  )

  $json = $Body | ConvertTo-Json -Depth 6 -Compress
  Write-Host "POST $Label" -ForegroundColor Cyan
  try {
    $response = Invoke-WebRequest `
      -Uri $Url `
      -Method Post `
      -Headers $Headers `
      -Body $json `
      -ContentType "application/json" `
      -SkipHttpErrorCheck

    $acknowledged = $false
    if ($response.Content) {
      try {
        $body = $response.Content | ConvertFrom-Json
        $acknowledged =
          $response.StatusCode -eq 200 -and
          $body.ok -eq $true -and
          $body.delivered -eq $true
      } catch {
        $acknowledged = $false
      }
    }

    if ($acknowledged) {
      Write-Host "  PASS: Gmail delivery acknowledged" -ForegroundColor Green
    } else {
      Write-Host "  FAIL: HTTP $($response.StatusCode) $($response.Content)" -ForegroundColor Red
    }
  } catch {
    Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red
  }
}

if ($GeneralUrl) {
  if (-not $GeneralSecret) {
    throw "-GeneralSecret is required when -GeneralUrl is set."
  }
  $targets = if ($Only) { @($Only) } else { $payloads.Keys }
  foreach ($type in $targets) {
    Send-Canary `
      -Url $GeneralUrl `
      -Headers @{ "X-Webhook-Secret" = $GeneralSecret } `
      -Body $payloads[$type] `
      -Label $type
  }
}

if ($AssessmentUrl) {
  if (-not $AssessmentSecret) {
    throw "-AssessmentSecret is required when -AssessmentUrl is set."
  }
  Send-Canary `
    -Url $AssessmentUrl `
    -Headers @{ Authorization = "Bearer $AssessmentSecret" } `
    -Body @{ submissionId = "canary-submission-$canaryId" } `
    -Label "assessment-submitted"
}

if (-not $GeneralUrl -and -not $AssessmentUrl) {
  Write-Host "No canary selected. Pass a webhook URL and its matching secret." -ForegroundColor Yellow
  Write-Host "See: Get-Help ./scripts/verify-n8n.ps1 -Full"
}
