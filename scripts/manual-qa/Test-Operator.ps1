# Dependency-free Windows tests. No application, database, browser or network access.
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'Operator.psm1') -Force
$module = Get-Module Operator
$qaTestRoot = Join-Path (Split-Path (Split-Path $PSScriptRoot)) '.manual-qa'
$parentExisted = Test-Path -LiteralPath $qaTestRoot
$qaTestDirectory = Join-Path $qaTestRoot ('selftest-' + [guid]::NewGuid().ToString('N'))
$passed = 0
function Assert-True($value, $label) {
    if (-not $value) { throw "Test failed: $label" }
    $script:passed++
}
function Assert-Blocked($action, $code) {
    $caught = $false
    try { & $action | Out-Null } catch { $caught = $_.Exception.Message -eq "YELLOW/BLOCKED: $code" }
    Assert-True $caught $code
}
try {
    & $module { param($path) $script:StoreDirectory = $path } $qaTestDirectory
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'CONFIG_MISSING'
    Initialize-ManualQaStore | Out-Null
    Assert-Blocked { Initialize-ManualQaStore } 'STORE_EXISTS'
    Assert-Blocked { New-ManualQaIdentity -Alias AP -Email 'mtqa-new@example.test' -DesignationReference 'test-only' -SyntheticDisposable } 'IDENTITY_CLASSIFICATION'
    Assert-Blocked { New-ManualQaIdentity -Alias AUTO-QA -Email 'real@example.com' -DesignationReference 'test-only' -SyntheticDisposable } 'IDENTITY_CLASSIFICATION'
    Assert-Blocked { New-ManualQaIdentity -Alias AUTO-QA -Email 'mtqa-new@example.test' -DesignationReference 'test-only' } 'DESIGNATION_REQUIRED'
    New-ManualQaIdentity -Alias AUTO-QA -Email 'mtqa-new@example.test' -DesignationReference 'test-only-no-account-created' -SyntheticDisposable | Out-Null
    Assert-Blocked { New-ManualQaIdentity -Alias AUTO-QA -Email 'mtqa-other@example.test' -DesignationReference 'test-only' -SyntheticDisposable } 'IDENTITY_EXISTS'
    Assert-Blocked { New-ManualQaIdentity -Alias AUTO-OTHER -Email 'mtqa-new@example.test' -DesignationReference 'test-only' -SyntheticDisposable } 'IDENTITY_EXISTS'
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -PreservationVerified } 'AUTHORIZATION_REQUIRED'
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' } 'PRESERVATION_REQUIRED'
    Assert-Blocked { Get-ManualQaCredential -Phase MT-02 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'CASE_SCOPE'
    Assert-Blocked { Get-ManualQaCredential -Phase MT-23 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'CASE_SCOPE'
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -Origin 'https://example.com' -AuthorizationReference 'test-only' -PreservationVerified } 'ORIGIN_SCOPE'
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -Origin 'http://127.0.0.1:5173@evil.test' -AuthorizationReference 'test-only' -PreservationVerified } 'ORIGIN_SCOPE'
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-MISSING -AuthorizationReference 'test-only' -PreservationVerified } 'IDENTITY_MISSING'
    $credential = Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified
    Assert-True ($credential -is [System.Management.Automation.PSCredential]) 'credential type'
    $plain = $credential.GetNetworkCredential().Password
    Assert-True ($plain.Length -ge 12 -and $plain.Length -le 128 -and $plain -cmatch '[A-Z]' -and $plain -cmatch '[a-z]' -and $plain -match '\d' -and $plain -match '[^a-zA-Z0-9]') 'generated password policy'
    $file = Join-Path $qaTestDirectory 'operator.dpapi'
    $sealed = [IO.File]::ReadAllText($file)
    Assert-True (-not $sealed.Contains($plain) -and -not $sealed.Contains($credential.UserName)) 'no plaintext at rest'
    $second = Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified
    Assert-True ($second.GetNetworkCredential().Password -ceq $plain) 'predetermined credential reuse'
    $credential.Password.Dispose(); $second.Password.Dispose()
    $plain = $null; $credential = $null; $second = $null
    $receipt = Test-ManualQaContext -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified | ConvertTo-Json -Compress
    Assert-True (-not $receipt.Contains('mtqa-new') -and $receipt.Contains('READY')) 'safe receipt'
    $lockPath = Join-Path $qaTestDirectory 'registration.lock'
    [IO.File]::WriteAllText($lockPath, '')
    Assert-Blocked { New-ManualQaIdentity -Alias AUTO-BUSY -Email 'mtqa-busy@example.test' -DesignationReference 'test-only' -SyntheticDisposable } 'STORE_BUSY'
    Remove-Item -LiteralPath $lockPath
    Assert-True (-not (Get-ChildItem -LiteralPath $qaTestDirectory -Filter 'write-*')) 'atomic-write cleanup'
    $savedAcl = Get-Acl -LiteralPath $file
    $unsafeAcl = Get-Acl -LiteralPath $file
    $everyone = [Security.Principal.SecurityIdentifier]::new('S-1-1-0')
    $unsafeAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, 'Read', 'Allow'))
    Set-Acl -LiteralPath $file -AclObject $unsafeAcl
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'STORE_ACL'
    Set-Acl -LiteralPath $file -AclObject $savedAcl
    & $module { param($path) $script:StoreDirectory = $path } (Split-Path $qaTestRoot)
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'STORE_PATH'
    & $module { param($path) $script:StoreDirectory = $path } $qaTestDirectory
    $linkPath = Join-Path $qaTestDirectory 'redirect'
    $linkTarget = Join-Path $qaTestDirectory 'target'
    $null = New-Item -ItemType Directory -Path $linkTarget
    $null = New-Item -ItemType Junction -Path $linkPath -Target $linkTarget
    & $module { param($path) $script:StoreDirectory = $path } $linkPath
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'STORE_PATH'
    & $module { param($path) $script:StoreDirectory = $path } $qaTestDirectory
    # Remove only the run-created link, without traversing its target.
    (Get-Item -LiteralPath $linkPath).Delete()
    [IO.File]::WriteAllText($file, 'malformed')
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'CONFIG_UNREADABLE'
    [IO.File]::WriteAllText($file, $sealed)
    & $module { $store = Read-QaStore; $store.identities[0].classification = 'human'; Write-QaStore $store -Replace }
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'CONFIG_SCOPE'
    [IO.File]::WriteAllText($file, $sealed)
    & $module { $store = Read-QaStore; $store.environment = 'production'; Write-QaStore $store -Replace }
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'CONFIG_SCOPE'
    [IO.File]::WriteAllText($file, $sealed)
    & $module {
        $store = Read-QaStore
        $store.repository = 'different-root'
        Write-QaStore $store -Replace
    }
    Assert-Blocked { Get-ManualQaCredential -Phase MT-01 -CaseId MT-AUTH-001 -Alias AUTO-QA -AuthorizationReference 'test-only' -PreservationVerified } 'CONFIG_SCOPE'
    Write-Output "PASS: $passed assertions; synthetic self-test only; no live account or phase executed."
} finally {
    if ($null -ne $credential) { $credential.Password.Dispose() }
    if ($null -ne $second) { $second.Password.Dispose() }
    $plain = $null; $sealed = $null; $credential = $null; $second = $null
    # Delete only this run-owned test directory after checking its resolved containment.
    $resolved = [IO.Path]::GetFullPath($qaTestDirectory)
    $expectedParent = [IO.Path]::GetFullPath($qaTestRoot) + [IO.Path]::DirectorySeparatorChar
    if ($resolved.StartsWith($expectedParent, [StringComparison]::OrdinalIgnoreCase) -and
        (Split-Path $resolved -Leaf) -match '^selftest-[a-f0-9]{32}$' -and (Test-Path -LiteralPath $resolved)) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
    if (-not $parentExisted -and (Test-Path -LiteralPath $qaTestRoot) -and -not (Get-ChildItem -LiteralPath $qaTestRoot -Force)) {
        Remove-Item -LiteralPath $qaTestRoot -Force
    }
    Remove-Module Operator
}
