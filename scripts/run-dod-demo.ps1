param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$OutputDir = "docs/Test/evidence"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$script:RequestLog = @()
$script:SensitiveKeys = @(
    "password",
    "newPassword",
    "setupCode",
    "uploadTicket",
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
                $safe[$textKey] = "__REDACTED__"
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
                $safe[$textKey] = "__REDACTED__"
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
        [Microsoft.PowerShell.Commands.WebRequestSession]$Session
    )

    $uri = "$BaseUrl$Path"
    $headers = @{
        "Accept" = "application/json"
    }

    $bodyJson = $null
    if ($null -ne $Body) {
        $headers["Content-Type"] = "application/json"
        $bodyJson = $Body | ConvertTo-Json -Depth 30 -Compress
    }

    try {
        if ($null -ne $bodyJson) {
            if ($Session) {
                $parsed = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $bodyJson -WebSession $Session
            } else {
                $parsed = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $bodyJson
            }
        } else {
            if ($Session) {
                $parsed = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -WebSession $Session
            } else {
                $parsed = Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
            }
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

function New-BridgeDemoPdfBytes {
    $content = "BT`n/F1 18 Tf`n72 720 Td`n(Bridge DoD Demo) Tj`nET"
    $contentLength = [System.Text.Encoding]::ASCII.GetByteCount($content)
    $objects = @(
        "1 0 obj`n<< /Type /Catalog /Pages 2 0 R >>`nendobj`n",
        "2 0 obj`n<< /Type /Pages /Kids [3 0 R] /Count 1 >>`nendobj`n",
        "3 0 obj`n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`nendobj`n",
        "4 0 obj`n<< /Length $contentLength >>`nstream`n$content`nendstream`nendobj`n",
        "5 0 obj`n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`nendobj`n"
    )

    $builder = New-Object System.Text.StringBuilder
    $null = $builder.Append("%PDF-1.4`n")
    $offsets = New-Object System.Collections.Generic.List[int]

    foreach ($obj in $objects) {
        $offsets.Add([System.Text.Encoding]::ASCII.GetByteCount($builder.ToString()))
        $null = $builder.Append($obj)
    }

    $xrefOffset = [System.Text.Encoding]::ASCII.GetByteCount($builder.ToString())
    $null = $builder.Append("xref`n0 $($objects.Count + 1)`n")
    $null = $builder.Append("0000000000 65535 f `n")
    foreach ($offset in $offsets) {
        $null = $builder.Append(("{0:D10} 00000 n `n" -f $offset))
    }
    $null = $builder.Append("trailer`n<< /Size $($objects.Count + 1) /Root 1 0 R >>`n")
    $null = $builder.Append("startxref`n$xrefOffset`n%%EOF")

    return [System.Text.Encoding]::ASCII.GetBytes($builder.ToString())
}

function Get-BridgeSha256Hex {
    param([byte[]]$Bytes)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha.ComputeHash($Bytes)
        return [System.BitConverter]::ToString($hash).Replace("-", "").ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Upload-BridgePresignedObject {
    param(
        [string]$UploadUrl,
        [string]$ContentType,
        [byte[]]$Bytes
    )

    if ([string]::IsNullOrWhiteSpace($UploadUrl)) {
        throw "[UPLOAD] Presigned uploadUrl is empty."
    }

    $handler = $null
    $client = $null
    $content = $null
    try {
        $handler = New-Object System.Net.Http.HttpClientHandler
        $client = [System.Net.Http.HttpClient]::new($handler)
        $content = [System.Net.Http.ByteArrayContent]::new($Bytes)
        $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($ContentType)
        $response = $client.PutAsync($UploadUrl, $content).GetAwaiter().GetResult()
        if (-not $response.IsSuccessStatusCode) {
            $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            throw "status=$([int]$response.StatusCode), body=$body"
        }
    } catch {
        throw "[UPLOAD] PUT failed: $($_.Exception.Message) (url=$UploadUrl)"
    } finally {
        if ($null -ne $content) { $content.Dispose() }
        if ($null -ne $client) { $client.Dispose() }
        if ($null -ne $handler) { $handler.Dispose() }
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

$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$pmSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$clientSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host "Running DoD scenarios against $BaseUrl"

# Scenario 1: admin tenant + PM user
$null = Invoke-BridgeApi -Step "S1-admin-login" -Method "POST" -Path "/api/auth/login" -Session $adminSession -Body @{
    email      = "admin@bridge.local"
    password   = "password"
    tenantSlug = "bridge"
}

$tenant = Invoke-BridgeApi -Step "S1-create-tenant" -Method "POST" -Path "/api/admin/tenants" -Session $adminSession -Body @{
    name = $tenantName
    slug = $tenantSlug
}
$tenantId = $tenant.data.id

$pmUser = Invoke-BridgeApi -Step "S1-create-pm-user" -Method "POST" -Path "/api/admin/tenants/$tenantId/pm-users" -Session $adminSession -Body @{
    email = $pmEmail
    name  = "DoD PM $timestamp"
}
$pmUserId = $pmUser.data.userId

# Scenario 2: pm project create + invite client
$null = Invoke-BridgeApi -Step "S2-pm-login" -Method "POST" -Path "/api/auth/login" -Session $pmSession -Body @{
    email      = $pmEmail
    password   = $pmPassword
    tenantSlug = $tenantSlug
}

$project = Invoke-BridgeApi -Step "S2-create-project" -Method "POST" -Path "/api/projects" -Session $pmSession -Body @{
    name        = "DoD Project $timestamp"
    description = "DoD scenario execution"
}
$projectId = $project.data.id

$invite = Invoke-BridgeApi -Step "S2-invite-client" -Method "POST" -Path "/api/projects/$projectId/members/invite" -Session $pmSession -Body @{
    role    = "CLIENT_OWNER"
    loginId = $clientEmail
    name    = "DoD Client $timestamp"
}
$clientMemberId = $invite.data.id
$clientSetupCode = $invite.data.setupCode

# Scenario 3: client first-password + login
$firstPassword = Invoke-BridgeApi -Step "S3-first-password" -Method "POST" -Path "/api/auth/first-password" -Body @{
    email       = $clientEmail
    setupCode   = $clientSetupCode
    newPassword = $clientPassword
}

$null = Invoke-BridgeApi -Step "S3-client-login" -Method "POST" -Path "/api/auth/login" -Session $clientSession -Body @{
    email      = $clientEmail
    password   = $clientPassword
    tenantSlug = $tenantSlug
}

# Scenario 4: post/request/decision
$post = Invoke-BridgeApi -Step "S4-create-post" -Method "POST" -Path "/api/projects/$projectId/posts" -Session $pmSession -Body @{
    type   = "GENERAL"
    title  = "DoD Post $timestamp"
    body   = "post body"
    pinned = $false
}
$postId = $post.data.id

$request = Invoke-BridgeApi -Step "S4-create-request" -Method "POST" -Path "/api/projects/$projectId/requests" -Session $clientSession -Body @{
    type        = "FEEDBACK"
    title       = "DoD Request $timestamp"
    description = "request description"
}
$requestId = $request.data.id

$requestStatus = Invoke-BridgeApi -Step "S4-update-request-status" -Method "PATCH" -Path "/api/requests/$requestId/status" -Session $pmSession -Body @{
    status = "SENT"
}

$decision = Invoke-BridgeApi -Step "S4-create-decision" -Method "POST" -Path "/api/projects/$projectId/decisions" -Session $pmSession -Body @{
    title     = "DoD Decision $timestamp"
    rationale = "decision rationale"
}
$decisionId = $decision.data.id

$decisionStatus = Invoke-BridgeApi -Step "S4-update-decision-status" -Method "PATCH" -Path "/api/decisions/$decisionId/status" -Session $pmSession -Body @{
    status = "REJECTED"
}

# Scenario 5: file/version/comment
$file = Invoke-BridgeApi -Step "S5-create-file" -Method "POST" -Path "/api/projects/$projectId/files" -Session $pmSession -Body @{
    name        = "dod-spec-$slugSuffix.pdf"
    description = "DoD file"
    folder      = "/docs"
}
$fileId = $file.data.id

$pdfBytes = New-BridgeDemoPdfBytes
$pdfSize = [long]$pdfBytes.Length
$pdfChecksum = Get-BridgeSha256Hex -Bytes $pdfBytes

$presign = Invoke-BridgeApi -Step "S5-presign-version" -Method "POST" -Path "/api/files/$fileId/versions/presign" -Session $pmSession -Body @{
    contentType = "application/pdf"
    size        = $pdfSize
    checksum    = $pdfChecksum
}

$null = Upload-BridgePresignedObject -UploadUrl $presign.data.uploadUrl -ContentType $presign.data.contentType -Bytes $pdfBytes

$fileVersion = Invoke-BridgeApi -Step "S5-complete-version" -Method "POST" -Path "/api/files/$fileId/versions/complete" -Session $pmSession -Body @{
    version     = $presign.data.version
    objectKey   = $presign.data.objectKey
    contentType = $presign.data.contentType
    size        = $presign.data.size
    checksum    = $presign.data.checksum
    uploadTicket = $presign.data.uploadTicket
}
$fileVersionId = $fileVersion.data.id

$fileComment = Invoke-BridgeApi -Step "S5-comment-file-version" -Method "POST" -Path "/api/file-versions/$fileVersionId/comments" -Session $clientSession -Body @{
    body   = "please update title block"
    coordX = 10
    coordY = 10
    coordW = 120
    coordH = 40
}
$fileCommentId = $fileComment.data.id

$resolvedComment = Invoke-BridgeApi -Step "S5-resolve-file-comment" -Method "PATCH" -Path "/api/file-comments/$fileCommentId/resolve" -Session $pmSession

# Scenario 6: meeting + client response
$startAt = (Get-Date).AddDays(1).ToUniversalTime().ToString("o")
$endAt = (Get-Date).AddDays(1).AddHours(1).ToUniversalTime().ToString("o")

$meeting = Invoke-BridgeApi -Step "S6-create-meeting" -Method "POST" -Path "/api/projects/$projectId/meetings" -Session $pmSession -Body @{
    title   = "DoD Weekly Sync"
    startAt = $startAt
    endAt   = $endAt
    meetUrl = "https://meet.example.com/$slugSuffix"
}
$meetingId = $meeting.data.id

$meetingResponse = Invoke-BridgeApi -Step "S6-client-respond-meeting" -Method "POST" -Path "/api/meetings/$meetingId/respond" -Session $clientSession -Body @{
    response = "ACCEPTED"
}

# Scenario 7: contract + signing
$contract = Invoke-BridgeApi -Step "S7-create-contract" -Method "POST" -Path "/api/projects/$projectId/contracts" -Session $pmSession -Body @{
    name          = "DoD Contract $timestamp"
    fileVersionId = $fileVersionId
}
$contractId = $contract.data.id

$envelope = Invoke-BridgeApi -Step "S7-create-envelope" -Method "POST" -Path "/api/contracts/$contractId/envelopes" -Session $pmSession -Body @{
    title = "DoD Sign Envelope"
}
$envelopeId = $envelope.data.id

$recipient = Invoke-BridgeApi -Step "S7-add-recipient" -Method "POST" -Path "/api/envelopes/$envelopeId/recipients" -Session $pmSession -Body @{
    name         = "DoD Client Signer"
    email        = $clientEmail
    signingOrder = 1
}
$recipientId = $recipient.data.id

$signatureField = Invoke-BridgeApi -Step "S7-add-signature-field" -Method "POST" -Path "/api/envelopes/$envelopeId/fields" -Session $pmSession -Body @{
    recipientId = $recipientId
    type        = "SIGNATURE"
    page        = 1
    coordX      = 100
    coordY      = 200
    coordW      = 120
    coordH      = 40
}

$null = Invoke-BridgeApi -Step "S7-send-envelope" -Method "POST" -Path "/api/envelopes/$envelopeId/send" -Session $pmSession
$null = Invoke-BridgeApi -Step "S7-view-signing" -Method "POST" -Path "/api/signing/contracts/$contractId/viewed" -Session $clientSession
$submitSigning = Invoke-BridgeApi -Step "S7-submit-signing" -Method "POST" -Path "/api/signing/contracts/$contractId/submit" -Session $clientSession -Body @{
    fieldValues = @{
        "$($signatureField.data.id)" = "Signed by DoD"
    }
}
$signatureEvents = Invoke-BridgeApi -Step "S7-signature-events" -Method "GET" -Path "/api/envelopes/$envelopeId/events" -Session $pmSession

# Scenario 8: billing
$invoice = Invoke-BridgeApi -Step "S8-create-invoice" -Method "POST" -Path "/api/projects/$projectId/invoices" -Session $pmSession -Body @{
    invoiceNumber = "INV-$slugSuffix"
    amount        = 1000000
    currency      = "KRW"
    dueAt         = (Get-Date).AddDays(7).ToUniversalTime().ToString("o")
    phase         = "FINAL"
}
$invoiceId = $invoice.data.id

$invoiceStatus = Invoke-BridgeApi -Step "S8-confirm-invoice" -Method "PATCH" -Path "/api/invoices/$invoiceId/status" -Session $clientSession -Body @{
    status = "CONFIRMED"
}

$null = Invoke-BridgeApi -Step "S8-add-attachment" -Method "POST" -Path "/api/invoices/$invoiceId/attachments/complete" -Session $clientSession -Body @{
    attachmentType = "PROOF"
    objectKey      = "dod/$projectId/invoice-proof.pdf"
}
$invoiceAttachments = Invoke-BridgeApi -Step "S8-list-attachments" -Method "GET" -Path "/api/invoices/$invoiceId/attachments" -Session $pmSession

# Scenario 9: vault
$policy = Invoke-BridgeApi -Step "S9-create-policy" -Method "POST" -Path "/api/projects/$projectId/vault/policies" -Session $pmSession -Body @{
    name     = "DoD Vault Policy"
    ruleJson = '{"allow":["REQUEST","REVEAL"]}'
}
$policyId = $policy.data.id

$secret = Invoke-BridgeApi -Step "S9-create-secret" -Method "POST" -Path "/api/projects/$projectId/vault/secrets" -Session $pmSession -Body @{
    name          = "DoD Production DB"
    type          = "DB"
    plainSecret   = "postgres://db-user:db-pass@db.internal:5432/bridge"
    siteUrl       = "https://db.internal"
    requestReason = "E2E DoD validation"
}
$secretId = $secret.data.id

$accessRequest = Invoke-BridgeApi -Step "S9-request-access" -Method "POST" -Path "/api/vault/secrets/$secretId/access-requests" -Session $clientSession
$accessRequestId = $accessRequest.data.id

$approveRequest = Invoke-BridgeApi -Step "S9-approve-access" -Method "PATCH" -Path "/api/vault/access-requests/$accessRequestId" -Session $pmSession -Body @{
    status = "APPROVED"
}

$revealSecret = Invoke-BridgeApi -Step "S9-reveal-secret" -Method "POST" -Path "/api/vault/secrets/$secretId/reveal" -Session $pmSession

$scenarios = [ordered]@{
    "1" = [ordered]@{ status = "DONE"; tenantId = $tenantId; pmUserId = $pmUserId }
    "2" = [ordered]@{ status = "DONE"; projectId = $projectId; clientMemberId = $clientMemberId }
    "3" = [ordered]@{ status = "DONE"; passwordInitialized = $firstPassword.data.passwordInitialized }
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
    "| 2 | DONE | projectId=$projectId, clientMemberId=$clientMemberId |",
    "| 3 | DONE | passwordInitialized=$($firstPassword.data.passwordInitialized) |",
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
