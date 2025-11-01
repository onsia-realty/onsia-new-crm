# Vercel 배포 가이드 - 온시아 CRM

## 🚨 현재 문제 해결 방법

Vercel에 배포된 사이트에서 "사용자 목록을 불러오는데 실패했습니다" 에러가 발생하는 경우, 아래 단계를 따라 해결하세요.

## 1. Vercel 환경 변수 설정

### 1-1. Vercel 대시보드 접속
1. https://vercel.com 로그인
2. 프로젝트 선택 (onsia-crm)
3. Settings → Environment Variables 이동

### 1-2. 필수 환경 변수 추가

다음 환경 변수를 반드시 설정해야 합니다:

#### DATABASE_URL
```
postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require
```
- **Vercel Postgres 사용 시**: Vercel Storage에서 자동 생성된 URL 사용
- **Supabase 사용 시**: Supabase 프로젝트의 Connection String (Transaction) 사용

#### AUTH_SECRET / NEXTAUTH_SECRET
```
# 아래 명령으로 생성
openssl rand -base64 32
```
- 최소 32자 이상의 무작위 문자열
- AUTH_SECRET과 NEXTAUTH_SECRET 둘 다 같은 값으로 설정

#### AUTH_URL / NEXTAUTH_URL
```
https://onsia-crm.vercel.app
```
- 배포된 사이트의 실제 URL로 설정
- http가 아닌 https 사용

## 2. 데이터베이스 설정

### 옵션 A: Vercel Postgres 사용 (권장)

1. Vercel 대시보드 → Storage 탭
2. Create Database → Postgres
3. 생성 완료 후 자동으로 DATABASE_URL이 환경 변수에 추가됨
4. 데이터베이스 탭에서 Query 실행하여 연결 테스트

### 옵션 B: Supabase PostgreSQL 사용

1. https://supabase.com 에서 프로젝트 생성
2. Settings → Database → Connection String 복사
3. **Transaction** 모드의 연결 문자열 사용 (중요!)
4. Vercel 환경 변수에 DATABASE_URL로 추가

## 3. 배포 프로세스

### 3-1. 로컬에서 빌드 테스트
```bash
# 로컬 빌드 테스트
pnpm build

# 빌드 성공 확인
pnpm start
```

### 3-2. Git Push로 자동 배포
```bash
git add .
git commit -m "fix: Vercel 배포 환경 설정 수정"
git push origin main
```

### 3-3. Vercel 대시보드에서 확인
1. Deployments 탭에서 빌드 진행 상태 확인
2. 빌드 로그에서 에러 확인
3. Functions 탭에서 서버리스 함수 로그 확인

## 4. 배포 후 데이터베이스 마이그레이션

### 방법 1: Vercel CLI 사용
```bash
# Vercel CLI 설치
npm i -g vercel

# 프로덕션 환경에서 마이그레이션 실행
vercel env pull .env.production
npx prisma migrate deploy
npx prisma db seed
```

### 방법 2: GitHub Actions 자동화 (이미 설정됨)
- `.github/workflows/deploy.yml` 파일에 자동 마이그레이션 설정
- main 브랜치 push 시 자동 실행

## 5. 문제 해결 체크리스트

### ✅ 환경 변수 체크
- [ ] DATABASE_URL이 올바르게 설정되었나?
- [ ] AUTH_SECRET이 설정되었나?
- [ ] AUTH_URL이 https로 시작하나?
- [ ] 모든 환경 변수가 Production 환경에 적용되었나?

### ✅ 데이터베이스 체크
- [ ] 데이터베이스 연결 문자열에 `?sslmode=require`가 포함되어 있나?
- [ ] 데이터베이스가 실제로 생성되었나?
- [ ] 마이그레이션이 실행되었나?
- [ ] 시드 데이터가 추가되었나?

### ✅ 빌드 체크
- [ ] package.json에 `"postinstall": "prisma generate"`가 있나?
- [ ] build 스크립트에 `prisma generate`가 포함되어 있나?

## 6. 일반적인 에러와 해결 방법

### "사용자 목록을 불러오는데 실패했습니다"
**원인**: 데이터베이스 연결 실패
**해결**:
1. DATABASE_URL 환경 변수 확인
2. 데이터베이스 SSL 설정 확인
3. Vercel Functions 로그 확인

### "PrismaClientInitializationError"
**원인**: Prisma Client가 생성되지 않음
**해결**:
1. `prisma generate` 명령이 빌드 시 실행되는지 확인
2. package.json의 postinstall 스크립트 확인

### "__webpack_modules__[moduleId] is not a function"
**원인**: 빌드 시 모듈 누락
**해결**:
1. node_modules 삭제 후 재설치
2. .next 캐시 삭제 후 재빌드

## 7. 모니터링

### Vercel 대시보드
- Functions 탭: API 라우트 실행 로그
- Analytics 탭: 성능 메트릭
- Logs 탭: 실시간 로그 스트리밍

### 로컬 디버깅
```bash
# Vercel 환경 변수를 로컬로 가져오기
vercel env pull

# 프로덕션 모드로 로컬 실행
NODE_ENV=production pnpm start
```

## 8. 지원 및 문의

- Vercel 상태: https://www.vercel-status.com/
- Vercel 문서: https://vercel.com/docs
- Prisma 문서: https://www.prisma.io/docs

---

## 📌 빠른 해결 (TL;DR)

1. Vercel 대시보드 → Settings → Environment Variables
2. 다음 3개 추가:
   - `DATABASE_URL`: PostgreSQL 연결 문자열
   - `AUTH_SECRET`: 32자 이상 무작위 문자열
   - `AUTH_URL`: https://onsia-crm.vercel.app
3. Redeploy 버튼 클릭
4. 3-5분 후 사이트 확인

문제가 지속되면 Vercel Functions 로그를 확인하세요.