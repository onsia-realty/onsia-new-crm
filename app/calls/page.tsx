'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Phone, RefreshCw, Inbox, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MiniHeader } from '@/components/calls/MiniHeader';
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
  receivedAt: string;
  assignedAt?: string | null;
  assignedUser?: { id: string; name: string } | null;
}

type Filter = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'ALL';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'NEW', label: '새 배정' },
  { key: 'IN_PROGRESS', label: '진행중' },
  { key: 'DONE', label: '처리완료' },
  { key: 'ALL', label: '전체' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

function isUntouched(call: AdCall): boolean {
  // 배정됐고 아직 메모도 없고 미처리 상태
  return call.status === 'ASSIGNED' && !call.notes?.trim();
}

export default function CallsListPage() {
  const { data: session } = useSession();
  const [calls, setCalls] = useState<AdCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('NEW');

  const fetchCalls = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const res = await fetch('/api/ad-calls', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setCalls(json.data ?? []);
      } else {
        toast.error('목록을 불러오지 못했습니다.');
      }
    } catch (err) {
      console.error(err);
      toast.error('네트워크 오류로 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const counts = useMemo(() => {
    let neu = 0;
    let inp = 0;
    let done = 0;
    for (const c of calls) {
      if (c.status === 'CONVERTED' || c.status === 'INVALID') done++;
      else if (isUntouched(c)) neu++;
      else if (c.status === 'ASSIGNED') inp++;
    }
    return { neu, inp, done, all: calls.length };
  }, [calls]);

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (filter === 'ALL') return true;
      if (filter === 'NEW') return isUntouched(c);
      if (filter === 'IN_PROGRESS') return c.status === 'ASSIGNED' && !!c.notes?.trim();
      if (filter === 'DONE') return c.status === 'CONVERTED' || c.status === 'INVALID';
      return true;
    });
  }, [calls, filter]);

  const userName = session?.user?.name || undefined;

  return (
    <>
      <MiniHeader userName={userName} />

      <main className="mx-auto w-full max-w-screen-sm px-3 pb-24 pt-3">
        {/* 필터 칩 */}
        <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {FILTERS.map((f) => {
            const count =
              f.key === 'NEW'
                ? counts.neu
                : f.key === 'IN_PROGRESS'
                  ? counts.inp
                  : f.key === 'DONE'
                    ? counts.done
                    : counts.all;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition',
                  active
                    ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                )}
              >
                {f.label}
                <span
                  className={cn(
                    'ml-1.5 inline-flex min-w-[1.25rem] justify-center rounded-full px-1 text-xs',
                    active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => fetchCalls(true)}
            aria-label="새로고침"
            className={cn(
              'ml-auto shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              refreshing && 'animate-spin'
            )}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* 리스트 */}
        {loading ? (
          <ul className="space-y-2">
            {[1, 2, 3].map((i) => (
              <li
                key={i}
                className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white"
              />
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <ul className="space-y-2">
            {filtered.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const messages: Record<Filter, { icon: React.ReactNode; title: string; sub: string }> = {
    NEW: {
      icon: <Inbox className="h-10 w-10 text-sky-400" />,
      title: '새로 배정된 광고콜이 없어요',
      sub: '관리자가 콜을 배정하면 여기 뜹니다.',
    },
    IN_PROGRESS: {
      icon: <Phone className="h-10 w-10 text-amber-400" />,
      title: '진행 중인 광고콜이 없어요',
      sub: '통화 메모를 남긴 콜이 여기로 옵니다.',
    },
    DONE: {
      icon: <CheckCircle2 className="h-10 w-10 text-emerald-400" />,
      title: '처리 완료된 광고콜이 없어요',
      sub: '고객 전환 또는 무효 처리한 콜이 여기로 옵니다.',
    },
    ALL: {
      icon: <Inbox className="h-10 w-10 text-gray-400" />,
      title: '광고콜이 없어요',
      sub: '관리자가 등록한 광고콜이 표시됩니다.',
    },
  };
  const m = messages[filter];
  return (
    <div className="mt-12 flex flex-col items-center text-center">
      {m.icon}
      <p className="mt-3 font-medium text-gray-800">{m.title}</p>
      <p className="mt-1 text-sm text-gray-500">{m.sub}</p>
    </div>
  );
}

function StatusBadge({ call }: { call: AdCall }) {
  if (call.status === 'CONVERTED') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        고객 전환
      </span>
    );
  }
  if (call.status === 'INVALID') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
        <AlertCircle className="h-3 w-3" />
        무효
      </span>
    );
  }
  if (isUntouched(call)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
        새 배정
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      진행중
    </span>
  );
}

function CallCard({ call }: { call: AdCall }) {
  const siteColor = call.siteName ? SITE_COLORS[call.siteName] : null;
  const fresh = isUntouched(call);

  return (
    <li>
      <Link
        href={`/calls/${call.id}`}
        className={cn(
          'block rounded-xl border bg-white p-3 shadow-sm transition active:scale-[0.99]',
          fresh ? 'border-sky-300 ring-1 ring-sky-100' : 'border-gray-200'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <StatusBadge call={call} />
          <span className="text-xs text-gray-500">
            {timeAgo(call.assignedAt || call.receivedAt)}
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono text-lg font-semibold tracking-tight text-gray-900">
            {formatPhone(call.phone)}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {call.siteName && (
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-1.5 py-0.5 font-medium',
                siteColor
                  ? `${siteColor.bg} ${siteColor.text} ${siteColor.border}`
                  : 'border-gray-200 bg-gray-50 text-gray-700'
              )}
            >
              {call.siteName}
            </span>
          )}
          {call.source && <span className="text-gray-500">{call.source}</span>}
        </div>

        {call.notes && (
          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{call.notes}</p>
        )}
      </Link>
    </li>
  );
}
