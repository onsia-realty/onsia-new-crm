# Vercel 배포 가이드

## 📦 프로젝트 정보

- **프로젝트명**: onsia-crm
- **Project ID**: prj_BuEXNgD0A3vPoS8d594zm69neDtS
- **예상 URL**: https://onsia-crm.vercel.app

## 🔐 환경 변수 설정 (필수)

Vercel 대시보드에서 다음 환경 변수를 설정해야 합니다:

### 1. Vercel 대시보드 접속
https://vercel.com/realtors77-7871s-projects/onsia-crm/settings/environment-variables

### 2. 필수 환경 변수

**Database**:
```
DATABASE_URL=postgresql://postgres.uwddeseqwdsryvuoulsm:duseorua12d@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
```

**NextAuth - Production**:
```
NEXTAUTH_URL=https://onsia-crm.vercel.app
AUTH_URL=https://onsia-crm.vercel.app
```

**NextAuth - Secrets** (프로덕션용으로 새로 생성 권장):
```bash
# 다음 명령으로 안전한 시크릿 생성
openssl rand -base64 32
```

생성된 값을 다음 변수에 설정:
```
NEXTAUTH_SECRET=<생성된-시크릿>
AUTH_SECRET=<생성된-시크릿>
```

### 3. CLI로 환경 변수 설정하기

```bash
# DATABASE_URL 설정
echo "postgresql://postgres.uwddeseqwdsryvuoulsm:duseorua12d@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres" | vercel env add DATABASE_URL production

# AUTH URLs 설정
echo "https://onsia-crm.vercel.app" | vercel env add NEXTAUTH_URL production
echo "https://onsia-crm.vercel.app" | vercel env add AUTH_URL production

# Secrets 설정 (시크릿 값 입력)
vercel env add NEXTAUTH_SECRET production
vercel env add AUTH_SECRET production
```

## 🚀 배포하기

### 방법 1: CLI로 배포
```bash
# 프로덕션 배포
vercel --prod

# 또는 프리뷰 배포 (테스트용)
vercel
```

### 방법 2: GitHub 연동 (권장)
1. Vercel 대시보드 → Settings → Git
2. GitHub 저장소 연동: `onsia-realty/onsia-new-crm`
3. `main` 브랜치 push 시 자동 배포

## 📱 모바일 앱으로 사용하기 (PWA)

### iOS (iPhone/iPad)

1. **Safari로 접속**: https://onsia-crm.vercel.app
2. **홈 화면에 추가**:
   - 하단 공유 버튼 탭 (사각형에 화살표 ↑)
   - "홈 화면에 추가" 선택
   - 이름 확인 후 "추가" 탭
3. **앱 실행**:
   - 홈 화면의 온시아 아이콘 탭
   - ✨ 인트로 애니메이션 (1.8초)
   - 로그인 → 대시보드

### Android

1. **Chrome으로 접속**: https://onsia-crm.vercel.app
2. **홈 화면에 추가**:
   - 우측 상단 메뉴(⋮) 탭
   - "홈 화면에 추가" 선택
   - 또는 자동 팝업 "설치" 탭
3. **앱 실행**:
   - 앱 서랍의 온시아 아이콘 탭
   - ✨ 인트로 애니메이션 (1.8초)
   - 로그인 → 대시보드

### PC (Chrome/Edge)

1. **브라우저로 접속**: https://onsia-crm.vercel.app
2. **앱 설치**: 주소창 우측 설치 아이콘(⊕) 클릭
3. **독립 앱으로 실행**: 데스크톱 바로가기로 브라우저 UI 없이 실행

## 📋 배포 후 체크리스트

- [ ] 환경 변수가 모두 설정되었는지 확인
- [ ] 데이터베이스 연결 테스트
- [ ] 관리자 계정으로 로그인 (`admin` / `Admin!234`)
- [ ] 회원가입 및 승인 플로우 테스트
- [ ] 고객 등록/조회 테스트
- [ ] Prisma 마이그레이션 확인
- [ ] ✨ **인트로 화면 확인** (첫 접속 시 1.8초 애니메이션)
- [ ] 📱 **PWA 설치 테스트** (iOS/Android/PC)
- [ ] 🎨 **브랜드 아이콘** 및 스플래시 스크린 확인
- [ ] 📵 **오프라인 모드** 테스트 (/offline 페이지)

## 🔧 데이터베이스 마이그레이션

배포 후 자동으로 `prisma generate`가 실행됩니다.
마이그레이션은 `buildCommand`에 포함되어 있습니다.

## 🌐 커스텀 도메인 설정 (선택)

Vercel 대시보드에서 커스텀 도메인을 추가할 수 있습니다:
1. Settings → Domains
2. `onsia.com` 또는 원하는 도메인 추가
3. DNS 레코드 설정

## 🐛 문제 해결

### 빌드 실패
- Vercel 로그 확인: https://vercel.com/realtors77-7871s-projects/onsia-crm/deployments
- 환경 변수 누락 확인
- `pnpm prisma generate` 실행 확인

### 데이터베이스 연결 오류
- DATABASE_URL 확인
- Supabase에서 IPv4 Connection Pooler 사용 확인
- Vercel Functions에서 Serverless Postgres 연결 제한 확인

### NextAuth 오류
- AUTH_URL과 NEXTAUTH_URL이 실제 배포 URL과 일치하는지 확인
- AUTH_SECRET과 NEXTAUTH_SECRET이 설정되었는지 확인
- 브라우저 쿠키 설정 확인

## 📞 지원

문제가 발생하면 Vercel 로그와 함께 이슈를 보고해주세요.
