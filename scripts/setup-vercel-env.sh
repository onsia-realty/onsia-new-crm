#!/bin/bash

# Vercel 환경 변수 설정 스크립트
# 사용법: ./scripts/setup-vercel-env.sh

echo "🚀 Vercel 환경 변수 설정 시작..."

# Vercel CLI 설치 확인
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI가 설치되어 있지 않습니다."
    echo "npm i -g vercel 명령으로 설치해주세요."
    exit 1
fi

# 프로젝트 연결 확인
if [ ! -f ".vercel/project.json" ]; then
    echo "📎 Vercel 프로젝트 연결 중..."
    vercel link
fi

# AUTH_SECRET 생성
AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "your-secret-key-here-min-32-characters-1234567890")
echo "🔑 AUTH_SECRET 생성 완료"

# 환경 변수 설정
echo "📝 환경 변수 설정 중..."

# DATABASE_URL 설정
echo "📌 DATABASE_URL 설정 (Vercel Postgres 사용 시 자동 설정됨)"
vercel env add DATABASE_URL production --force 2>/dev/null || true

# AUTH_SECRET 설정
echo "$AUTH_SECRET" | vercel env add AUTH_SECRET production --force
echo "$AUTH_SECRET" | vercel env add NEXTAUTH_SECRET production --force

# AUTH_URL 설정
VERCEL_URL="https://onsia-crm.vercel.app"
echo "$VERCEL_URL" | vercel env add AUTH_URL production --force
echo "$VERCEL_URL" | vercel env add NEXTAUTH_URL production --force

echo "✅ 환경 변수 설정 완료!"
echo ""
echo "📋 설정된 환경 변수:"
echo "- AUTH_SECRET (자동 생성됨)"
echo "- NEXTAUTH_SECRET (AUTH_SECRET과 동일)"
echo "- AUTH_URL: $VERCEL_URL"
echo "- NEXTAUTH_URL: $VERCEL_URL"
echo ""
echo "⚠️  DATABASE_URL은 수동으로 설정해야 합니다:"
echo "1. Vercel 대시보드 → Storage → Create Database → Postgres"
echo "2. 또는 Supabase 등 외부 PostgreSQL 사용 시 직접 입력"
echo ""
echo "🔄 재배포하려면: vercel --prod"