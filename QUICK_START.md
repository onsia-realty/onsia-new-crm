# 🚀 빠른 시작 가이드 - 온시아 CRM

회사 ↔ 집 환경 동기화를 위한 빠른 설치 가이드입니다.

---

## 📋 사전 준비

### 필수 설치
- **Node.js** 20.x 이상: https://nodejs.org
- **pnpm** 8.x 이상: `npm install -g pnpm`
- **Git**: https://git-scm.com

### 데이터베이스 선택 (아래 중 하나)

**옵션 A: 로컬 PostgreSQL** (권장 - 회사 환경과 동일)
- PostgreSQL 14.x 이상
- Windows: https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql@14`

**옵션 B: Supabase** (설치 불필요, 클라우드 DB)
- 회원가입: https://supabase.com
- 무료 플랜 (500MB DB)
- 회사 ↔ 집 DB 공유 가능

**옵션 C: Vercel Postgres** (배포용)
- Vercel 프로젝트 연결 필요

---

## 🎯 처음 설치 (약 5분)

### 1️⃣ 저장소 클론

```bash
# GitHub에서 클론
git clone https://github.com/your-organization/onsia-crm.git
cd onsia-crm

# 또는 회사 GitLab
git clone https://gitlab.company.com/onsia/crm.git
cd crm
```

### 2️⃣ 자동 설치 스크립트 실행

#### Windows:
```batch
setup.bat
```

#### Mac/Linux:
```bash
chmod +x setup.sh
./setup.sh
```

스크립트가 자동으로 처리하는 것:
- ✅ Node.js/pnpm 확인
- ✅ `.env` 파일 생성 (`.env.example`에서 복사)
- ✅ 의존성 설치 (`pnpm install`)
- ✅ Prisma 클라이언트 생성
- ✅ 데이터베이스 마이그레이션 (선택)
- ✅ 시드 데이터 생성 (선택)

### 3️⃣ `.env` 파일 설정

설치 스크립트가 `.env` 파일을 생성했으면, 아래 값만 수정하세요:

```env
# 옵션 A: 로컬 PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/onsia_crm?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/onsia_crm?schema=public"

# 옵션 B: Supabase
DATABASE_URL="postgresql://postgres:[비밀번호]@db.xxxxx.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[비밀번호]@db.xxxxx.supabase.co:5432/postgres"
```

**NEXTAUTH_SECRET**은 그대로 두거나, 아래 명령어로 생성:
```bash
openssl rand -base64 32
```

### 4️⃣ 개발 서버 시작

```bash
pnpm dev
```

브라우저에서 http://localhost:3000 접속!

### 5️⃣ 로그인

기본 관리자 계정 (시드 데이터 실행 시):
- **아이디**: `admin`
- **비밀번호**: `Admin!234`

---

## 🔄 회사 ↔ 집 동기화

### 회사에서 작업 후 집으로 가져오기

```bash
# 회사 노트북에서
git add .
git commit -m "작업 내용 설명"
git push origin main

# 집 데스크탑에서
git pull origin main
pnpm install  # package.json 변경 시만
pnpm db:migrate  # 스키마 변경 시만
pnpm dev
```

### 집에서 작업 후 회사로 가져오기

```bash
# 집 데스크탑에서
git add .
git commit -m "작업 내용 설명"
git push origin main

# 회사 노트북에서
git pull origin main
pnpm install  # package.json 변경 시만
pnpm db:migrate  # 스키마 변경 시만
pnpm dev
```

---

## 🛠 유용한 명령어

### 데이터베이스

```bash
# 마이그레이션 적용 (개발 환경)
pnpm db:migrate

# 마이그레이션 적용 (프로덕션)
pnpm db:deploy

# 시드 데이터 생성
pnpm db:seed

# 데이터베이스 리셋 (주의: 모든 데이터 삭제)
pnpm db:reset

# Prisma Studio 실행 (DB GUI)
pnpm db:studio
```

### 개발

```bash
# 개발 서버 시작
pnpm dev

# 프로덕션 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start

# 린트 검사
pnpm lint
```

### 환경 초기화

```bash
# .env 파일만 재생성
pnpm setup:env

# 전체 환경 재설치
pnpm setup:full
```

---

## 🚨 트러블슈팅

### 1. "Can't reach database server"

**문제**: PostgreSQL 서버가 실행되지 않음

**해결**:
```bash
# Windows
net start postgresql-x64-14

# Mac
brew services start postgresql@14

# Linux
sudo systemctl start postgresql
```

### 2. "Prisma Client not found"

**문제**: Prisma 클라이언트가 생성되지 않음

**해결**:
```bash
pnpm prisma generate
```

### 3. "Migration conflict"

**문제**: 마이그레이션 충돌

**해결**:
```bash
# 개발 환경: 리셋 (주의: 데이터 삭제)
pnpm db:reset

# 또는 수동 해결
pnpm prisma migrate resolve --applied "migration_name"
```

### 4. "Port 3000 already in use"

**문제**: 3000 포트가 이미 사용 중

**해결**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID [PID번호] /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### 5. ".env 파일이 없어요"

**문제**: `.env` 파일이 생성되지 않음

**해결**:
```bash
# 수동으로 복사
cp .env.example .env

# 또는
pnpm setup:env
```

---

## 📚 추가 문서

- 📖 [전체 README](./README.md) - 종합 프로젝트 문서
- 🔐 [보안 가이드](./SECURITY.md) - 보안 정책 및 코드 보호
- 🚀 [Vercel 배포](./VERCEL_DEPLOY.md) - 프로덕션 배포 가이드
- 👥 [권한 관리](./docs/GITHUB-VERCEL-PERMISSIONS.md) - GitHub/Vercel 권한

---

## 💡 팁

### 1. DB 공유하기 (회사↔집 동일 DB)

Supabase 사용 시 회사와 집에서 동일한 `DATABASE_URL`을 사용하면 됩니다!

```env
# 회사 .env
DATABASE_URL="postgresql://postgres:비밀번호@db.abc.supabase.co:5432/postgres"

# 집 .env (동일!)
DATABASE_URL="postgresql://postgres:비밀번호@db.abc.supabase.co:5432/postgres"
```

### 2. 로컬 DB 백업

```bash
# 백업
pg_dump -U postgres onsia_crm > backup.sql

# 복원
psql -U postgres onsia_crm < backup.sql
```

### 3. 빠른 재설치

```bash
# 모든 것 삭제하고 재설치
rm -rf node_modules .next
pnpm install
pnpm db:reset
pnpm dev
```

---

## 🎉 완료!

이제 회사/집 어디서든 동일한 환경에서 개발할 수 있습니다!

문제가 있으면 팀에 문의하세요! 😊
