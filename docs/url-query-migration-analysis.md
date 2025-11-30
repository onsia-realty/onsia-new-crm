# URL 쿼리 파라미터 방식 마이그레이션 분석

> 작성일: 2025-11-28
> 목적: 고객 목록 페이지의 상태 관리를 sessionStorage → URL 쿼리 파라미터로 변경

## 배경

### 현재 문제점
- 2페이지에서 고객 상세 페이지로 이동 후, 이전/다음 버튼으로 여러 고객 이동
- "고객 목록" 클릭 시 1페이지로 초기화되는 버그 발생

### 원인
```javascript
// page.tsx:450-451
// 페이지 로드 시 세션스토리지 초기화
sessionStorage.removeItem('customerListFilter');
```

- 고객 목록 페이지 로드 시 `customerListFilter` 세션 스토리지가 삭제됨
- 여러 `useEffect`가 충돌하며 `setCurrentPage(1)` 호출

---

## 해결 방안: URL 쿼리 파라미터 방식

### 장점
- 브라우저 뒤로가기/앞으로가기 자연스럽게 동작
- 새로고침해도 상태 유지
- 링크 공유 가능
- Next.js의 `useSearchParams`와 자연스럽게 통합
- sessionStorage 로직 전부 제거 가능

### URL 예시
```
# 현재
/dashboard/customers

# 변경 후
/dashboard/customers?page=2&callFilter=not_called&site=용인경남아너스빌&viewAll=true
```

---

## 영향 분석

### 1. 삭제되는 코드

| 위치 | 코드 | 설명 |
|------|------|------|
| `page.tsx:414` | `sessionStorage.setItem('customerListFilter', ...)` | 필터 상태 저장 |
| `page.tsx:432-451` | `sessionStorage.getItem('customerListFilter')` + 복원 로직 전체 | 필터 상태 복원 |
| `page.tsx:451` | `sessionStorage.removeItem('customerListFilter')` | 세션 스토리지 삭제 |

### 2. 변경되는 코드

| 위치 | 현재 | 변경 후 |
|------|------|---------|
| `page.tsx:75` | `const [currentPage, setCurrentPage] = useState(1)` | URL에서 초기값 읽기 |
| `page.tsx:70-81` | 각 필터 상태 `useState` | URL 파라미터에서 초기화 |
| `page.tsx:307, 372, 629, 640, 651, 664, 683, 693, 705` | `setCurrentPage(1)` | `router.push`로 URL 업데이트 |
| `page.tsx:1192, 1207, 1219` | 페이지네이션 버튼 `setCurrentPage` | `router.push`로 URL 업데이트 |

### 3. 유지되는 코드 (영향 없음)

| 위치 | 코드 | 이유 |
|------|------|------|
| `[id]/page.tsx:146, 174` | `customerNavigation` sessionStorage | 이전/다음 고객 네비게이션용 - **별개 기능** |
| `page.tsx:425` | `customerNavigation` 저장 | 상세 페이지 네비게이션용 - **유지** |

### 4. 잠재적 오류/주의점

| 항목 | 설명 | 대응 |
|------|------|------|
| **URL 길이 제한** | 필터가 많으면 URL이 길어짐 | 현재 필터 7개 정도라 문제 없음 |
| **북마크/공유** | URL에 상태가 노출됨 | 오히려 장점 (의도된 동작) |
| **초기 렌더링** | URL 파싱 전 기본값으로 잠깐 렌더링될 수 있음 | `useSearchParams` 사용하면 자동 처리 |
| **뒤로가기 히스토리** | 필터 변경할 때마다 히스토리 쌓임 | `router.replace` 사용하면 해결 |
| **SSR 호환성** | 이미 `'use client'` 사용 중 | 문제 없음 |

---

## 관련 파일

### sessionStorage 사용 현황

```
D:\claude\onsia_crm2\app\dashboard\customers\[id]\page.tsx
  - 146: sessionStorage.getItem('customerNavigation')     // 유지
  - 174: sessionStorage.setItem('customerNavigation')     // 유지

D:\claude\onsia_crm2\app\dashboard\customers\page.tsx
  - 414: sessionStorage.setItem('customerListFilter')     // 삭제
  - 425: sessionStorage.setItem('customerNavigation')     // 유지
  - 432: sessionStorage.getItem('customerListFilter')     // 삭제
  - 451: sessionStorage.removeItem('customerListFilter')  // 삭제
```

### currentPage/setCurrentPage 사용 현황

```
page.tsx:75   - useState(1) 초기화
page.tsx:225  - effectivePage 계산
page.tsx:291  - useCallback 의존성
page.tsx:307  - setCurrentPage(1) - 검색 시
page.tsx:319  - 페이지 오프셋 계산
page.tsx:360  - useEffect 의존성
page.tsx:372  - setCurrentPage(1) - 필터 변경 시
page.tsx:385-390 - 페이지 번호 계산
page.tsx:409  - filterState 저장
page.tsx:418  - pageOffset 계산
page.tsx:442  - 필터 복원
page.tsx:460  - 고객 번호 계산
page.tsx:629  - setCurrentPage(1) - 통화 필터
page.tsx:640  - setCurrentPage(1) - 통화 필터
page.tsx:651  - setCurrentPage(1) - 통화 필터
page.tsx:664  - setCurrentPage(1) - 현장 필터
page.tsx:683  - setCurrentPage(1) - 날짜 필터
page.tsx:693  - setCurrentPage(1) - 날짜 필터
page.tsx:705  - setCurrentPage(1) - 날짜 초기화
page.tsx:1183 - 현재 페이지 표시
page.tsx:1192 - 이전 버튼
page.tsx:1193 - disabled 조건
page.tsx:1205 - 페이지 버튼 variant
page.tsx:1207 - 페이지 버튼 클릭
page.tsx:1219 - 다음 버튼
page.tsx:1220 - disabled 조건
```

---

## 구현 계획

### Phase 1: URL 파라미터 읽기
1. `useSearchParams`에서 모든 필터 값 읽기
2. 기본값 설정 (page=1, callFilter=all 등)

### Phase 2: URL 업데이트 함수 생성
1. `updateUrlParams` 헬퍼 함수 생성
2. `router.replace` 사용 (히스토리 스택 방지)

### Phase 3: 상태 변경 로직 교체
1. `setCurrentPage(1)` → `updateUrlParams({ page: 1 })`
2. 필터 변경 핸들러 수정

### Phase 4: sessionStorage 코드 삭제
1. `customerListFilter` 관련 코드 제거
2. 복원 useEffect 제거

### Phase 5: 테스트
1. 페이지네이션 동작 확인
2. 필터 변경 후 뒤로가기 확인
3. 새로고침 후 상태 유지 확인
4. 상세 페이지 → 목록 복귀 확인

---

## 결론

- **삭제**: sessionStorage 관련 로직 ~40줄
- **변경**: 상태 초기화 + 업데이트 로직 ~20곳
- **오류 가능성**: 낮음 (Next.js 표준 패턴)
- **이점**:
  - 뒤로가기 완벽 지원
  - 코드 단순화
  - 새로고침해도 상태 유지
  - 링크 공유 가능
