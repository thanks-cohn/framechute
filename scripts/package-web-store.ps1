$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Dist = Join-Path $Root "dist"
$Stage = Join-Path $Dist "flashframe-store-stage"
$ManifestPath = Join-Path $Root "manifest.json"

if (-not (Test-Path $ManifestPath)) {
    throw "manifest.json is missing"
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
if ($Manifest.manifest_version -ne 3) {
    throw "Chrome Web Store package must use Manifest V3"
}
if ([string]$Manifest.name -ne "FrameChute") {
    throw "Manifest name must be FrameChute"
}

$Version = [string]$Manifest.version
if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Manifest version is missing"
}

$Description = [string]$Manifest.description
if ([string]::IsNullOrWhiteSpace($Description) -or $Description.Length -gt 132) {
    throw "Manifest description must contain 1-132 characters"
}

$AllowedPermissions = @()
$ActualPermissions = @()
if ($null -ne $Manifest.PSObject.Properties["permissions"]) {
    $ActualPermissions = @(
        $Manifest.permissions |
        ForEach-Object { [string]$_ } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
}
$UnexpectedPermissions = @($ActualPermissions | Where-Object { $_ -notin $AllowedPermissions })
$MissingPermissions = @($AllowedPermissions | Where-Object { $_ -notin $ActualPermissions })
if ($UnexpectedPermissions.Count -or $MissingPermissions.Count) {
    throw "Permission gate failed. Expected no extension API permissions. Actual: $($ActualPermissions -join ', ')"
}

$AllowedHosts = @()
$ActualHosts = @()
if ($null -ne $Manifest.PSObject.Properties["host_permissions"]) {
    $ActualHosts = @(
        $Manifest.host_permissions |
        ForEach-Object { [string]$_ } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
}
$UnexpectedHosts = @($ActualHosts | Where-Object { $_ -notin $AllowedHosts })
$MissingHosts = @($AllowedHosts | Where-Object { $_ -notin $ActualHosts })
if ($UnexpectedHosts.Count -or $MissingHosts.Count) {
    throw "Host-permission gate failed. Expected no host permissions. Actual: $($ActualHosts -join ', ')"
}
if ($ActualHosts -contains "http://*/*" -or $ActualHosts -contains "https://*/*" -or $ActualHosts -contains "<all_urls>") {
    throw "Broad host access is forbidden in the Chrome Web Store candidate"
}

if ([string]$Manifest.action.default_popup -ne "src/launcher.html") {
    throw "Manifest action must use src/launcher.html for reliable clean-install launch"
}
if ($null -ne $Manifest.PSObject.Properties["background"]) {
    throw "Clean-install launcher must not depend on a background service worker"
}

$RequiredIcons = @{
    "16" = "icons/icon16.png"
    "32" = "icons/icon32.png"
    "48" = "icons/icon48.png"
    "128" = "icons/icon128.png"
}
foreach ($Size in $RequiredIcons.Keys) {
    $Expected = $RequiredIcons[$Size]
    $Actual = [string]$Manifest.icons.$Size
    if ($Actual -ne $Expected) {
        throw "Manifest icon $Size must be $Expected; got $Actual"
    }
    if (-not (Test-Path (Join-Path $Root $Expected))) {
        throw "Missing required icon: $Expected"
    }
}

$ShipRoots = @("manifest.json", "LICENSE", "src", "icons", "assets")
$TextExtensions = @(".js", ".mjs", ".html", ".css", ".json")
$ForbiddenBinaryExtensions = @(".exe", ".dll", ".msi", ".bat", ".cmd", ".ps1", ".py", ".pyc")
$ForbiddenText = @(
    @{ Name = "localhost dependency"; Pattern = '(?i)localhost' },
    @{ Name = "loopback dependency"; Pattern = '127\.0\.0\.1' },
    @{ Name = "native messaging"; Pattern = '(?i)nativeMessaging|connectNative|sendNativeMessage' },
    @{ Name = "desktop companion"; Pattern = '(?i)\bcompanion\b' },
    @{ Name = "Windows executable dependency"; Pattern = '(?i)\.exe\b' },
    @{ Name = "eval"; Pattern = '(?i)\beval\s*\(' },
    @{ Name = "Function constructor"; Pattern = '(?i)new\s+Function\s*\(' },
    @{ Name = "remote script tag"; Pattern = '(?i)<script[^>]+src\s*=\s*[''\"]https?://' },
    @{ Name = "remote JavaScript import"; Pattern = '(?i)(?:import\s*\(|from\s*)\s*[''\"]https?://' },
    @{ Name = "remote importScripts"; Pattern = '(?i)importScripts\s*\(\s*[''\"]https?://' }
)

$FilesToShip = New-Object System.Collections.Generic.List[string]
foreach ($Relative in $ShipRoots) {
    $Path = Join-Path $Root $Relative
    if (-not (Test-Path $Path)) {
        throw "Required package path is missing: $Relative"
    }
    if ((Get-Item $Path).PSIsContainer) {
        Get-ChildItem $Path -Recurse -File | ForEach-Object { $FilesToShip.Add($_.FullName) }
    } else {
        $FilesToShip.Add((Get-Item $Path).FullName)
    }
}

foreach ($File in $FilesToShip) {
    $Extension = [IO.Path]::GetExtension($File).ToLowerInvariant()
    if ($Extension -in $ForbiddenBinaryExtensions) {
        throw "Forbidden desktop/runtime file in Store package: $File"
    }
    if ($Extension -notin $TextExtensions) { continue }
    $Text = Get-Content $File -Raw
    foreach ($Rule in $ForbiddenText) {
        if ($Text -match $Rule.Pattern) {
            $TrimChars = [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
            $Prefix = $Root.TrimEnd($TrimChars) + [IO.Path]::DirectorySeparatorChar
            $Relative = if ($File.StartsWith($Prefix, [StringComparison]::OrdinalIgnoreCase)) {
                $File.Substring($Prefix.Length)
            } else {
                $File
            }
            throw "Release gate failed: $($Rule.Name) found in $Relative"
        }
    }
}

$DocxModulePath = Join-Path $Root "src/documents/docx-document.js"
$DocxModuleText = Get-Content $DocxModulePath -Raw
if ($DocxModuleText.Contains('\`') -or $DocxModuleText.Contains('\${')) {
    throw "Release gate failed: malformed escaped JavaScript template syntax found in src/documents/docx-document.js"
}

if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
New-Item -ItemType Directory -Path $Stage -Force | Out-Null

foreach ($Relative in $ShipRoots) {
    $Source = Join-Path $Root $Relative
    $Target = Join-Path $Stage $Relative
    if ((Get-Item $Source).PSIsContainer) {
        Copy-Item $Source $Target -Recurse -Force
    } else {
        $Parent = Split-Path $Target -Parent
        New-Item -ItemType Directory -Path $Parent -Force | Out-Null
        Copy-Item $Source $Target -Force
    }
}

New-Item -ItemType Directory -Path $Dist -Force | Out-Null
$Output = Join-Path $Dist "flashframe-chrome-web-store-v$Version.zip"
if (Test-Path $Output) { Remove-Item $Output -Force }
Compress-Archive -Path (Join-Path $Stage "*") -DestinationPath $Output -CompressionLevel Optimal

$TestUnpacked = Join-Path $Dist "test-unpacked"
if (Test-Path $TestUnpacked) { Remove-Item $TestUnpacked -Recurse -Force }
Expand-Archive -Path $Output -DestinationPath $TestUnpacked -Force

$RequiredPackageFiles = @(
    "manifest.json",
    "LICENSE",
    "src/launcher.html",
    "src/launcher.js",
    "src/workspace.html",
    "src/workspace-extras.js",
    "src/picker-guard.js",
    "src/media-dock-grab-pin.js",
    "src/grab-art-runtime.js",
    "assets/grab/default.png",
    "assets/grab/hover.png",
    "assets/grab/faded.png",
    "assets/grab/expanded.png",
    "assets/images/default.png",
    "assets/images/hover.png",
    "icons/icon16.png",
    "icons/icon32.png",
    "icons/icon48.png",
    "icons/icon128.png"
)

foreach ($Relative in $RequiredPackageFiles) {
    $Candidate = Join-Path $TestUnpacked ($Relative -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path $Candidate)) {
        throw "Packaging error: required file missing from ZIP: $Relative"
    }
}

$PackagedManifestPath = Join-Path $TestUnpacked "manifest.json"
$SourceManifestJson = (Get-Content $ManifestPath -Raw | ConvertFrom-Json) | ConvertTo-Json -Depth 20 -Compress
$PackagedManifestJson = (Get-Content $PackagedManifestPath -Raw | ConvertFrom-Json) | ConvertTo-Json -Depth 20 -Compress
if ($SourceManifestJson -ne $PackagedManifestJson) {
    throw "Packaging error: manifest inside ZIP differs from source manifest"
}

Write-Host ""
Write-Host "FRAMECHUTE CHROME WEB STORE RELEASE GATE: PASS"
Write-Host "Version:       $Version"
Write-Host "Store ZIP:     $Output"
Write-Host "Test unpacked: $TestUnpacked"
Write-Host "Permissions:   NONE"
Write-Host "Host access:   NONE"
Write-Host "Remote code:   NONE"
Write-Host "Companion:     NONE"
Write-Host "Python/EXE:    NOT REQUIRED"
