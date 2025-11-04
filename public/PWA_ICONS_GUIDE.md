# PWA 아이콘 제작 가이드

## 필요한 아이콘 파일

다음 아이콘 파일들을 제작하여 `/public` 디렉토리에 배치해야 합니다:

### 1. 기본 아이콘 (Android/Chrome)
- `icon-192x192.png` - 192x192px PNG 파일
- `icon-512x512.png` - 512x512px PNG 파일

### 2. Maskable 아이콘 (Android adaptive icon)
- `icon-192x192-maskable.png` - 192x192px PNG 파일 (중앙 정렬, 여백 20%)
- `icon-512x512-maskable.png` - 512x512px PNG 파일 (중앙 정렬, 여백 20%)

### 3. Apple Touch Icon (iOS)
- `apple-touch-icon.png` - 180x180px PNG 파일

### 4. Favicon
- `favicon.ico` - 48x48px ICO 파일

## 디자인 가이드라인

### 색상
- **주 색상**: #2563eb (파란색 - Tailwind blue-600)
- **배경**: #ffffff (흰색)
- **텍스트**: #1e293b (어두운 회색)

### 로고 디자인 제안
```
┌─────────────────┐
│                 │
│      온시아      │
│      CRM       │
│                 │
└─────────────────┘
```

또는 회사 로고가 있다면 해당 로고를 사용하세요.

### Maskable Icon 주의사항
- **안전 영역**: 중앙 80% 영역에만 중요한 콘텐츠 배치
- **여백**: 상하좌우 20% 여백 확보
- **배경**: 반드시 배경색 포함 (투명 배경 불가)

## 임시 아이콘 생성 방법

아이콘이 준비되지 않은 경우, 온라인 도구를 사용하여 임시로 생성할 수 있습니다:

1. **Favicon.io** (https://favicon.io/favicon-generator/)
   - 텍스트로 간단한 아이콘 생성 가능
   - "온시아" 또는 "O" 텍스트 사용

2. **PWA Asset Generator** (https://www.pwabuilder.com/imageGenerator)
   - 하나의 이미지로 모든 PWA 아이콘 자동 생성
   - Maskable 아이콘도 자동 생성

3. **Canva** (https://www.canva.com/)
   - 전문적인 로고 디자인 가능
   - 템플릿 사용 가능

## 현재 상태

⚠️ **아이콘 파일이 아직 생성되지 않았습니다.**

PWA가 정상 작동하려면 위 파일들을 생성하여 `/public` 디렉토리에 배치해야 합니다.

임시로 테스트하려면 Favicon.io나 PWA Asset Generator를 사용하여 빠르게 생성할 수 있습니다.

## 검증 방법

아이콘이 올바르게 설정되었는지 확인:

1. **로컬 테스트**:
   ```bash
   pnpm dev
   ```
   - Chrome DevTools → Application → Manifest 확인

2. **프로덕션 테스트**:
   - Vercel 배포 후 실제 기기에서 "홈 화면에 추가" 시도

3. **Lighthouse PWA 점수**:
   - Chrome DevTools → Lighthouse → PWA 카테고리 실행
   - 목표: 90점 이상
