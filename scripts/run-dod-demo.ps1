param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$OutputDir = "docs/Test/evidence"
)

$ErrorActionPreference = "Stop"
$script:RequestLog = @()
$script:SensitiveKeys = @(
    "accessToken",
    "refreshToken",
    "password",
    "plainSecret",
    "secret",
    "secretCiphertext",
    "nonce"
)

function Sanitize-BridgeLogValue {
    param([object]$Value)

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $safe = [ordered]@{}
        foreach ($key in $Value.Keys) {
            $textKey = [string]$key
            if ($textKey -in $script:SensitiveKeys) {
                if ($textKey -in @("accessToken", "refreshToken")) {
                    $safe[$textKey] = "__REDACTED_TOKEN__"
                } else {
                    $safe[$textKey] = "__REDACTED_SECRET__"
                }
                continue
            }
            $safe[$textKey] = Sanitize-BridgeLogValue -Value $Value[$key]
        }
        return $safe
    }

    if ($Value -is [pscustomobject]) {
        $safe = [ordered]@{}
        foreach ($property in $Value.PSObject.Properties) {
            $textKey = [string]$property.Name
            if ($textKey -in $script:SensitiveKeys) {
                if ($textKey -in @("accessToken", "refreshToken")) {
                    $safe[$textKey] = "__REDACTED_TOKEN__"
                } else {
                    $safe[$textKey] = "__REDACTED_SECRET__"
                }
                continue
            }
            $safe[$textKey] = Sanitize-BridgeLogValue -Value $property.Value
        }
        return $safe
    }

    if (($Value -is [System.Collections.IEnumerable]) -and -not ($Value -is [string])) {
        return @($Value | ForEach-Object { Sanitize-BridgeLogValue -Value $_ })
    }

    return $Value
}

function Invoke-BridgeApi {
    param(
        [string]$Step,
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$AccessToken = $null
    )

    $uri = "$BaseUrl$Path"
    $headers = @{
        "Accept" = "application/json"
    }
    if ($AccessToken) {
        $headers["Authorization"] = "Bearer $AccessToken"
    }

    $bodyJson = $null
    if ($null -ne $Body) {
        $headers["Content-Type"] = "application/json"
        $bodyJson = $Body | ConvertTo-Json -Depth 30 -Compress
    }

    try {
        if ($null -ne $bodyJson) {
            $parsed = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $bodyJson
        } else {
            $parsed = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
        }

        $safeRequest = Sanitize-BridgeLogValue -Value $Body
        $safeResponse = Sanitize-BridgeLogValue -Value $parsed

        $script:RequestLog += [ordered]@{
            step       = $Step
            method     = $Method
            path       = $Path
            statusCode = 200
            request    = $safeRequest
            response   = $safeResponse
        }

        return $parsed
    } catch {
        $statusCode = $null
        $errorBody = $null
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode.value__
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorBody = $reader.ReadToEnd()
                $reader.Close()
            } catch {
                $errorBody = $_.Exception.Message
            }
        } else {
            $errorBody = $_.Exception.Message
        }

        $safeRequest = Sanitize-BridgeLogValue -Value $Body

        $script:RequestLog += [ordered]@{
            step       = $Step
            method     = $Method
            path       = $Path
            statusCode = $statusCode
            request    = $safeRequest
            response   = $errorBody
        }

        throw "[$Step] $Method $Path failed (status=$statusCode): $errorBody"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$slugSuffix = Get-Date -Format "yyyyMMddHHmmss"

$tenantSlug = "dod-$slugSuffix"
$tenantName = "DoD Tenant $timestamp"
$pmEmail = "pm+$slugSuffix@bridge.local"
$clientEmail = "client+$slugSuffix@bridge.local"
$pmPassword = "TempPassword!123"
$clientPassword = "Client!12345"

Write-Host "Running DoD scenarios against $BaseUrl"

# Scenario 1: admin tenant + PM user
$adminLogin = Invoke-BridgeApi -Step "S1-admin-login" -Method "POST" -Path "/api/auth/login" -Body @{
    email      = "admin@bridge.local"
    password   = "password"
    tenantSlug = "bridge"
}
$adminToken = $adminLogin.data.accessToken

$tenant = Invoke-BridgeApi -Step "S1-create-tenant" -Method "POST" -Path "/api/admin/tenants" -AccessToken $adminToken -Body @{
    name = $tenantName
    slug = $tenantSlug
}
$tenantId = $tenant.data.id

$pmUser = Invoke-BridgeApi -Step "S1-create-pm-user" -Method "POST" -Path "/api/admin/tenants/$tenantId/pm-users" -AccessToken $adminToken -Body @{
    email = $pmEmail
    name  = "DoD PM $timestamp"
}
$pmUserId = $pmUser.data.userId

# Scenario 2: pm project create + invite client
$pmLogin = Invoke-BridgeApi -Step "S2-pm-login" -Method "POST" -Path "/api/auth/login" -Body @{
    email      = $pmEmail
    password   = $pmPassword
    tenantSlug = $tenantSlug
}
$pmToken = $pmLogin.data.accessToken

$project = Invoke-BridgeApi -Step "S2-create-project" -Method "POST" -Path "/api/projects" -AccessToken $pmToken -Body @{
    name        = "DoD Project $timestamp"
    description = "DoD scenario execution"
}
$projectId = $project.data.id

$invite = Invoke-BridgeApi -Step "S2-invite-client" -Method "POST" -Path "/api/projects/$projectId/members/invite" -AccessToken $pmToken -Body @{
    email    = $clientEmail
    role     = "CLIENT_OWNER"
    loginId  = $clientEmail
    password = $clientPassword
    name     = "DoD Client $timestamp"
}
$invitationToken = $invite.data.invitationToken

# Scenario 3: client accept invitation
$clientLogin = Invoke-BridgeApi -Step "S3-client-login" -Method "POST" -Path "/api/auth/login" -Body @{
    email      = $clientEmail
    password   = $clientPassword
    tenantSlug = $tenantSlug
}
$clientToken = $clientLogin.data.accessToken

$acceptInvitation = Invoke-BridgeApi -Step "S3-accept-invitation" -Method "POST" -Path "/api/invitations/$invitationToken/accept" -AccessToken $clientToken

# Scenario 4: post/request/decision
$post = Invoke-BridgeApi -Step "S4-create-post" -Method "POST" -Path "/api/projects/$projectId/posts" -AccessToken $pmToken -Body @{
    type   = "GENERAL"
    title  = "DoD Post $timestamp"
    body   = "post body"
    pinned = $false
}
$postId = $post.data.id

$request = Invoke-BridgeApi -Step "S4-create-request" -Method "POST" -Path "/api/projects/$projectId/requests" -AccessToken $clientToken -Body @{
    type        = "FEEDBACK"
    title       = "DoD Request $timestamp"
    description = "request description"
}
$requestId = $request.data.id

$requestStatus = Invoke-BridgeApi -Step "S4-update-request-status" -Method "PATCH" -Path "/api/requests/$requestId/status" -AccessToken $pmToken -Body @{
    status = "IN_PROGRESS"
}

$decision = Invoke-BridgeApi -Step "S4-create-decision" -Method "POST" -Path "/api/projects/$projectId/decisions" -AccessToken $pmToken -Body @{
    title     = "DoD Decision $timestamp"
    rationale = "decision rationale"
}
$decisionId = $decision.data.id

$decisionStatus = Invoke-BridgeApi -Step "S4-update-decision-status" -Method "PATCH" -Path "/api/decisions/$decisionId/status" -AccessToken $pmToken -Body @{
    status = "APPROVED"
}

# Scenario 5: file/version/comment
$file = Invoke-BridgeApi -Step "S5-create-file" -Method "POST" -Path "/api/projects/$projectId/files" -AccessToken $pmToken -Body @{
    name        = "dod-spec-$slugSuffix.pdf"
    description = "DoD file"
    folder      = "/docs"
}
$fileId = $file.data.id

$fileVersion = Invoke-BridgeApi -Step "S5-complete-version" -Method "POST" -Path "/api/files/$fileId/versions/complete" -AccessToken $pmToken -Body @{
    version     = 1
    objectKey   = "dod/$projectId/spec-v1.pdf"
    contentType = "application/pdf"
    size        = 1024
    checksum    = "sha256-$slugSuffix"
}
$fileVersionId = $fileVersion.data.id

$fileComment = Invoke-BridgeApi -Step "S5-comment-file-version" -Method "POST" -Path "/api/file-versions/$fileVersionId/comments" -AccessToken $clientToken -Body @{
    body   = "please update title block"
    coordX = 10
    coordY = 10
    coordW = 120
    coordH = 40
}
$fileCommentId = $fileComment.data.id

$resolvedComment = Invoke-BridgeApi -Step "S5-resolve-file-comment" -Method "PATCH" -Path "/api/file-comments/$fileCommentId/resolve" -AccessToken $pmToken

# Scenario 6: meeting + client response
$startAt = (Get-Date).AddDays(1).ToUniversalTime().ToString("o")
$endAt = (Get-Date).AddDays(1).AddHours(1).ToUniversalTime().ToString("o")

$meeting = Invoke-BridgeApi -Step "S6-create-meeting" -Method "POST" -Path "/api/projects/$projectId/meetings" -AccessToken $pmToken -Body @{
    title   = "DoD Weekly Sync"
    startAt = $startAt
    endAt   = $endAt
    meetUrl = "https://meet.example.com/$slugSuffix"
}
$meetingId = $meeting.data.id

$meetingResponse = Invoke-BridgeApi -Step "S6-client-respond-meeting" -Method "POST" -Path "/api/meetings/$meetingId/respond" -AccessToken $clientToken -Body @{
    response = "ACCEPTED"
}

# Scenario 7: contract + signing
$contract = Invoke-BridgeApi -Step "S7-create-contract" -Method "POST" -Path "/api/projects/$projectId/contracts" -AccessToken $pmToken -Body @{
    name          = "DoD Contract $timestamp"
    fileVersionId = $fileVersionId
}
$contractId = $contract.data.id

$envelope = Invoke-BridgeApi -Step "S7-create-envelope" -Method "POST" -Path "/api/contracts/$contractId/envelopes" -AccessToken $pmToken -Body @{
    title = "DoD Sign Envelope"
}
$envelopeId = $envelope.data.id

$recipient = Invoke-BridgeApi -Step "S7-add-recipient" -Method "POST" -Path "/api/envelopes/$envelopeId/recipients" -AccessToken $pmToken -Body @{
    name         = "DoD Client Signer"
    email        = $clientEmail
    signingOrder = 1
}
$recipientId = $recipient.data.id
$recipientToken = $recipient.data.recipientToken

$signatureField = Invoke-BridgeApi -Step "S7-add-signature-field" -Method "POST" -Path "/api/envelopes/$envelopeId/fields" -AccessToken $pmToken -Body @{
    recipientId = $recipientId
    type        = "SIGNATURE"
    page        = 1
    coordX      = 100
    coordY      = 200
    coordW      = 120
    coordH      = 40
}

$sentEnvelope = Invoke-BridgeApi -Step "S7-send-envelope" -Method "POST" -Path "/api/envelopes/$envelopeId/send" -AccessToken $pmToken
$viewedEnvelope = Invoke-BridgeApi -Step "S7-view-signing" -Method "POST" -Path "/api/signing/$recipientToken/viewed" -AccessToken $clientToken
$submitSigning = Invoke-BridgeApi -Step "S7-submit-signing" -Method "POST" -Path "/api/signing/$recipientToken/submit" -AccessToken $clientToken
$signatureEvents = Invoke-BridgeApi -Step "S7-signature-events" -Method "GET" -Path "/api/envelopes/$envelopeId/events" -AccessToken $pmToken

# Scenario 8: billing
$invoice = Invoke-BridgeApi -Step "S8-create-invoice" -Method "POST" -Path "/api/projects/$projectId/invoices" -AccessToken $pmToken -Body @{
    invoiceNumber = "INV-$slugSuffix"
    amount        = 1000000
    currency      = "KRW"
    dueAt         = (Get-Date).AddDays(7).ToUniversalTime().ToString("o")
    phase         = "FINAL"
}
$invoiceId = $invoice.data.id

$invoiceStatus = Invoke-BridgeApi -Step "S8-confirm-invoice" -Method "PATCH" -Path "/api/invoices/$invoiceId/status" -AccessToken $clientToken -Body @{
    status = "CONFIRMED"
}

$invoiceAttachment = Invoke-BridgeApi -Step "S8-add-attachment" -Method "POST" -Path "/api/invoices/$invoiceId/attachments/complete" -AccessToken $clientToken -Body @{
    attachmentType = "PROOF"
    objectKey      = "dod/$projectId/invoice-proof.pdf"
}
$invoiceAttachments = Invoke-BridgeApi -Step "S8-list-attachments" -Method "GET" -Path "/api/invoices/$invoiceId/attachments" -AccessToken $pmToken

# Scenario 9: vault
$policy = Invoke-BridgeApi -Step "S9-create-policy" -Method "POST" -Path "/api/projects/$projectId/vault/policies" -AccessToken $pmToken -Body @{
    name     = "DoD Vault Policy"
    ruleJson = '{"allow":["REQUEST","REVEAL"]}'
}
$policyId = $policy.data.id

$secret = Invoke-BridgeApi -Step "S9-create-secret" -Method "POST" -Path "/api/projects/$projectId/vault/secrets" -AccessToken $pmToken -Body @{
    name          = "DoD Production DB"
    type          = "DB"
    plainSecret   = "postgres://db-user:db-pass@db.internal:5432/bridge"
    siteUrl       = "https://db.internal"
    requestReason = "E2E DoD validation"
}
$secretId = $secret.data.id

$accessRequest = Invoke-BridgeApi -Step "S9-request-access" -Method "POST" -Path "/api/vault/secrets/$secretId/access-requests" -AccessToken $clientToken
$accessRequestId = $accessRequest.data.id

$approveRequest = Invoke-BridgeApi -Step "S9-approve-access" -Method "PATCH" -Path "/api/vault/access-requests/$accessRequestId" -AccessToken $pmToken -Body @{
    status = "APPROVED"
}

$revealSecret = Invoke-BridgeApi -Step "S9-reveal-secret" -Method "POST" -Path "/api/vault/secrets/$secretId/reveal" -AccessToken $clientToken

$scenarios = [ordered]@{
    "1" = [ordered]@{ status = "DONE"; tenantId = $tenantId; pmUserId = $pmUserId }
    "2" = [ordered]@{ status = "DONE"; projectId = $projectId; invitationToken = $invitationToken }
    "3" = [ordered]@{ status = "DONE"; accepted = $acceptInvitation.data.accepted }
    "4" = [ordered]@{ status = "DONE"; postId = $postId; requestId = $requestId; requestStatus = $requestStatus.data.status; decisionId = $decisionId; decisionStatus = $decisionStatus.data.status }
    "5" = [ordered]@{ status = "DONE"; fileId = $fileId; fileVersionId = $fileVersionId; commentId = $fileCommentId; commentStatus = $resolvedComment.data.status }
    "6" = [ordered]@{ status = "DONE"; meetingId = $meetingId; attendeeResponse = $meetingResponse.data.response }
    "7" = [ordered]@{ status = "DONE"; contractId = $contractId; envelopeId = $envelopeId; recipientId = $recipientId; signingCompleted = $submitSigning.data.completed }
    "8" = [ordered]@{ status = "DONE"; invoiceId = $invoiceId; invoiceStatus = $invoiceStatus.data.status; attachmentCount = @($invoiceAttachments.data).Count }
    "9" = [ordered]@{ status = "DONE"; policyId = $policyId; secretId = $secretId; accessRequestId = $accessRequestId; accessStatus = $approveRequest.data.status; revealedVersion = $revealSecret.data.version }
}

$report = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    baseUrl = $BaseUrl
    tenantSlug = $tenantSlug
    users = [ordered]@{
        admin = "admin@bridge.local"
        pm = $pmEmail
        client = $clientEmail
    }
    scenarios = $scenarios
    requests = $script:RequestLog
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$jsonPath = Join-Path $OutputDir "dod-demo-$timestamp.json"
$mdPath = Join-Path $OutputDir "dod-demo-$timestamp.md"

$report | ConvertTo-Json -Depth 30 | Set-Content -Encoding UTF8 -Path $jsonPath

$mdLines = @(
    "# DoD Demo Scenarios 1~9 Evidence",
    "",
    "- Generated At (UTC): $($report.generatedAt)",
    "- API Base: $BaseUrl",
    "- Tenant Slug: $tenantSlug",
    "- PM Account: $pmEmail",
    "- Client Account: $clientEmail",
    "",
    "## Scenario Results",
    "",
    "| Scenario | Status | Evidence |",
    "|---|---|---|",
    "| 1 | DONE | tenantId=$tenantId, pmUserId=$pmUserId |",
    "| 2 | DONE | projectId=$projectId, invitationToken=$invitationToken |",
    "| 3 | DONE | accepted=$($acceptInvitation.data.accepted) |",
    "| 4 | DONE | postId=$postId, requestId=$requestId, decisionId=$decisionId |",
    "| 5 | DONE | fileId=$fileId, fileVersionId=$fileVersionId, commentId=$fileCommentId |",
    "| 6 | DONE | meetingId=$meetingId, response=$($meetingResponse.data.response) |",
    "| 7 | DONE | contractId=$contractId, envelopeId=$envelopeId, completed=$($submitSigning.data.completed) |",
    "| 8 | DONE | invoiceId=$invoiceId, status=$($invoiceStatus.data.status), attachments=$(@($invoiceAttachments.data).Count) |",
    "| 9 | DONE | secretId=$secretId, accessRequestId=$accessRequestId, revealVersion=$($revealSecret.data.version) |",
    "",
    "## API Logs",
    "",
    "- JSON: $(Resolve-Path -Path $jsonPath)",
    "- Total API calls: $($script:RequestLog.Count)"
)

$mdLines | Set-Content -Encoding UTF8 -Path $mdPath

Write-Host "DoD evidence generated:"
Write-Host " - $mdPath"
Write-Host " - $jsonPath"
