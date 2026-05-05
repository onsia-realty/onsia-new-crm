'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Phone, Save, UserPlus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MiniHeader } from '@/components/calls/MiniHeader';
import { ConvertCallForm } from '@/components/dashboard/ConvertCallForm';
import { formatPhone } from '@/lib/utils/phone';
import { cn } from '@/lib/utils';
import { SITE_COLORS } from '@/lib/constants/sites';

type Status = 'PENDING' | 'ASSIGNED' | 'CONVERTED' | 'INVALID';

interface AdCall {
  id: string;
  phone: string;
  source?: string | null;
  siteName?: string | null;
  status: Status;
  notes?: string | null;
  invalidReason?: string | null;
  receivedAt: string;
  assignedAt?: string | null;
  convertedToCustomerId?: string | null;
  assignedUser?: { id: string; name: string } | null;
}

const INVALID_REASONS = [
  '결번/없는 번호',
  '본인 번호 아님',
  '관심 없음',
  '중복 광고',
  '기타',
];

export default function CallDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [call, setCall] = useState<AdCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const [showConvertForm, setShowConvertForm] = useState(false);
  const [showInvalidForm, setShowInvalidForm] = useState(false);
  const [invalidReason, setInvalidReason] = useState('');
  const [savingInvalid, setSavingInvalid] = useState(false);

  const fetchCall = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ad-calls/${id}`, { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setCall(json.data);
        setNotes(json.data.notes ?? '');
      } else {
        toast.error(json.error || '광고 콜을 불러오지 못했습니다.');
        router.push('/calls');
      }
    } catch (err) {
      console.error(err);
      toast.error('네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchCall();
  }, [id]);

  const handleSaveNotes = async () => {
    if (!call) return;
    if (!notes.trim()) {
      toast.error('통화 내용을 입력해주세요.');
      return;
    }
    try {
      setSavingNotes(true);
      const res = await fetch(`/api/ad-calls/${call.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '저장 실패');
      toast.success('통화 메모가 저장되었습니다.');
      await fetchCall();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveInvalid = async () => {
    if (!call) return;
    if (!invalidReason) {
      toast.error('사유를 선택해주세요.');
      return;
    }
    try {
      setSavingInvalid(true);
      const res = await fetch(`/api/ad-calls/${call.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'INVALID', invalidReason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '저장 실패');
      toast.success('무효 처리되었습니다.');
      router.push('/calls');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSavingInvalid(false);
    }
  };

  if (loading) {
    return (
      <>
        <MiniHeader showBack />
        <main className="mx-auto w-full max-w-screen-sm px-3 pt-3">
          <div className="h-40 animate-pulse rounded-xl border border-gray-200 bg-white" />
          <div className="mt-3 h-32 animate-pulse rounded-xl border border-gray-200 bg-white" />
        </main>
      </>
    );
  }

  if (!call) return null;

  const formatted = formatPhone(call.phone);
  const isDone = call.status === 'CONVERTED' || call.status === 'INVALID';
  const siteColor = call.siteName ? SITE_COLORS[call.siteName] : null;

  return (
    <>
      <MiniHeader showBack />

      <main className="mx-auto w-full max-w-screen-sm px-3 pb-32 pt-3 space-y-3">
        {/* 헤더 카드: 전화번호 + 즉시 통화 */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            {call.status === 'CONVERTED' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                고객 전환됨
              </span>
            ) : call.status === 'INVALID' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                <AlertCircle className="h-3.5 w-3.5" />
                무효 처리
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                <Phone className="h-3.5 w-3.5" />
                배정됨
              </span>
            )}
            <span className="text-xs text-gray-500">
              {new Date(call.assignedAt || call.receivedAt).toLocaleString('ko-KR')}
            </span>
          </div>

          <div className="mt-3 text-center">
            <a
              href={`tel:${call.phone}`}
              className="block font-mono text-3xl font-bold tracking-tight text-gray-900 active:text-sky-700"
            >
              {formatted}
            </a>
          </div>

          <a
            href={`tel:${call.phone}`}
            className="mt-4 flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 text-base font-semibold text-white shadow-sm active:bg-sky-700"
          >
            <Phone className="h-5 w-5" />
            지금 전화하기
          </a>

          <dl className="mt-4 space-y-2 text-sm">
            {call.siteName && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">현장</dt>
                <dd>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium',
                      siteColor
                        ? `${siteColor.bg} ${siteColor.text} ${siteColor.border}`
                        : 'border-gray-200 bg-gray-50 text-gray-700'
                    )}
                  >
                    {call.siteName}
                  </span>
                </dd>
              </div>
            )}
            {call.source && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">광고 출처</dt>
                <dd className="font-medium text-gray-900">{call.source}</dd>
              </div>
            )}
            {call.invalidReason && (
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">무효 사유</dt>
                <dd className="font-medium text-rose-700">{call.invalidReason}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* 통화 메모 */}
        {!isDone && !showConvertForm && !showInvalidForm && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <Label htmlFor="notes" className="text-sm font-medium">
              통화 메모
            </Label>
            <Textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="통화 내용을 간단히 입력하세요"
              className="mt-2"
            />
            <Button
              type="button"
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="mt-3 w-full"
              variant="outline"
            >
              {savingNotes ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              메모 저장
            </Button>
          </section>
        )}

        {/* 액션 버튼들 */}
        {!isDone && !showConvertForm && !showInvalidForm && (
          <section className="space-y-2">
            <Button
              type="button"
              onClick={() => setShowConvertForm(true)}
              className="h-12 w-full bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
            >
              <UserPlus className="mr-2 h-5 w-5" />
              고객으로 전환
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowInvalidForm(true)}
              className="h-12 w-full text-base text-rose-700"
            >
              <AlertCircle className="mr-2 h-5 w-5" />
              무효 처리
            </Button>
          </section>
        )}

        {/* 무효 처리 폼 */}
        {showInvalidForm && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
            <h3 className="text-sm font-semibold text-rose-900">무효 사유 선택</h3>
            <Select value={invalidReason} onValueChange={setInvalidReason}>
              <SelectTrigger className="mt-2 bg-white">
                <SelectValue placeholder="사유 선택" />
              </SelectTrigger>
              <SelectContent>
                {INVALID_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowInvalidForm(false);
                  setInvalidReason('');
                }}
                disabled={savingInvalid}
              >
                취소
              </Button>
              <Button
                type="button"
                className="flex-1 bg-rose-600 hover:bg-rose-700"
                onClick={handleSaveInvalid}
                disabled={savingInvalid || !invalidReason}
              >
                {savingInvalid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                무효 처리
              </Button>
            </div>
          </section>
        )}

        {/* 고객 전환 폼 (기존 컴포넌트 재사용) */}
        {showConvertForm && !isDone && (
          <ConvertCallForm
            callId={call.id}
            phone={call.phone}
            defaultSite={call.siteName ?? ''}
            defaultAdMedia={call.source ?? null}
            onCancel={() => setShowConvertForm(false)}
            onSuccess={() => {
              toast.success('고객으로 전환되었습니다.');
              router.push('/calls');
            }}
          />
        )}

        {/* 처리 완료된 콜의 안내 */}
        {isDone && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-600 shadow-sm">
            이 광고 콜은 이미 처리되었습니다.
          </section>
        )}
      </main>
    </>
  );
}
