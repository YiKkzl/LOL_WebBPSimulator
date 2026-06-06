param(
    [int]$Port = 3000,
    [string]$DatabaseUrl = "mysql://lolbp:lolbp_dev_password@127.0.0.1:3307/lolbp_test"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

Write-Host "[1/3] Starting local MySQL"
docker compose up -d --wait lolbp-mysql

Write-Host "[2/3] Applying Prisma schema"
$env:DATABASE_URL = $DatabaseUrl
npx prisma generate
npx prisma db push

Write-Host "[3/3] Starting local review server"
$env:NEXT_TELEMETRY_DISABLED = "1"
npm run dev -- -p $Port
