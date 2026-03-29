$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"
$androidRoot = Join-Path $projectRoot "android-app"
$localPropertiesPath = Join-Path $androidRoot "local.properties"

if (-not (Test-Path $envPath)) {
    throw ".env dosyasi bulunamadi: $envPath"
}

$envMap = @{}
Get-Content $envPath | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
        return
    }
    $parts = $line.Split("=", 2)
    $envMap[$parts[0]] = $parts[1]
}

$properties = [ordered]@{}
if (Test-Path $localPropertiesPath) {
    Get-Content $localPropertiesPath | ForEach-Object {
        $line = $_
        if (-not $line.Contains("=")) {
            return
        }
        $parts = $line.Split("=", 2)
        $properties[$parts[0]] = $parts[1]
    }
}

$mappings = [ordered]@{
    "shorty.youtubeClientId" = "YOUTUBE_CLIENT_ID"
    "shorty.youtubeClientSecret" = "YOUTUBE_CLIENT_SECRET"
    "shorty.geminiApiKey" = "GEMINI_API_KEY"
    "shorty.pexelsApiKey" = "PEXELS_API_KEY"
    "shorty.adminToken" = "SHORTY_ADMIN_TOKEN"
}

foreach ($targetKey in $mappings.Keys) {
    $sourceKey = $mappings[$targetKey]
    if ($envMap.ContainsKey($sourceKey)) {
        $properties[$targetKey] = $envMap[$sourceKey]
    }
}

if (-not $properties.Contains("shorty.youtubeTokenRedirectUri")) {
    $properties["shorty.youtubeTokenRedirectUri"] = ""
}

$lines = foreach ($entry in $properties.GetEnumerator()) {
    "$($entry.Key)=$($entry.Value)"
}
Set-Content -Path $localPropertiesPath -Value $lines -Encoding ASCII

Write-Host "Android local config synced to $localPropertiesPath"
