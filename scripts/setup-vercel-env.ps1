# Vercel 환경 변수 설정 PowerShell 스크립트
# 사용법: .\scripts\setup-vercel-env.ps1

Write-Host "🚀 Vercel 환경 변수 설정 시작..." -ForegroundColor Green

# Vercel CLI 설치 확인
try {
    $null = Get-Command vercel -ErrorAction Stop
} catch {
    Write-Host "❌ Vercel CLI가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "npm i -g vercel 명령으로 설치해주세요." -ForegroundColor Yellow
    exit 1
}

# 프로젝트 연결 확인
if (-not (Test-Path ".vercel\project.json")) {
    Write-Host "📎 Vercel 프로젝트 연결 중..." -ForegroundColor Yellow
    vercel link
}

# AUTH_SECRET 생성 (32자 이상 랜덤 문자열)
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
$AUTH_SECRET = [System.Convert]::ToBase64String($bytes)
Write-Host "🔑 AUTH_SECRET 생성 완료" -ForegroundColor Green

# 환경 변수 설정
Write-Host "📝 환경 변수 설정 중..." -ForegroundColor Yellow

# DATABASE_URL 설정 안내
Write-Host "📌 DATABASE_URL 설정 안내" -ForegroundColor Cyan
Write-Host "Vercel Postgres 사용 시:" -ForegroundColor White
Write-Host "  1. Vercel 대시보드 → Storage → Create Database → Postgres" -ForegroundColor Gray
Write-Host "  2. DATABASE_URL이 자동으로 설정됩니다" -ForegroundColor Gray
Write-Host ""
Write-Host "외부 PostgreSQL 사용 시:" -ForegroundColor White
Write-Host "  postgresql://user:password@host:port/database?sslmode=require" -ForegroundColor Gray
Write-Host ""

# AUTH_SECRET 설정
Write-Host "AUTH_SECRET 설정 중..." -ForegroundColor Yellow
$AUTH_SECRET | vercel env add AUTH_SECRET production --force 2>$null
$AUTH_SECRET | vercel env add NEXTAUTH_SECRET production --force 2>$null

# AUTH_URL 설정
$VERCEL_URL = "https://onsia-crm.vercel.app"
Write-Host "AUTH_URL 설정 중..." -ForegroundColor Yellow
$VERCEL_URL | vercel env add AUTH_URL production --force 2>$null
$VERCEL_URL | vercel env add NEXTAUTH_URL production --force 2>$null

Write-Host ""
Write-Host "✅ 환경 변수 설정 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 설정된 환경 변수:" -ForegroundColor Cyan
Write-Host "  - AUTH_SECRET (자동 생성됨)" -ForegroundColor White
Write-Host "  - NEXTAUTH_SECRET (AUTH_SECRET과 동일)" -ForegroundColor White
Write-Host "  - AUTH_URL: $VERCEL_URL" -ForegroundColor White
Write-Host "  - NEXTAUTH_URL: $VERCEL_URL" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  DATABASE_URL은 Vercel 대시보드에서 설정하세요:" -ForegroundColor Yellow
Write-Host "  https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔄 재배포하려면: vercel --prod" -ForegroundColor Green