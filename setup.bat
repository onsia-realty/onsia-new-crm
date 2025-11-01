@echo off
REM ============================================
REM 온시아 CRM 자동 설치 스크립트 (Windows)
REM ============================================

echo.
echo ========================================
echo   온시아 CRM 개발 환경 설치 시작!
echo ========================================
echo.

REM 1. Node.js 확인
echo [1/6] Node.js 버전 확인 중...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다!
    echo https://nodejs.org 에서 Node.js 20.x 이상을 설치하세요.
    pause
    exit /b 1
)
node --version
echo.

REM 2. pnpm 확인
echo [2/6] pnpm 확인 중...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] pnpm이 설치되어 있지 않습니다. 설치 중...
    npm install -g pnpm
)
pnpm --version
echo.

REM 3. .env 파일 확인
echo [3/6] 환경 변수 파일 확인 중...
if not exist .env (
    echo [INFO] .env 파일이 없습니다. .env.example을 복사합니다.
    copy .env.example .env
    echo.
    echo ============================================
    echo [중요] .env 파일을 열어서 DATABASE_URL을 설정하세요!
    echo ============================================
    echo.
    echo 옵션 1: 로컬 PostgreSQL
    echo   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/onsia_crm?schema=public"
    echo.
    echo 옵션 2: Supabase
    echo   DATABASE_URL="postgresql://postgres:[비밀번호]@db.xxxxx.supabase.co:5432/postgres"
    echo.
    pause
) else (
    echo [OK] .env 파일이 존재합니다.
)
echo.

REM 4. 의존성 설치
echo [4/6] 의존성 설치 중... (약 1-2분 소요)
pnpm install
if errorlevel 1 (
    echo [ERROR] 의존성 설치 실패!
    pause
    exit /b 1
)
echo.

REM 5. Prisma 설정
echo [5/6] Prisma 클라이언트 생성 중...
pnpm prisma generate
if errorlevel 1 (
    echo [ERROR] Prisma 클라이언트 생성 실패!
    pause
    exit /b 1
)
echo.

REM 6. 데이터베이스 마이그레이션
echo [6/6] 데이터베이스 마이그레이션 중...
echo.
echo [선택] 어떤 작업을 수행하시겠습니까?
echo   1. 새 DB에 마이그레이션 적용 (pnpm prisma migrate deploy)
echo   2. 개발 DB 마이그레이션 + 시드 데이터 (pnpm prisma migrate dev)
echo   3. 건너뛰기 (수동으로 나중에 실행)
echo.
set /p choice="선택 (1, 2, 3): "

if "%choice%"=="1" (
    pnpm prisma migrate deploy
    echo.
    echo [INFO] 시드 데이터를 넣으시려면: pnpm prisma db seed
) else if "%choice%"=="2" (
    pnpm prisma migrate dev --name init
    pnpm prisma db seed
) else (
    echo [INFO] 마이그레이션을 건너뜁니다.
)

echo.
echo ========================================
echo   설치 완료!
echo ========================================
echo.
echo 다음 명령어로 개발 서버를 시작하세요:
echo   pnpm dev
echo.
echo 브라우저에서 http://localhost:3000 접속
echo.
echo 기본 관리자 계정 (시드 데이터 실행한 경우):
echo   아이디: admin
echo   비밀번호: Admin!234
echo.
pause
