# Script para adicionar Git ao PATH automaticamente
# Execute este comando sempre que abrir um novo terminal:
# . .\setup-git.ps1

$env:Path += ";C:\Program Files\Git\cmd"
Write-Host "✅ Git adicionado ao PATH com sucesso!" -ForegroundColor Green
Write-Host "Você pode usar comandos Git agora." -ForegroundColor Cyan
