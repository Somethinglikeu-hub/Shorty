param(
  [int]$Port = 3000
)

Write-Host "Starting Tailscale Serve for Shorty on port $Port..."
tailscale serve --bg $Port
Write-Host "If serve succeeded, open the printed ts.net URL from your phone."

