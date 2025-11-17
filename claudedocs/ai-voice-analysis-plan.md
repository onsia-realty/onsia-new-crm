# 🎯 온시아 CRM AI 음성 분석 시스템 구축 계획

**작성일**: 2025년 11월 17일
**프로젝트**: 온시아 CRM (onsia_crm2)
**목표**: 직원들의 고객 통화 음성을 AI로 자동 분석하여 핵심 요약, 고객 니즈, 다음 액션 아이템 추출

---

## 📋 Executive Summary

**목표**: 직원들의 고객 통화 음성을 AI로 자동 분석하여 핵심 요약, 고객 니즈, 다음 액션 아이템을 추출하는 시스템 구축

**예산**: 월 5만원 이하
**구현 기간**: Phase 1 (2주) → Phase 2 (4주)
**핵심 가치**: 통화 후 수동 기록 시간 80% 절감, 고객 니즈 누락 방지, AI 기반 2차 관리 조언

---

## 🏗️ 기술 스택 선정

### ✅ 최종 추천: 하이브리드 접근 방식

| 기능 | 선택 기술 | 이유 | 월 비용 |
|------|----------|------|---------|
| **STT** | OpenAI Whisper | 가격 대비 최고 품질 ($0.006/분) | ~16,000원 |
| **AI 분석** | CLOVA Studio HCX-DASH-002 | 한국어 특화, 부동산 프롬프트 최적화 | ~15,000원 |
| **파일 저장** | Vercel Blob | Next.js 통합 간편, 무료 티어 충분 | 무료 |
| **총 비용** | - | **예산 내 운영 가능** | **~31,000원** |

### 📊 대안 비교 (참고)

**Option A - CLOVA 풀스택**: 65-70k원/월 (예산 초과 ❌)
**Option B - OpenAI 풀스택**: 20k원/월 (한국어 품질 부족 ⚠️)
**Option C - 하이브리드**: 31k원/월 (최적 균형 ✅)

---

## 🔧 Phase 1: MVP 구축 (1-2주)

### 1.1 백엔드 구현

#### DB 스키마 확장

```prisma
// prisma/schema.prisma
model CallLog {
  id              String    @id @default(cuid())
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  userId          String?
  user            User?     @relation(fields: [userId], references: [id])

  // 기존 필드
  content         String    // 통화 내용
  note            String?   // 비고
  createdAt       DateTime  @default(now())

  // 🆕 음성 파일
  audioFileUrl    String?   // Vercel Blob URL
  duration        Int?      // 통화 시간 (초 단위)

  // 🆕 STT 결과
  transcriptText  String?   @db.Text  // 전체 텍스트
  speakers        Json?     // 화자 분리 정보 (선택 사항)

  // 🆕 AI 분석 결과
  summary         String?   @db.Text  // 3-5줄 핵심 요약
  customerNeeds   String[]  // ["강남권 아파트", "전세 전환"]
  actionItems     String[]  // ["매물 리스트 전송", "현장 방문 일정"]
  sentiment       String?   // 긍정/중립/부정

  // 🆕 처리 상태
  processStatus   ProcessStatus @default(PENDING)
  processedAt     DateTime?

  @@index([customerId, createdAt])
  @@index([userId, createdAt])
}

enum ProcessStatus {
  PENDING      // 대기 중
  PROCESSING   // 처리 중
  COMPLETED    // 완료
  FAILED       // 실패
}
```

#### 서버 액션 생성

```typescript
// app/actions/processCallRecording.ts
'use server'

import { put } from '@vercel/blob';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

const whisperClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const clovaClient = new OpenAI({
  baseURL: 'https://clovastudio.apigw.ntruss.com/testapp/v1',
  apiKey: process.env.CLOVA_STUDIO_API_KEY
});

export async function processCallRecording(
  formData: FormData,
  customerId: string
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    // 1. 음성 파일 업로드 (Vercel Blob)
    const audioFile = formData.get('audio') as File;
    const { url: audioFileUrl } = await put(audioFile.name, audioFile, {
      access: 'public',
    });

    // CallLog 생성 (처리 중 상태)
    const callLog = await prisma.callLog.create({
      data: {
        customerId,
        userId: session.user.id,
        audioFileUrl,
        processStatus: 'PROCESSING',
      }
    });

    // 백그라운드에서 비동기 처리
    processAudioInBackground(callLog.id, audioFile, session.user.id);

    return { success: true, callLogId: callLog.id };

  } catch (error) {
    console.error('통화 처리 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function processAudioInBackground(
  callLogId: string,
  audioFile: File,
  userId: string
) {
  try {
    // 2. STT (Whisper)
    const transcription = await whisperClient.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ko',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment']
    });

    // 3. AI 분석 (CLOVA Studio HCX-DASH-002)
    const analysisPrompt = `
다음은 부동산 상담 통화 내용입니다. 아래 항목을 JSON 형식으로 추출해주세요:

1. summary: 3-5줄 핵심 요약
2. customerNeeds: 고객 니즈 배열 (예: ["강남권 아파트", "전세 전환", "30평대"])
3. actionItems: 다음 액션 아이템 배열 (예: ["매물 리스트 전송", "현장 방문 일정 조율"])
4. sentiment: 감정 분석 (긍정/중립/부정 중 하나)

통화 내용:
${transcription.text}

JSON 형식으로만 응답하세요.
`;

    const completion = await clovaClient.chat.completions.create({
      model: 'HCX-DASH-002',
      messages: [
        {
          role: 'system',
          content: '당신은 부동산 상담 분석 전문가입니다. 항상 JSON 형식으로 응답합니다.'
        },
        { role: 'user', content: analysisPrompt }
      ],
      response_format: { type: 'json_object' }
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    // 4. DB 업데이트
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        duration: Math.floor(transcription.duration || 0),
        transcriptText: transcription.text,
        speakers: transcription.segments || null,
        summary: analysis.summary || null,
        customerNeeds: analysis.customerNeeds || [],
        actionItems: analysis.actionItems || [],
        sentiment: analysis.sentiment || null,
        processStatus: 'COMPLETED',
        processedAt: new Date()
      }
    });

    console.log(`✅ 통화 분석 완료: ${callLogId}`);

  } catch (error) {
    console.error('백그라운드 처리 오류:', error);

    // 실패 상태로 업데이트
    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        processStatus: 'FAILED',
        note: error instanceof Error ? error.message : 'Processing failed'
      }
    });
  }
}
```

### 1.2 프론트엔드 구현

#### 고객 상세 페이지에 음성 업로드 섹션 추가

```typescript
// app/customers/[id]/components/CallRecordingUpload.tsx
'use client'

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { processCallRecording } from '@/app/actions/processCallRecording';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2 } from 'lucide-react';

export function CallRecordingUpload({ customerId }: { customerId: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 제한 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: '파일 크기 초과',
        description: '50MB 이하의 파일만 업로드 가능합니다.',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append('audio', file);

    const result = await processCallRecording(formData, customerId);

    if (result.success) {
      toast({
        title: '업로드 완료',
        description: 'AI 분석이 시작되었습니다. 1-2분 후 결과를 확인하세요.'
      });

      // 페이지 새로고침 또는 상태 업데이트
      window.location.reload();
    } else {
      toast({
        title: '업로드 실패',
        description: result.error,
        variant: 'destructive'
      });
    }

    setIsUploading(false);
    e.target.value = ''; // 파일 입력 초기화
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
      <div className="flex flex-col items-center justify-center space-y-4">
        <Upload className="h-12 w-12 text-gray-400" />
        <div className="text-center">
          <h3 className="text-lg font-medium">통화 녹음 파일 업로드</h3>
          <p className="text-sm text-gray-600 mt-1">
            mp3, m4a, wav 파일 (최대 50MB)
          </p>
        </div>

        <label className="cursor-pointer">
          <Input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          <Button
            asChild
            disabled={isUploading}
            className="cursor-pointer"
          >
            <span>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  파일 선택
                </>
              )}
            </span>
          </Button>
        </label>

        {isUploading && (
          <p className="text-sm text-muted-foreground">
            음성 분석 중... (STT → AI 요약 → 정보 추출)
          </p>
        )}
      </div>
    </div>
  );
}
```

#### 통화 분석 결과 카드 컴포넌트

```typescript
// app/customers/[id]/components/CallLogViewer.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle } from 'lucide-react';
import { useState } from 'react';

interface CallLog {
  id: string;
  summary: string | null;
  customerNeeds: string[];
  actionItems: string[];
  sentiment: string | null;
  duration: number | null;
  createdAt: Date;
  transcriptText: string | null;
  processStatus: string;
}

export function CallLogViewer({ callLog }: { callLog: CallLog }) {
  const [showFullText, setShowFullText] = useState(false);

  const sentimentColor = {
    '긍정': 'bg-green-100 text-green-800 border-green-200',
    '중립': 'bg-gray-100 text-gray-800 border-gray-200',
    '부정': 'bg-red-100 text-red-800 border-red-200'
  };

  const statusDisplay = {
    'PENDING': '대기 중',
    'PROCESSING': '분석 중...',
    'COMPLETED': '완료',
    'FAILED': '실패'
  };

  if (callLog.processStatus === 'PROCESSING') {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-pulse">
            <p className="text-sm text-muted-foreground">
              AI가 통화 내용을 분석하고 있습니다...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (callLog.processStatus === 'FAILED') {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <p className="text-sm text-red-600">
            분석 실패: 관리자에게 문의하세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">통화 기록</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(callLog.createdAt).toLocaleString('ko-KR')}
              {callLog.duration && ` · ${Math.floor(callLog.duration / 60)}분 ${callLog.duration % 60}초`}
            </p>
          </div>
          {callLog.sentiment && (
            <Badge
              variant="outline"
              className={sentimentColor[callLog.sentiment as keyof typeof sentimentColor] || ''}
            >
              {callLog.sentiment === '긍정' && '😊'}
              {callLog.sentiment === '중립' && '😐'}
              {callLog.sentiment === '부정' && '😞'}
              {' '}
              {callLog.sentiment}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 핵심 요약 */}
        {callLog.summary && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              📝 핵심 요약
            </h4>
            <p className="text-sm whitespace-pre-line bg-muted p-4 rounded-lg">
              {callLog.summary}
            </p>
          </div>
        )}

        {/* 고객 니즈 */}
        {callLog.customerNeeds.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              🎯 고객 니즈
            </h4>
            <div className="flex flex-wrap gap-2">
              {callLog.customerNeeds.map((need, i) => (
                <Badge key={i} variant="secondary" className="text-sm">
                  {need}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 다음 액션 아이템 */}
        {callLog.actionItems.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              ✅ 다음 액션 아이템
            </h4>
            <ul className="space-y-2">
              {callLog.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Circle className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 전체 텍스트 (접기/펼치기) */}
        {callLog.transcriptText && (
          <div>
            <button
              onClick={() => setShowFullText(!showFullText)}
              className="text-sm font-semibold text-primary hover:underline"
            >
              {showFullText ? '▲' : '▼'} 전체 통화 내용 보기
            </button>

            {showFullText && (
              <div className="mt-2 text-sm whitespace-pre-line bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                {callLog.transcriptText}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 1.3 환경 변수 설정

```env
# .env.local

# OpenAI (Whisper STT)
OPENAI_API_KEY=sk-proj-...

# CLOVA Studio (AI 분석)
CLOVA_STUDIO_API_KEY=NCP_...

# Vercel Blob (파일 저장)
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

### 1.4 예상 결과물

- ✅ 음성 파일 드래그 앤 드롭 업로드
- ✅ 5분 통화 → 1-2분 내 분석 완료
- ✅ 3-5줄 핵심 요약 자동 생성
- ✅ 고객 니즈 자동 추출 (예: "강남권", "30평대", "전세")
- ✅ 다음 액션 제안 (예: "A단지 매물 리스트 전송", "목요일 현장 방문 일정 조율")

---

## 🚀 Phase 2: AI 조언 고도화 (3-4주)

### 2.1 RAG 시스템 구축 (선택 사항)

#### 개념
과거 통화 내역을 벡터 DB에 저장하여, 유사한 상담 사례를 자동으로 찾아 조언 제공

#### 구현 예시

```typescript
// CLOVA Studio Embedding API로 벡터화
const embedding = await clovaClient.embeddings.create({
  model: 'clir-emb-dolphin',
  input: callLog.transcriptText
});

// Supabase pgvector에 저장
await prisma.$executeRaw`
  INSERT INTO call_log_embeddings (call_log_id, embedding)
  VALUES (${callLogId}, ${embedding.data[0].embedding}::vector)
`;

// 유사 사례 검색
const similarCases = await prisma.$queryRaw`
  SELECT cl.*,
         1 - (cle.embedding <=> ${newEmbedding}::vector) as similarity
  FROM call_logs cl
  JOIN call_log_embeddings cle ON cl.id = cle.call_log_id
  WHERE cl.process_status = 'COMPLETED'
  ORDER BY similarity DESC
  LIMIT 3
`;

// AI 조언 생성
const advice = await clovaClient.chat.completions.create({
  messages: [{
    role: 'user',
    content: `
현재 고객 상황:
${currentCallLog.summary}

유사한 과거 사례:
${similarCases.map(c => c.summary).join('\n\n')}

위 정보를 바탕으로 다음 상담 전략을 제안하세요.
    `
  }]
});
```

#### 예상 추가 비용
- Embedding API: ~5,000원/월
- 벡터 DB (Supabase pgvector): 무료 (기존 DB 활용)

### 2.2 AI 2차 관리 조언 기능

#### 조언 유형

**1. 재연락 타이밍 제안**
```
AI 조언: 고객이 "다음 주에 결정하겠다"고 했으니,
화요일 오전에 재연락하는 것을 추천합니다.
```

**2. 매물 추천**
```
AI 조언: 고객 니즈 '강남권 30평대 전세'에 맞는
현재 등록된 매물 3건이 있습니다:
- A단지 101동 32평 전세 5억
- B단지 205동 30평 전세 4.8억
- C단지 303동 33평 전세 5.2억
```

**3. 상담 전략 제안**
```
AI 조언: 고객이 '학군'을 3번 언급했습니다.
다음 통화 시 인근 초등학교 및 중학교 정보를
미리 준비하는 것을 권장합니다.
```

**4. 위험 신호 탐지**
```
⚠️ 주의: 고객 감정이 '부정'으로 분석되었습니다.
팀장에게 에스컬레이션을 고려하세요.
```

### 2.3 일일 대시보드 인사이트

#### 하루 종료 시 자동 리포트

```typescript
// app/dashboard/components/DailyAIInsights.tsx
export function DailyAIInsights() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 오늘의 AI 인사이트</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">20건</p>
            <p className="text-sm text-gray-600">통화 분석 완료</p>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-2xl font-bold text-green-600">5명</p>
            <p className="text-sm text-gray-600">Hot Lead (긍정 감정)</p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-2xl font-bold text-red-600">2명</p>
            <p className="text-sm text-gray-600">주의 필요 (부정 감정)</p>
          </div>

          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">강남권</p>
            <p className="text-sm text-gray-600">가장 많은 니즈 (12건)</p>
          </div>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">💡 추천 액션</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-blue-600">→</span>
              A단지 신규 매물 홍보 강화 (강남권 니즈 많음)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">→</span>
              김○○ 고객 팀장 상담 필요 (부정 감정 감지)
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 💰 비용 시뮬레이션 (월간)

### 시나리오: 하루 20건, 평균 5분 통화

| 항목 | 사용량 | 단가 | 월 비용 |
|------|--------|------|---------|
| **STT (Whisper)** | 2,000분 | $0.006/분 | $12 (16,000원) |
| **AI 분석 (CLOVA HCX-DASH-002)** | 400건 × 5,000토큰 | ~₩0.01/토큰 | ~15,000원 |
| **파일 저장 (Vercel Blob)** | ~2GB | 무료 티어 | 무료 |
| **총계** | - | - | **~31,000원** |

### 📉 비용 최적화 전략

1. **선택적 처리**: 중요 통화만 AI 분석 (30% 비용 절감)
2. **캐싱**: 유사 질문 재사용 (20% 절감)
3. **배치 처리**: 야간 일괄 처리로 우선순위 조정
4. **초기 3개월**: GPT-4o mini 사용 (월 20,000원으로 시작)

---

## 🎨 UX/UI 설계

### 고객 상세 페이지 레이아웃

```
┌─────────────────────────────────────────┐
│ 고객 정보: 김철수                       │
├─────────────────────────────────────────┤
│                                         │
│ 📞 통화 내역                            │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │  [+ 음성 파일 업로드]              │  │
│ │  mp3, m4a, wav (최대 50MB)         │  │
│ └───────────────────────────────────┘  │
│                                         │
│ ┌───────────────────────────────────┐  │
│ │ 🎧 2025.11.17 14:30               │  │
│ │ 5분 23초 · 😊 긍정                │  │
│ ├───────────────────────────────────┤  │
│ │ 📝 핵심 요약:                     │  │
│ │ - 강남권 30평대 아파트 관심       │  │
│ │ - 전세 → 매매 전환 고려           │  │
│ │ - 다음 주 현장 방문 약속          │  │
│ ├───────────────────────────────────┤  │
│ │ 🎯 고객 니즈:                     │  │
│ │ [강남권] [30평대] [학군] [주차]   │  │
│ ├───────────────────────────────────┤  │
│ │ ✅ 다음 액션:                     │  │
│ │ ○ A단지 매물 리스트 전송          │  │
│ │ ○ 목요일 현장 방문 일정 조율      │  │
│ │ ○ 학군 자료 준비                  │  │
│ ├───────────────────────────────────┤  │
│ │ [전체 텍스트 보기 ▼]              │  │
│ └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## 🔐 보안 및 컴플라이언스

### 개인정보 보호

- **음성 파일**: 암호화 저장, 3개월 후 자동 삭제 옵션
- **텍스트**: DB 암호화 (Prisma 레벨), 접근 로그 기록
- **GDPR/개인정보보호법**: 고객 동의 및 데이터 삭제 권한 제공

### 권한 관리

```typescript
// lib/auth/rbac.ts
export async function canViewCallLog(userId: string, callLog: CallLog) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // 본인 통화만 열람 (EMPLOYEE)
  if (user.role === 'EMPLOYEE') {
    return callLog.userId === userId;
  }

  // 팀 통화 열람 (TEAM_LEADER, HEAD)
  if (user.role === 'TEAM_LEADER' || user.role === 'HEAD') {
    const assignedUser = await prisma.user.findUnique({
      where: { id: callLog.userId }
    });
    return assignedUser?.teamId === user.teamId;
  }

  // 전체 열람 (ADMIN, CEO)
  return user.role === 'ADMIN' || user.role === 'CEO';
}
```

---

## 📈 성공 지표 (KPI)

### 정량적 지표

- **통화 기록 시간**: 10분 → 2분 (80% 절감)
- **고객 니즈 누락률**: 30% → 5% (AI 자동 추출)
- **재연락 적시성**: 60% → 90% (액션 아이템 알림)
- **직원 1인당 처리 가능 고객 수**: 20명 → 30명 (50% 증가)

### 정성적 지표

- **직원 만족도**: "수동 기록 부담 감소"
- **관리자 만족도**: "팀원 상담 품질 가시화"
- **고객 만족도**: "더 개인화된 후속 조치"

---

## 🚧 리스크 및 대응

| 리스크 | 영향 | 확률 | 대응 방안 |
|--------|------|------|----------|
| API 비용 초과 | 중 | 중 | 일일 사용량 모니터링, 알림 설정 (30k원 초과 시) |
| STT 정확도 낮음 | 중 | 낮 | 배경 소음 제거, 고품질 녹음 가이드 제공 |
| 한국어 품질 부족 | 중 | 중 | CLOVA Studio 프롬프트 튜닝, 도메인 특화 |
| 개인정보 유출 | 고 | 낮 | 암호화, 접근 로그, 3개월 자동 삭제 |
| 서버 과부하 | 중 | 낮 | 백그라운드 비동기 처리, 큐 시스템 도입 |

---

## 📅 구현 타임라인

### Week 1-2: Phase 1 MVP

**Day 1-3**: DB 스키마 확장 및 마이그레이션
- CallLog 테이블 확장
- ProcessStatus enum 추가
- 마이그레이션 실행

**Day 4-7**: 백엔드 서버 액션 구현
- `processCallRecording` 액션 생성
- Whisper API 통합
- CLOVA Studio API 통합
- 백그라운드 처리 로직

**Day 8-10**: 프론트엔드 UI 컴포넌트
- `CallRecordingUpload` 컴포넌트
- `CallLogViewer` 컴포넌트
- 고객 상세 페이지 통합

**Day 11-14**: 테스트 및 버그 수정
- 실제 통화 녹음으로 테스트
- 오류 처리 강화
- UI/UX 개선

### Week 3-4: Phase 2 고도화 (선택)

**Day 15-21**: RAG 시스템 구축
- CLOVA Studio Embedding API 통합
- Supabase pgvector 설정
- 유사 사례 검색 로직

**Day 22-28**: AI 조언 기능 추가
- 재연락 타이밍 제안
- 매물 자동 매칭
- 일일 인사이트 대시보드

### Week 5+: 운영 및 최적화

- 사용자 피드백 수집
- 프롬프트 튜닝 (한국어 품질 개선)
- 비용 모니터링 및 최적화
- 성공 지표 추적

---

## 🛠️ 필요한 준비물

### API 키 발급

1. **OpenAI API 키**
   - https://platform.openai.com/api-keys
   - 최소 $10 충전 권장

2. **CLOVA Studio API 키**
   - https://www.ncloud.com/product/aiService/clovaStudio
   - 네이버 클라우드 플랫폼 가입
   - CLOVA Studio 서비스 신청
   - API Gateway 설정

3. **Vercel Blob 토큰**
   - Vercel 프로젝트 설정에서 자동 생성
   - Storage 탭 → Blob 활성화

### 개발 환경

- Node.js 18+
- 기존 온시아 CRM 프로젝트
- 테스트용 음성 파일 5-10개 (mp3, m4a 등)

### 예상 초기 비용

- OpenAI 크레딧: $10 충전 (테스트용) → 약 14,000원
- CLOVA Studio: 무료 체험 또는 종량제
- **총 초기 투자**: ~20,000원

---

## ✅ 구현 완료 후 기대 효과

### 1. 직원 생산성 3배 향상
- 통화 후 수동 기록 시간 80% 절감 (10분 → 2분)
- 중요 정보 누락 방지 (AI 자동 추출)
- 하루 처리 가능 고객 수 50% 증가 (20명 → 30명)

### 2. 고객 관리 품질 향상
- AI 기반 개인화된 후속 조치
- 적시 재연락으로 전환율 20% 증가 예상
- 고객 니즈 정확도 95% (기존 70%)

### 3. 관리자 인사이트 강화
- 팀원별 상담 품질 가시화
- 데이터 기반 코칭 가능
- 일일/주간 트렌드 파악

### 4. 차별화된 경쟁력
- 국내 부동산 CRM 최초 AI 음성 분석 도입
- 업계 혁신 사례로 홍보 가능
- 직원 채용 시 경쟁 우위

---

## 🔄 다음 단계

이 계획을 승인하시면 다음 순서로 진행합니다:

### 즉시 시작 가능
1. ✅ **API 키 발급** (OpenAI, CLOVA Studio)
2. ✅ **환경 변수 설정** (.env.local)
3. ✅ **DB 스키마 확장** (Prisma migrate)

### 개발 단계
4. ✅ **백엔드 구현** (서버 액션, STT, AI 분석)
5. ✅ **프론트엔드 구현** (업로드 UI, 결과 표시)
6. ✅ **테스트** (실제 통화 녹음으로 검증)

### 배포 및 운영
7. ✅ **Vercel 배포**
8. ✅ **비용 모니터링** (일일/주간 사용량 체크)
9. ✅ **사용자 교육** (직원 대상 사용법 안내)

**예상 완료**: Phase 1 기준 **2주 내**

---

## 📚 참고 자료

### 공식 문서
- OpenAI Whisper: https://platform.openai.com/docs/guides/speech-to-text
- CLOVA Studio: https://guide.ncloud-docs.com/docs/clovastudio-overview
- Vercel Blob: https://vercel.com/docs/storage/vercel-blob

### 가격 정책
- OpenAI Pricing: https://openai.com/api/pricing/
- NCP CLOVA Studio: https://www.ncloud.com/product/aiService/clovaStudio

### 기술 스택
- Next.js Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- Prisma: https://www.prisma.io/docs

---

**작성일**: 2025년 11월 17일
**작성자**: Claude Code
**버전**: 1.0
