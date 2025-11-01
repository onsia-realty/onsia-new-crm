# GitHub/Vercel 권한 관리 가이드

> 온시아 CRM 프로젝트의 GitHub 및 Vercel 권한 설정 방법

---

## 📋 목차

1. [GitHub 권한 관리](#github-권한-관리)
2. [Vercel 권한 관리](#vercel-권한-관리)
3. [권한 수준별 가이드](#권한-수준별-가이드)
4. [신규 팀원 추가 절차](#신규-팀원-추가-절차)
5. [퇴사자 권한 제거 절차](#퇴사자-권한-제거-절차)

---

## 🔐 GitHub 권한 관리

### 권한 수준

| 역할 | 권한 | 대상 | 설명 |
|------|------|------|------|
| **Owner** | 전체 관리 | 대표, CTO | Repository 삭제, 설정 변경, 모든 작업 가능 |
| **Admin** | 관리자 | 팀장, 시니어 | Settings 접근, Collaborators 관리, Secrets 관리 |
| **Write** | 읽기/쓰기 | 개발자 | 코드 Push, Pull Request, Branch 생성 |
| **Read** | 읽기 전용 | 인턴, 외주 | 코드 열람만 가능, 수정 불가 |

### GitHub 권한 설정 방법

#### 1. Repository 접속
```
https://github.com/[organization]/onsia-crm
```

#### 2. Settings > Manage access
1. Repository 페이지에서 **"Settings"** 탭 클릭
2. 왼쪽 메뉴에서 **"Manage access"** 선택

#### 3. 사용자 추가
1. **"Add people"** 버튼 클릭
2. GitHub 사용자명 또는 이메일 입력
3. 권한 수준 선택:
   - `Read`: 코드 열람만
   - `Write`: 코드 수정 가능
   - `Admin`: 관리 권한
4. **"Add to repository"** 클릭

#### 4. 권한 변경
1. "Manage access" 페이지에서 사용자 찾기
2. 역할 드롭다운 클릭
3. 새로운 권한 수준 선택

#### 5. 권한 제거
1. "Manage access" 페이지에서 사용자 찾기
2. **"Remove"** 버튼 클릭
3. 확인 다이얼로그에서 **"Remove"** 클릭

---

## ☁️ Vercel 권한 관리

### 권한 수준

| 역할 | 권한 | 대상 | 설명 |
|------|------|------|------|
| **Owner** | 전체 관리 | 대표, CTO | 팀 설정, 결제, 프로젝트 삭제 |
| **Member** | 프로젝트 관리 | 개발자 | 배포, 로그 확인, 설정 변경 |
| **Viewer** | 열람 전용 | 디자이너, 기획자 | 배포된 사이트만 접근 |

### Vercel 권한 설정 방법

#### 1. Vercel Dashboard 접속
```
https://vercel.com/[team-name]
```

#### 2. Team Settings
1. 왼쪽 상단 팀 이름 클릭
2. **"Team Settings"** 선택
3. **"Members"** 탭 클릭

#### 3. 팀원 초대
1. **"Invite Member"** 버튼 클릭
2. 이메일 주소 입력
3. 역할 선택:
   - `Viewer`: 배포 결과만 확인
   - `Member`: 프로젝트 관리
   - `Owner`: 전체 관리 (신중하게!)
4. **"Invite"** 클릭

#### 4. 역할 변경
1. "Members" 탭에서 사용자 찾기
2. 역할 드롭다운 클릭
3. 새로운 역할 선택

#### 5. 팀원 제거
1. "Members" 탭에서 사용자 찾기
2. **"Remove"** 버튼 클릭
3. 확인 다이얼로그에서 확인

---

## 👥 권한 수준별 가이드

### 대표/CTO (Owner)

**GitHub**: Owner
**Vercel**: Owner

**할 수 있는 것:**
- ✅ 모든 코드 접근 및 수정
- ✅ Repository 설정 변경
- ✅ GitHub Secrets 관리
- ✅ Vercel 환경변수 관리
- ✅ 팀원 추가/제거
- ✅ 결제 및 플랜 변경

**책임:**
- 중요한 변경사항은 팀원과 공유
- Secrets 및 환경변수 안전하게 관리
- 정기적인 권한 검토

---

### 팀장/시니어 개발자 (Admin)

**GitHub**: Admin
**Vercel**: Member

**할 수 있는 것:**
- ✅ 모든 코드 접근 및 수정
- ✅ Pull Request 승인
- ✅ GitHub Secrets 관리
- ✅ Vercel 배포
- ✅ 로그 확인
- ❌ Repository 삭제 (Owner만)
- ❌ Vercel 환경변수 수정 (Owner만)

**책임:**
- 코드 리뷰 및 품질 관리
- 배포 프로세스 관리
- 팀원 코드 검토

---

### 개발자 (Write)

**GitHub**: Write
**Vercel**: Member

**할 수 있는 것:**
- ✅ 코드 읽기 및 쓰기
- ✅ Branch 생성
- ✅ Pull Request 생성
- ✅ Issue 생성 및 관리
- ✅ Vercel 배포 로그 확인
- ❌ Settings 수정 불가
- ❌ Secrets 접근 불가
- ❌ 환경변수 수정 불가

**책임:**
- 기능 개발 및 버그 수정
- Pull Request 작성
- 코드 품질 유지

---

### 인턴/외주 (Read)

**GitHub**: Read
**Vercel**: Viewer (또는 없음)

**할 수 있는 것:**
- ✅ 코드 읽기
- ✅ Issue 확인
- ❌ 코드 수정 불가
- ❌ Pull Request 생성 불가
- ❌ 배포 불가

**책임:**
- 학습 및 코드 이해
- 질문 및 피드백
- 보안 규정 준수

---

## 🆕 신규 팀원 추가 절차

### 1. 사전 준비
- [ ] 팀원의 GitHub 계정 확인
- [ ] 팀원의 이메일 주소 확인
- [ ] 적절한 권한 수준 결정
- [ ] NDA 서명 완료

### 2. GitHub 추가
1. Repository > Settings > Manage access
2. "Add people" 클릭
3. GitHub 사용자명 입력
4. 권한 수준 선택 (일반적으로 Write)
5. 추가 완료

### 3. Vercel 추가
1. Vercel Dashboard > Team Settings > Members
2. "Invite Member" 클릭
3. 이메일 입력
4. 역할 선택 (일반적으로 Member)
5. 초대 발송

### 4. 환경 설정 안내
팀원에게 다음 사항 안내:
- `.env.example`을 복사하여 `.env` 생성
- 필요한 환경변수 값 요청
- 로컬 개발 환경 설정 가이드 제공
- 보안 규정(`SECURITY.md`) 숙지

### 5. 테스트
- [ ] 팀원이 Repository Clone 가능한지 확인
- [ ] 로컬 개발 환경이 정상 작동하는지 확인
- [ ] Pull Request 생성이 가능한지 확인

---

## 🚪 퇴사자 권한 제거 절차

### 즉시 조치 (퇴사일 당일)

#### 1. GitHub 접근 제거
1. Repository > Settings > Manage access
2. 퇴사자 찾기
3. "Remove" 클릭
4. 확인

#### 2. Vercel 접근 제거
1. Team Settings > Members
2. 퇴사자 찾기
3. "Remove" 클릭
4. 확인

#### 3. 환경변수 변경 (중요한 경우)
- `AUTH_SECRET` 재생성
- `DATABASE_URL` 비밀번호 변경 (필요시)
- Vercel 환경변수 업데이트

### 추가 조치

#### 4. 퇴사자 체크리스트 완료
- [ ] 로컬 코드 삭제 확인
- [ ] `.env` 파일 삭제 확인
- [ ] 회사 자산 반납 확인
- [ ] 비밀유지 서약서 서명

> 자세한 내용은 `docs/OFFBOARDING-CHECKLIST.md` 참조

#### 5. 감사 로그 확인
- GitHub Audit Log 검토
- Vercel Deployment History 검토
- 이상 활동 여부 확인

---

## 🔄 정기 권한 검토

### 월간 검토 (매월 1일)
- [ ] 현재 팀원 목록 확인
- [ ] 퇴사자 권한 제거 확인
- [ ] 불필요한 권한 축소

### 분기별 검토 (분기 첫째 주)
- [ ] GitHub Audit Log 전체 검토
- [ ] Vercel Activity Log 전체 검토
- [ ] 환경변수 안전성 점검
- [ ] Secrets 접근 권한 검토

---

## 📊 권한 매트릭스

| 작업 | Owner | Admin | Write | Read |
|------|-------|-------|-------|------|
| 코드 읽기 | ✅ | ✅ | ✅ | ✅ |
| 코드 수정 | ✅ | ✅ | ✅ | ❌ |
| PR 생성 | ✅ | ✅ | ✅ | ❌ |
| PR 승인 | ✅ | ✅ | ✅ | ❌ |
| Settings 수정 | ✅ | ✅ | ❌ | ❌ |
| Secrets 관리 | ✅ | ✅ | ❌ | ❌ |
| 팀원 관리 | ✅ | ❌ | ❌ | ❌ |
| Repository 삭제 | ✅ | ❌ | ❌ | ❌ |
| Vercel 배포 | ✅ | ✅ | ✅ | ❌ |
| 환경변수 수정 | ✅ | ❌ | ❌ | ❌ |

---

## 🚨 긴급 상황 대응

### 권한 오남용 발견 시
1. **즉시 해당 사용자 권한 제거**
2. `AUTH_SECRET` 재생성
3. 환경변수 변경
4. Audit Log 전체 검토
5. 피해 범위 파악
6. 필요시 법적 조치

### 비상 연락처
- 기술 책임자: [CTO 연락처]
- 보안 담당자: [보안팀 연락처]

---

**최종 업데이트**: 2025-10-25
**문서 관리자**: Development Team
