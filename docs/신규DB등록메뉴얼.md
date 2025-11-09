# 신규 DB 테이블 등록 메뉴얼

## 📌 중요: Prisma 스키마 수정 후 반드시 마이그레이션 실행!

스키마 파일(`prisma/schema.prisma`)에 새로운 모델을 추가했다고 DB에 테이블이 자동으로 생성되지 않습니다.
반드시 마이그레이션을 실행해야 합니다!

---

## 1. 정석 방법 (권장) ✅

### 1-1. Prisma 스키마 수정
```prisma
// prisma/schema.prisma
model NewTable {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  // ... 필드 정의
}
```

### 1-2. 마이그레이션 생성 및 적용
```bash
# 마이그레이션 파일 생성
npx prisma migrate dev --name add_new_table

# 또는 스키마만 푸시 (개발 환경)
npx prisma db push

# Prisma Client 재생성
npx prisma generate
```

### 1-3. 개발 서버 재시작
```bash
# Ctrl+C로 종료 후
pnpm dev
```

---

## 2. 문제 발생 시 응급 처치 🚨

### 증상
- API 호출 시 500 에러
- 에러 메시지: `The table 'public.TableName' does not exist in the current database`

### 2-1. 임시 API 엔드포인트로 테이블 생성

`app/api/admin/create-table/route.ts` 파일 생성:

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    console.log('Creating table...');

    // Enum 생성 (필요한 경우)
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "StatusEnum" AS ENUM ('VALUE1', 'VALUE2');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 테이블 생성
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TableName" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "status" "StatusEnum" DEFAULT 'VALUE1',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 인덱스 생성
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "TableName_name_idx" ON "TableName"("name");
    `);

    return NextResponse.json({
      success: true,
      message: 'Table created successfully',
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to create table' },
      { status: 500 }
    );
  }
}
```

### 2-2. API 호출로 테이블 생성
```bash
# 터미널에서 실행
curl -X POST http://localhost:3000/api/admin/create-table

# 또는 브라우저에서 직접 접속 (POST 요청 도구 사용)
```

### 2-3. 정리
```bash
# 임시 파일 삭제
rm -rf app/api/admin/create-table

# Git 커밋
git add .
git commit -m "feat: 새 테이블 추가"
```

---

## 3. Supabase 직접 SQL 실행 방법 🗄️

### 3-1. Supabase 대시보드 접속
1. https://supabase.com 로그인
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 3-2. SQL 직접 실행
```sql
-- Enum 타입 생성
CREATE TYPE "StatusEnum" AS ENUM ('VALUE1', 'VALUE2', 'VALUE3');

-- 테이블 생성
CREATE TABLE "TableName" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "status" "StatusEnum" DEFAULT 'VALUE1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX "TableName_name_idx" ON "TableName"("name");

-- 외래 키 설정 (필요 시)
ALTER TABLE "TableName"
ADD CONSTRAINT "TableName_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
```

---

## 4. 체크리스트 📝

### 새 테이블 추가 시
- [ ] `prisma/schema.prisma`에 모델 정의
- [ ] `npx prisma migrate dev --name 설명` 실행
- [ ] `npx prisma generate` 실행
- [ ] 개발 서버 재시작
- [ ] API 엔드포인트 테스트
- [ ] Git 커밋

### 문제 해결 시
- [ ] 에러 메시지 확인 (테이블 이름)
- [ ] Prisma 스키마에 정의되어 있는지 확인
- [ ] 마이그레이션 실행 여부 확인
- [ ] DB 직접 확인 (Supabase Table Editor)

---

## 5. 주의사항 ⚠️

1. **개발/프로덕션 분리**
   - 개발: `npx prisma db push` 사용 가능
   - 프로덕션: 반드시 `npx prisma migrate deploy` 사용

2. **데이터 손실 방지**
   - 테이블 삭제/수정 시 백업 필수
   - `--accept-data-loss` 옵션은 신중히 사용

3. **팀 협업**
   - 마이그레이션 파일은 반드시 Git에 커밋
   - `prisma/migrations/` 폴더 공유 필수

4. **Enum 타입**
   - PostgreSQL enum은 수정이 어려움
   - 가능하면 String 필드 + 검증으로 대체 고려

---

## 6. 자주 발생하는 오류

### "The table does not exist"
```bash
# 해결 방법
npx prisma db push
```

### "Drift detected"
```bash
# 해결 방법 1: 마이그레이션 리셋 (데이터 손실!)
npx prisma migrate reset

# 해결 방법 2: 베이스라인 설정
npx prisma migrate resolve --applied [마이그레이션명]
```

### "Can't reach database server"
```bash
# .env 파일 확인
DATABASE_URL="올바른_연결_문자열"

# Supabase는 두 가지 URL 사용
DATABASE_URL="...pooler.supabase.com:6543/postgres?pgbouncer=true"  # 앱용
DIRECT_URL="...pooler.supabase.com:5432/postgres"  # 마이그레이션용
```

---

## 7. 실제 사례: AdCallNumber 테이블

### 문제 상황
- `prisma/schema.prisma`에 AdCallNumber 모델 추가
- 마이그레이션 실행하지 않음
- API 호출 시 500 에러 발생

### 해결 과정
1. 임시 API 엔드포인트 생성 (`/api/admin/create-ad-call-table`)
2. SQL로 직접 테이블 생성
3. 개발 서버 재시작
4. 정상 작동 확인

### 교훈
**스키마 수정 후 반드시 마이그레이션 실행!**

---

작성일: 2024-11-09
최종 수정: 2024-11-09