'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, X, Pencil, Save } from 'lucide-react';
import { SITES } from '@/lib/constants/sites';
import { formatPhone } from '@/lib/utils/phone';
import { cn } from '@/lib/utils';

interface Props {
  callId: string;
  phone: string;
  defaultSite: string;
  defaultAdMedia: string | null; // AdCallNumber.source
  onCancel: () => void;
  onSuccess: () => void;
  // readOnly 모드 (CONVERTED된 콜의 채운 양식 다시 보기)
  readOnly?: boolean;
  // CONVERTED 콜의 Customer ID (있으면 PATCH로 수정 가능)
  customerId?: string;
  // readOnly 모드에서 [수정] 버튼 클릭 콜백 (부모가 readOnly 토글)
  onEditClick?: () => void;
  initialValues?: {
    name?: string | null;
    gender?: string | null;
    ageRange?: string | null;
    residenceArea?: string | null;
    memo?: string | null; // 광고매체/상담내용/방문인원/차량번호 파싱
    visitDate?: string | null;
    grade?: string | null;
  };
}

// memo 파싱: "광고매체: X\n상담내용: Y\n방문인원: Z\n차량번호: W" → 각 필드 추출
function parseMemo(memo: string | null | undefined): {
  adMedia: string;
  counselContent: string;
  visitCount: string;
  carNumber: string;
} {
  const result = { adMedia: '', counselContent: '', visitCount: '', carNumber: '' };
  if (!memo) return result;
  for (const line of memo.split('\n')) {
    const m = line.match(/^(광고매체|상담내용|방문인원|차량번호):\s*(.*)$/);
    if (!m) continue;
    if (m[1] === '광고매체') result.adMedia = m[2];
    else if (m[1] === '상담내용') result.counselContent = m[2];
    else if (m[1] === '방문인원') result.visitCount = m[2];
    else if (m[1] === '차량번호') result.carNumber = m[2];
  }
  return result;
}

const GENDER_OPTIONS = [
  { value: 'MALE', label: '남' },
  { value: 'FEMALE', label: '여' },
];

const AGE_OPTIONS = [
  { value: 'TWENTIES', label: '20대' },
  { value: 'THIRTIES', label: '30대' },
  { value: 'FORTIES', label: '40대' },
  { value: 'FIFTIES', label: '50대' },
  { value: 'SIXTIES_PLUS', label: '60대+' },
];

const GRADE_OPTIONS = [
  { value: 'A', label: '상 (A)' },
  { value: 'B', label: '중 (B)' },
  { value: 'C', label: '하 (C)' },
];

export function ConvertCallForm({
  callId,
  phone,
  defaultSite,
  defaultAdMedia,
  onCancel,
  onSuccess,
  readOnly = false,
  customerId,
  onEditClick,
  initialValues,
}: Props) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // initialValues에서 memo 파싱 (readOnly 모드)
  const parsedMemo = parseMemo(initialValues?.memo);
  const initialVisitDate = initialValues?.visitDate
    ? new Date(initialValues.visitDate).toISOString().slice(0, 16)
    : '';

  // 카톡 양식 필드
  const [siteName, setSiteName] = useState<string>(defaultSite || '');
  const [name, setName] = useState<string>(initialValues?.name ?? ''); // 1. 고객성명
  const [gender, setGender] = useState<string>(initialValues?.gender ?? '__none__'); // 3. 성별
  const [ageRange, setAgeRange] = useState<string>(initialValues?.ageRange ?? '__none__'); // 3. 나이대
  const [residenceArea, setResidenceArea] = useState<string>(initialValues?.residenceArea ?? ''); // 4. 거주지역
  const [adMedia, setAdMedia] = useState<string>(parsedMemo.adMedia || defaultAdMedia || ''); // 5. 광고매체
  const [counselContent, setCounselContent] = useState<string>(parsedMemo.counselContent); // 6. 상담내용
  const [visitDate, setVisitDate] = useState<string>(initialVisitDate); // 7+8. 방문일시
  const [visitCount, setVisitCount] = useState<string>(parsedMemo.visitCount); // 9. 방문인원
  const [carNumber, setCarNumber] = useState<string>(parsedMemo.carNumber); // 10. 차량번호
  const [grade, setGrade] = useState<string>(initialValues?.grade ?? 'C'); // 11. 감도

  // 카톡 양식 필드를 memo 텍스트로 합치기 (수정 모드용)
  const buildMemoString = (): string => {
    const lines: string[] = [];
    if (adMedia.trim()) lines.push(`광고매체: ${adMedia.trim()}`);
    if (counselContent.trim()) lines.push(`상담내용: ${counselContent.trim()}`);
    if (visitCount.trim()) lines.push(`방문인원: ${visitCount.trim()}`);
    if (carNumber.trim()) lines.push(`차량번호: ${carNumber.trim()}`);
    return lines.join('\n');
  };

  const handleSubmit = async () => {
    if (!siteName) {
      toast({ title: '입력 확인', description: '현장을 선택해주세요', variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: '입력 확인', description: '고객성명을 입력해주세요', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = !!customerId;
      let res: Response;

      if (isEdit) {
        // 수정: PATCH /api/customers/[id]
        const patchBody = {
          name: name.trim(),
          assignedSite: siteName,
          gender: gender !== '__none__' ? gender : null,
          ageRange: ageRange !== '__none__' ? ageRange : null,
          residenceArea: residenceArea.trim() || null,
          memo: buildMemoString() || null,
          nextVisitDate: visitDate || null,
          grade: grade as 'A' | 'B' | 'C',
        };
        res = await fetch(`/api/customers/${customerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        });
      } else {
        // 신규 등록: POST /api/ad-calls/[callId]/convert-to-customer
        const postBody: Record<string, unknown> = {
          siteName,
          name: name.trim(),
          gender: gender !== '__none__' ? gender : null,
          ageRange: ageRange !== '__none__' ? ageRange : null,
          residenceArea: residenceArea.trim() || null,
          adMedia: adMedia.trim() || null,
          counselContent: counselContent.trim() || null,
          visitDate: visitDate || null,
          visitCount: visitCount.trim() || null,
          carNumber: carNumber.trim() || null,
          grade,
        };
        res = await fetch(`/api/ad-calls/${callId}/convert-to-customer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postBody),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || (isEdit ? '수정 실패' : '등록 실패'));

      toast({
        title: isEdit ? '✅ 수정 완료' : '✅ 내 고객으로 등록 완료',
        description: `${siteName} - ${name} (${formatPhone(phone)})`,
      });
      onSuccess();
    } catch (err) {
      toast({
        title: customerId ? '수정 실패' : '등록 실패',
        description: err instanceof Error ? err.message : '오류',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'mt-3 p-4 border-2 rounded-md space-y-3',
        readOnly
          ? 'bg-green-50 border-green-300'
          : customerId
            ? 'bg-orange-50 border-orange-300'
            : 'bg-blue-50 border-blue-300'
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            'font-semibold text-sm',
            readOnly ? 'text-green-900' : customerId ? 'text-orange-900' : 'text-blue-900'
          )}
        >
          {readOnly
            ? '✅ 등록된 카톡 양식 (보기 전용)'
            : customerId
              ? '✏️ 카톡 양식 수정'
              : '🔷️ 카톡 양식으로 내 고객 DB 등록'}
        </div>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={submitting}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div
        className={cn(
          'text-xs rounded px-2 py-1 bg-white/60',
          readOnly ? 'text-green-800' : 'text-blue-800'
        )}
      >
        전화번호: <span className="font-mono font-medium">{formatPhone(phone)}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 현장 (필수) */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">
            🔷️ 현장 {!readOnly && <span className="text-red-500">*</span>}
          </Label>
          <Select value={siteName} onValueChange={setSiteName} disabled={readOnly}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="현장 선택" />
            </SelectTrigger>
            <SelectContent>
              {SITES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 1. 고객성명 (필수) */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">
            1. 고객성명 {!readOnly && <span className="text-red-500">*</span>}
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 영현"
            className="bg-white"
            disabled={readOnly}
          />
        </div>

        {/* 3. 나이/성별 */}
        <div className="space-y-1">
          <Label className="text-xs">3. 나이대</Label>
          <Select value={ageRange} onValueChange={setAgeRange} disabled={readOnly}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">(선택안함)</SelectItem>
              {AGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">3. 성별</Label>
          <Select value={gender} onValueChange={setGender} disabled={readOnly}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">(선택안함)</SelectItem>
              {GENDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 4. 거주지역 */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">4. 거주지역</Label>
          <Input
            value={residenceArea}
            onChange={(e) => setResidenceArea(e.target.value)}
            placeholder="예: 서울 강남구"
            className="bg-white"
            disabled={readOnly}
          />
        </div>

        {/* 5. 광고매체 */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">5. 광고매체</Label>
          <Input
            value={adMedia}
            onChange={(e) => setAdMedia(e.target.value)}
            placeholder="예: 메타광고"
            className="bg-white"
            disabled={readOnly}
          />
        </div>

        {/* 6. 상담내용 */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">6. 상담내용</Label>
          <Textarea
            value={counselContent}
            onChange={(e) => setCounselContent(e.target.value)}
            placeholder="예: 1차 통화 부재, 명함 보내드린 후 재 통화 예정"
            rows={2}
            className="bg-white"
            disabled={readOnly}
          />
        </div>

        {/* 7+8. 방문일시 (30분 단위) */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">7. 방문일시 (30분 단위)</Label>
          <Input
            type="datetime-local"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="bg-white"
            step={1800}
            disabled={readOnly}
          />
        </div>

        {/* 9. 방문인원 */}
        <div className="space-y-1">
          <Label className="text-xs">9. 방문인원</Label>
          <Input
            value={visitCount}
            onChange={(e) => setVisitCount(e.target.value)}
            placeholder="예: 본인+1"
            className="bg-white"
            disabled={readOnly}
          />
        </div>

        {/* 10. 차량번호 */}
        <div className="space-y-1">
          <Label className="text-xs">10. 차량번호</Label>
          <Input
            value={carNumber}
            onChange={(e) => setCarNumber(e.target.value)}
            placeholder="예: 12가1234"
            className="bg-white"
            disabled={readOnly}
          />
        </div>

        {/* 11. 감도 */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">11. 감도 (상중하)</Label>
          <Select value={grade} onValueChange={setGrade} disabled={readOnly}>
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRADE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {readOnly ? (
          <>
            <Button variant="outline" size="sm" onClick={onCancel}>
              닫기
            </Button>
            {onEditClick && (
              <Button
                size="sm"
                onClick={onEditClick}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Pencil className="h-4 w-4 mr-1" />
                수정
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
              취소
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitting || !siteName || !name.trim()}
              className={cn(
                customerId
                  ? 'bg-orange-600 hover:bg-orange-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : customerId ? (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  저장
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-1" />
                  내 DB 등록
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
