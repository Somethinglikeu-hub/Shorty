param(
  [string]$LegacyProjectRoot = "C:\Users\User\Desktop\AI Coding Projects\Useless Projects\Youtube Project",
  [string]$TargetEnvPath = "C:\Users\User\Desktop\AI Coding Projects\Youtube Shorty App\.env"
)

$legacyEnvPath = Join-Path $LegacyProjectRoot "youtube_bot\.env"
$legacyClientSecretPath = Join-Path $LegacyProjectRoot "client_secret_442945857832-usr7mafj8artpji77iv4aoer0se85fav.apps.googleusercontent.com.json"
$legacyTokenPath = Join-Path $LegacyProjectRoot "youtube_bot\youtube_token.json"

if (-not (Test-Path $legacyEnvPath)) {
  throw "Legacy .env not found: $legacyEnvPath"
}

if (-not (Test-Path $legacyClientSecretPath)) {
  throw "Legacy client secret JSON not found: $legacyClientSecretPath"
}

if (-not (Test-Path $legacyTokenPath)) {
  throw "Legacy token JSON not found: $legacyTokenPath"
}

$targetMap = @{}
if (Test-Path $TargetEnvPath) {
  foreach ($line in Get-Content $TargetEnvPath) {
    if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
    $parts = $line -split '=', 2
    if ($parts.Count -eq 2) {
      $targetMap[$parts[0]] = $parts[1]
    }
  }
}

$legacyMap = @{}
foreach ($line in Get-Content $legacyEnvPath) {
  if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }
  $parts = $line -split '=', 2
  if ($parts.Count -eq 2) {
    $legacyMap[$parts[0]] = $parts[1]
  }
}

$clientSecrets = Get-Content $legacyClientSecretPath -Raw | ConvertFrom-Json
$installed = $clientSecrets.installed
$tokenJson = Get-Content $legacyTokenPath -Raw | ConvertFrom-Json

if ($legacyMap.ContainsKey("GEMINI_API_KEY")) {
  $targetMap["GEMINI_API_KEY"] = $legacyMap["GEMINI_API_KEY"]
}

if ($legacyMap.ContainsKey("PEXELS_API_KEY")) {
  $targetMap["PEXELS_API_KEY"] = $legacyMap["PEXELS_API_KEY"]
}

$targetMap["YOUTUBE_CLIENT_ID"] = $installed.client_id
$targetMap["YOUTUBE_CLIENT_SECRET"] = $installed.client_secret
$targetMap["YOUTUBE_REFRESH_TOKEN"] = $tokenJson.refresh_token

$orderedKeys = @(
  "PORT",
  "PUBLIC_BASE_URL",
  "DATA_DIR",
  "SHORTY_ADMIN_TOKEN",
  "SHORTY_ADMIN_USERNAME",
  "JOB_CONCURRENCY",
  "FFMPEG_FONT_FILE",
  "GEMINI_API_KEY",
  "GEMINI_TEXT_MODEL",
  "GEMINI_TTS_MODEL",
  "SHORTY_VOICE_NAME",
  "PEXELS_API_KEY",
  "YOUTUBE_CLIENT_ID",
  "YOUTUBE_CLIENT_SECRET",
  "YOUTUBE_REDIRECT_URI",
  "YOUTUBE_REFRESH_TOKEN",
  "YOUTUBE_DEFAULT_CATEGORY_ID",
  "YOUTUBE_DEFAULT_LANGUAGE"
)

$lines = foreach ($key in $orderedKeys) {
  if ($targetMap.ContainsKey($key)) {
    "$key=$($targetMap[$key])"
  }
}

Set-Content -Path $TargetEnvPath -Value $lines
Write-Host "Imported legacy Gemini, Pexels and YouTube credentials into $TargetEnvPath"
