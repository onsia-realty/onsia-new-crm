# 온시아 CRM 보안 가이드

> **목적**: 이 문서는 온시아 CRM 프로젝트의 코드 보호 및 보안 정책을 설명합니다.

---

## 📋 목차

1. [보안 철학](#보안-철학)
2. [코드 보호 전략](#코드-보호-전략)
3. [GitHub/Vercel 권한 관리](#githubvercel-권한-관리)
4. [환경변수 관리](#환경변수-관리)
5. [API 보안](#api-보안)
6. [빌드 및 배포 보안](#빌드-및-배포-보안)
7. [직원 보안 규정](#직원-보안-규정)
8. [보안 사고 대응](#보안-사고-대응)

---

## 🎯 보안 철학

### 핵심 원칙: "복제해도 작동하지 않게"

온시아 CRM의 보안은 다음 3가지 계층으로 구성됩니다:

```
┌─────────────────────────────────────┐
│  1계층: 접근 통제 (가장 중요)        │
│  - GitHub/Vercel 권한 관리          │
│  - 환경변수 보호                    │
│  - API 인증                        │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  2계층: 코드 난독화                 │
│  - 프로덕션 빌드 난독화             │
│  - Console 로그 제거                │
│  - 소스맵 비활성화                  │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  3계층: 법적 보호                   │
│  - 저작권 명시                      │
│  - NDA (비밀유지계약)               │
│  - 디지털 워터마크                  │
└─────────────────────────────────────┘
```

### ⚠️ 중요한 현실 인식

**F12 개발자 도구로 프론트엔드 코드를 보는 것은 막을 수 없습니다.**

하지만 우리가 할 수 있는 것:
- ✅ 코드를 복사해도 **API 없이는 작동하지 않게** 만들기
- ✅ 코드를 **이해하기 어렵게** 난독화
- ✅ 복사 사실을 **추적 가능하게** 워터마크 삽입
- ✅ **법적 대응 근거** 마련

---

## 🛡️ 코드 보호 전략

### 1. 비즈니스 로직 서버 분리

**핵심 원칙**: 중요한 로직은 절대 프론트엔드에 두지 않는다.

```typescript
// ❌ 나쁜 예: 프론트엔드에서 직접 계산
const calculateCommission = (amount: number) => {
  return amount * 0.15; // 수수료 로직 노출
};

// ✅ 좋은 예: 서버에서만 계산
const response = await fetch('/api/calculate-commission', {
  method: 'POST',
  body: JSON.stringify({ amount }),
});
```

### 2. 프로덕션 난독화

`next.config.ts`에 설정된 난독화:
- Console 로그 자동 제거 (error, warn 제외)
- 변수명/함수명 난독화
- 소스맵 제거
- 디지털 워터마크 자동 삽입

**개발 환경에는 영향 없음** → `pnpm dev`는 그대로 작동

### 3. 디지털 워터마크

모든 프로덕션 JS 파일에 자동 삽입:
```javascript
/*! © 2025 Onsia Corp. All Rights Reserved. BuildID: abc123xyz */
```

이를 통해:
- 코드 출처 추적 가능
- 법적 대응 근거 확보
- 심리적 억제 효과

---

## 🔐 GitHub/Vercel 권한 관리

### GitHub Repository 권한 구조

```
Owner (대표/CTO)
  ↓
Admin (팀장급)
  - 코드 읽기/쓰기
  - Settings 수정 가능
  - Secrets 관리 가능
  ↓
Write (개발자)
  - 코드 읽기/쓰기
  - Pull Request 생성
  - Settings 접근 불가
  ↓
Read (인턴/외주)
  - 코드 읽기만 가능
  - 수정 불가
```

### Vercel Team 권한 구조

```
Owner (대표/CTO)
  ↓
Member (개발자)
  - 프로젝트 보기
  - 배포 로그 확인
  - 환경변수 보기 불가
  ↓
Viewer (디자이너/기획자)
  - 배포된 사이트만 접근
```

### 권한 설정 방법

#### GitHub

1. Repository → Settings → Manage access
2. "Add people" 클릭
3. 사용자 추가 후 권한 선택:
   - `Read`: 코드 열람만
   - `Write`: 코드 수정 가능
   - `Admin`: 전체 관리 가능

#### Vercel

1. Team Settings → Members
2. "Invite Member" 클릭
3. 역할 선택:
   - `Viewer`: 배포 결과만 확인
   - `Member`: 프로젝트 관리
   - `Owner`: 전체 관리

---

## 🔑 환경변수 관리

### 환경변수 보호 규칙

1. **절대 커밋하지 않기**
   - `.env` 파일은 `.gitignore`에 포함됨
   - `.env.example`만 커밋 (값 제외)

2. **Vercel에 직접 설정**
   ```
   Vercel Dashboard
   → 프로젝트 선택
   → Settings
   → Environment Variables
   → 각 환경별 설정 (Production/Preview/Development)
   ```

3. **로컬 개발 환경**
   - `.env.example`을 복사해 `.env` 생성
   - 실제 값 입력
   - 절대 공유하지 않기

### 필수 환경변수

```bash
DATABASE_URL          # PostgreSQL 연결 문자열
AUTH_SECRET          # NextAuth 암호화 키
AUTH_URL             # 애플리케이션 URL
NODE_ENV             # development | production
```

### 환경변수 생성 가이드

```bash
# AUTH_SECRET 생성 (32자 이상)
openssl rand -base64 32

# 또는
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 🚀 API 보안

### 1. NextAuth 인증

모든 API 라우트는 NextAuth 세션 검증:

```typescript
// app/api/your-route/route.ts
import { auth } from '@/lib/auth';

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... 로직
}
```

### 2. 역할 기반 접근 제어 (RBAC)

```typescript
import { checkPermission } from '@/lib/auth/rbac';

export async function POST() {
  const canAllocate = await checkPermission('customers', 'allocate');
  if (!canAllocate) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }
  // ... 로직
}
```

### 3. Rate Limiting (예정)

향후 추가 예정:
- IP 기반 요청 제한
- 사용자별 API 호출 제한
- 비정상 패턴 감지

---

## 📦 빌드 및 배포 보안

### 개발 환경 (pnpm dev)

- 난독화 **없음**
- Console 로그 **유지**
- 소스맵 **활성화**
- 워터마크 **없음**

→ **개발 편의성 최우선**

### 프로덕션 빌드 (pnpm build)

```bash
pnpm build
```

자동 적용:
- ✅ 코드 난독화
- ✅ Console 로그 제거 (error, warn 제외)
- ✅ 소스맵 제거
- ✅ 디지털 워터마크 삽입
- ✅ 보안 헤더 설정

### Vercel 배포 체크리스트

배포 전 확인사항:

- [ ] 환경변수가 Vercel에 설정되어 있는가?
- [ ] `DATABASE_URL`이 프로덕션 DB를 가리키는가?
- [ ] `AUTH_SECRET`이 안전한 값인가?
- [ ] `.env` 파일이 커밋되지 않았는가?
- [ ] 빌드가 로컬에서 성공하는가?

---

## 👥 직원 보안 규정

### 모든 직원이 지켜야 할 사항

1. **코드 관리**
   - ❌ 개인 GitHub에 코드 업로드 금지
   - ❌ USB/외장하드에 코드 복사 금지
   - ❌ 스크린샷으로 코드 공유 금지
   - ✅ 회사 GitHub에서만 작업

2. **환경변수**
   - ❌ `.env` 파일 절대 커밋 금지
   - ❌ Slack/Discord에 환경변수 공유 금지
   - ✅ Vercel 환경변수만 사용

3. **접근 권한**
   - ❌ 타인 계정으로 로그인 금지
   - ❌ API 키를 개인 프로젝트에 사용 금지
   - ✅ 필요한 권한만 요청

### 퇴사 시 의무사항

퇴사자는 반드시:
- [ ] 로컬 코드 삭제
- [ ] GitHub 접근 권한 반납
- [ ] Vercel 계정 제거
- [ ] `.env` 파일 삭제
- [ ] 비밀유지 서약서 서명

> 자세한 내용은 `docs/OFFBOARDING-CHECKLIST.md` 참조

---

## 🚨 보안 사고 대응

### 코드 유출 의심 시

1. **즉시 조치**
   - GitHub Access Token 재생성
   - Vercel 환경변수 변경
   - AUTH_SECRET 재생성
   - DATABASE_URL 변경 (필요시)

2. **조사**
   - GitHub Audit Log 확인
   - Vercel Deployment Log 확인
   - 누가, 언제, 무엇을 접근했는지 추적

3. **법적 대응**
   - NDA 위반 여부 확인
   - 저작권 침해 여부 확인
   - 필요시 법률 자문

### 비상 연락처

- 기술 책임자: [CTO 연락처]
- 보안 담당자: [보안팀 연락처]
- 법무팀: [법무팀 연락처]

---

## 📚 관련 문서

- `docs/GITHUB-VERCEL-PERMISSIONS.md` - 권한 관리 상세 가이드
- `docs/NDA-TEMPLATE.md` - 직원 비밀유지계약서 템플릿
- `docs/OFFBOARDING-CHECKLIST.md` - 퇴사자 점검표
- `.env.example` - 환경변수 템플릿

---

## 🔄 문서 업데이트

- **최초 작성**: 2025-10-25
- **최종 수정**: 2025-10-25
- **담당자**: Development Team

---

## ⚖️ 법적 고지

이 문서는 온시아 CRM 프로젝트의 보안 정책을 설명하며,
모든 직원 및 협력사는 이 규정을 준수해야 합니다.

위반 시:
- 징계 조치
- 손해배상 청구
- 형사 고발

가능성이 있음을 알려드립니다.
