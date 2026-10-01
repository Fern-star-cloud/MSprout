# Windows-only local QA support. No HTTP, database, browser or phase execution.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:Repository = [IO.Path]::GetFullPath((Split-Path (Split-Path $PSScriptRoot)))
$script:StoreDirectory = Join-Path $script:Repository '.manual-qa'

function Stop-Qa([string] $code) { throw "YELLOW/BLOCKED: $code" }

function Assert-QaPath {
    if ($env:OS -ne 'Windows_NT') { Stop-Qa 'WINDOWS_REQUIRED' }
    $privateRoot = Join-Path $script:Repository '.manual-qa'
    $path = [IO.Path]::GetFullPath($script:StoreDirectory)
    if ($path -ne $privateRoot -and -not $path.StartsWith($privateRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Qa 'STORE_PATH'
    }
    # Refuse redirected paths inside the repository. OneDrive cloud attributes on
    # its parent directories are not junctions and do not authorize arbitrary targets.
    $cursor = $path
    while ($cursor) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            Stop-Qa 'STORE_PATH'
        }
        if ($cursor -eq $script:Repository) { break }
        $cursor = Split-Path $cursor -Parent
    }
    $relative = $path.Substring($script:Repository.Length + 1).Replace('\', '/') + '/operator.dpapi'
    & git -C $script:Repository check-ignore -q -- $relative 2>$null
    if ($LASTEXITCODE -ne 0) { Stop-Qa 'IGNORE_REQUIRED' }
    $tracked = @(& git -C $script:Repository ls-files -- '.manual-qa/' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $tracked.Count -ne 0) { Stop-Qa 'UNTRACKED_REQUIRED' }
}

function Assert-QaAcl([string] $path) {
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $acl = Get-Acl -LiteralPath $path
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid) { Stop-Qa 'STORE_ACL' }
    $allowsOwner = $false
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq 'Allow') {
            if ($rule.IdentityReference.Value -notin @($sid, 'S-1-5-18')) { Stop-Qa 'STORE_ACL' }
            if ($rule.IdentityReference.Value -eq $sid -and ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl) { $allowsOwner = $true }
        }
    }
    if (-not $allowsOwner) { Stop-Qa 'STORE_ACL' }
}

function Read-QaStore {
    Assert-QaPath
    $file = Join-Path $script:StoreDirectory 'operator.dpapi'
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { Stop-Qa 'CONFIG_MISSING' }
    if ((Get-Item -LiteralPath $file -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { Stop-Qa 'STORE_PATH' }
    Assert-QaAcl $script:StoreDirectory
    Assert-QaAcl $file
    $bstr = [IntPtr]::Zero; $secure = $null
    try {
        $secure = ConvertTo-SecureString ([IO.File]::ReadAllText($file)) -ErrorAction Stop
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        $store = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) | ConvertFrom-Json -ErrorAction Stop
    } catch { Stop-Qa 'CONFIG_UNREADABLE' }
    finally {
        if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        if ($null -ne $secure) { $secure.Dispose() }
    }
    try {
        if ($store.schema -ne 1 -or $store.environment -ne 'local-development' -or $store.repository -ne $script:Repository -or
            $store.ownerSid -ne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) { Stop-Qa 'CONFIG_SCOPE' }
        $aliases = @(); $emails = @()
        foreach ($identity in $store.identities) {
            if ($identity.classification -ne 'synthetic-disposable' -or $identity.alias -cnotmatch '^AUTO-[A-Z0-9-]{1,32}$' -or
                $identity.email -cnotmatch '^mtqa-[a-z0-9-]+@example\.test$' -or
                [string]::IsNullOrWhiteSpace($identity.designationReference) -or $identity.password.Length -lt 12 -or $identity.password.Length -gt 128 -or
                $identity.alias -in $aliases -or $identity.email -in $emails) { Stop-Qa 'CONFIG_SCOPE' }
            $aliases += $identity.alias; $emails += $identity.email
        }
    } catch { Stop-Qa 'CONFIG_SCOPE' }
    return $store
}

function Write-QaStore($store, [switch] $Replace) {
    Assert-QaPath
    Assert-QaAcl $script:StoreDirectory
    $file = Join-Path $script:StoreDirectory 'operator.dpapi'
    $temporary = Join-Path $script:StoreDirectory ('write-' + [guid]::NewGuid().ToString('N') + '.dpapi')
    $secure = $null; $stream = $null
    try {
        $secure = ConvertTo-SecureString ($store | ConvertTo-Json -Depth 8 -Compress) -AsPlainText -Force
        $ciphertext = ConvertFrom-SecureString $secure
        $target = if ($Replace) { $temporary } else { $file }
        $stream = [IO.File]::Open($target, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $bytes = [Text.Encoding]::UTF8.GetBytes($ciphertext)
        $stream.Write($bytes, 0, $bytes.Length); $stream.Dispose(); $stream = $null
        if ($Replace) {
            Assert-QaAcl $file
            if ((Get-Item -LiteralPath $file -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { Stop-Qa 'STORE_PATH' }
            [IO.File]::Replace($temporary, $file, [System.Management.Automation.Language.NullString]::Value)
        }
    } catch { Stop-Qa 'STORE_WRITE' }
    finally {
        if ($null -ne $stream) { $stream.Dispose() }
        if ($null -ne $secure) { $secure.Dispose() }
        # Only the exact temporary file created by this write; never recurse or purge.
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

function Initialize-ManualQaStore {
    Assert-QaPath
    if (Test-Path -LiteralPath (Join-Path $script:StoreDirectory 'operator.dpapi')) { Stop-Qa 'STORE_EXISTS' }
    if (-not (Test-Path -LiteralPath $script:StoreDirectory)) {
        $null = New-Item -ItemType Directory -Path $script:StoreDirectory
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $acl.SetOwner($sid)
        $acl.SetAccessRuleProtection($true, $false)
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
        Set-Acl -LiteralPath $script:StoreDirectory -AclObject $acl
    }
    Write-QaStore ([ordered]@{ schema = 1; environment = 'local-development'; repository = $script:Repository;
        ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value; identities = @() })
    [pscustomobject]@{ status = 'INITIALIZED'; identities = 0; phaseExecuted = $false }
}

function New-ManualQaIdentity {
    param([string] $Alias, [string] $Email, [string] $DesignationReference, [switch] $SyntheticDisposable)
    if (-not $SyntheticDisposable -or [string]::IsNullOrWhiteSpace($DesignationReference)) { Stop-Qa 'DESIGNATION_REQUIRED' }
    if ($Alias -cnotmatch '^AUTO-[A-Z0-9-]{1,32}$' -or $Email -cnotmatch '^mtqa-[a-z0-9-]+@example\.test$') { Stop-Qa 'IDENTITY_CLASSIFICATION' }
    Assert-QaPath
    if (-not (Test-Path -LiteralPath (Join-Path $script:StoreDirectory 'operator.dpapi'))) { Stop-Qa 'CONFIG_MISSING' }
    Assert-QaAcl $script:StoreDirectory
    $lockPath = Join-Path $script:StoreDirectory 'registration.lock'
    $lock = $null
    try { $lock = [IO.File]::Open($lockPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None) }
    catch { Stop-Qa 'STORE_BUSY' }
    try {
        $store = Read-QaStore
        if (@($store.identities | Where-Object { $_.alias -eq $Alias -or $_.email -eq $Email }).Count) { Stop-Qa 'IDENTITY_EXISTS' }
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        $bytes = New-Object byte[] 32
        try {
            $random.GetBytes($bytes)
            $store.identities = @($store.identities) + [pscustomobject]@{ alias = $Alias; email = $Email;
                classification = 'synthetic-disposable'; designationReference = $DesignationReference;
                password = 'Aa1!' + [Convert]::ToBase64String($bytes) }
            Write-QaStore $store -Replace
        } finally { $random.Dispose(); [Array]::Clear($bytes, 0, $bytes.Length); $store = $null }
    } finally { $lock.Dispose(); Remove-Item -LiteralPath $lockPath -Force }
    [pscustomobject]@{ status = 'CREDENTIAL_REGISTERED'; accountCreated = $false; phaseExecuted = $false }
}

function Get-ManualQaCredential {
    param([string] $Phase, [string] $CaseId, [string] $Alias, [string] $AuthorizationReference,
        [switch] $PreservationVerified, [string] $Origin = 'http://127.0.0.1:5173')
    # References/attestations are checks, never a grant of authority. Verify the human prompt separately.
    if ([string]::IsNullOrWhiteSpace($AuthorizationReference)) { Stop-Qa 'AUTHORIZATION_REQUIRED' }
    if (-not $PreservationVerified) { Stop-Qa 'PRESERVATION_REQUIRED' }
    if ($Origin -cne 'http://127.0.0.1:5173') { Stop-Qa 'ORIGIN_SCOPE' }
    if ($Phase -cnotmatch '^MT-(0[0-9]|1[0-9]|2[0-2])$' -or $CaseId -cnotmatch '^MT-[A-Z]+-[0-9]{3}$') { Stop-Qa 'CASE_SCOPE' }
    $roadmap = [IO.File]::ReadAllText((Join-Path $script:Repository 'docs/qa/MANUAL_TESTING_ROADMAP.md'))
    $section = [regex]::Match($roadmap, '(?ms)^### PHASE ' + [regex]::Escape($Phase) + ' .*?(?=^### PHASE |\z)').Value
    if ($section -notmatch ('(?m)^\| ' + [regex]::Escape($CaseId) + ' \|')) { Stop-Qa 'CASE_SCOPE' }
    $store = Read-QaStore
    $identity = @($store.identities | Where-Object { $_.alias -ceq $Alias })
    if ($identity.Count -ne 1) { Stop-Qa 'IDENTITY_MISSING' }
    try {
        $secure = ConvertTo-SecureString $identity[0].password -AsPlainText -Force
        return [System.Management.Automation.PSCredential]::new($identity[0].email, $secure)
    } finally { $store = $null; $identity = $null }
}

function Test-ManualQaContext {
    param([string] $Phase, [string] $CaseId, [string] $Alias, [string] $AuthorizationReference,
        [switch] $PreservationVerified, [string] $Origin = 'http://127.0.0.1:5173')
    $credential = Get-ManualQaCredential @PSBoundParameters
    $credential.Password.Dispose(); $credential = $null
    [pscustomobject]@{ status = 'READY'; phase = $Phase; caseId = $CaseId; phaseExecuted = $false }
}

Export-ModuleMember -Function Initialize-ManualQaStore, New-ManualQaIdentity, Get-ManualQaCredential, Test-ManualQaContext
