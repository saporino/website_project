param([string]$sql = "")
if (-not $sql) { Write-Host "Uso: .\migrate.ps1 -sql 'ALTER TABLE ...'"; exit 1 }
$key = (Get-Content .env | Where-Object {$_ -match "SUPABASE_SERVICE_ROLE_KEY"}) -replace "SUPABASE_SERVICE_ROLE_KEY=",""
$key = $key.Trim()
if (-not $key) { Write-Host "ERRO: SUPABASE_SERVICE_ROLE_KEY nao encontrado no .env"; exit 1 }
$url = "https://rsvoazrkxtdrcjnatzcm.supabase.co/rest/v1/rpc/exec_migration"
$headers = @{
  "apikey"        = $key
  "Authorization" = "Bearer $key"
  "Content-Type"  = "application/json"
}
$body = (@{ q = $sql } | ConvertTo-Json)
try {
  $r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -ErrorAction Stop
  Write-Host "Migration OK"
} catch {
  $msg = $_.ErrorDetails.Message
  if (-not $msg) { $msg = $_.Exception.Message }
  Write-Host "Erro migration: $msg"
}