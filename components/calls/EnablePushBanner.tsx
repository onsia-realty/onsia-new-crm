'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  enablePush,
  disablePush,
  getPushState,
  type PushPermissionState,
} from '@/lib/push/client';

const DISMISS_KEY = 'calls-push-banner-dismissed';
const DISMISS_DAYS = 7;

function isDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const ts = window.localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    const ms = Number(ts);
    return Number.isFinite(ms) && Date.now() - ms < DISMISS_DAYS * 86400_000;
  } catch {
    return false;
  }
}

export function EnablePushBanner() {
  const [state, setState] = useState<PushPermissionState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(isDismissedRecently());
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await enablePush('calls');
      setState(res.state);
      if (res.ok) {
        toast.success('🔔 알림이 켜졌습니다. 광고콜이 도착하면 즉시 알려드릴게요.');
      } else {
        toast.error(res.error ?? '알림을 켜지 못했습니다.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await disablePush();
      const next = await getPushState();
      setState(next);
      if (res.ok) toast.success('알림이 꺼졌습니다.');
      else toast.error(res.error ?? '해지에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const json = await res.json();
      if (res.ok && json.success && json.sent > 0) {
        toast.success(`테스트 알림 발송 완료 (${json.sent}대 단말)`);
      } else if (json.sent === 0) {
        toast.warning('등록된 단말이 없습니다. 먼저 알림을 켜주세요.');
      } else {
        toast.error(json.error ?? '테스트 발송 실패');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '네트워크 오류');
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setDismissed(true);
  };

  if (state === 'loading') return null;

  // 미지원 브라우저: 조용히 숨김 (안내해도 사용자가 할 수 있는 게 없음)
  if (state === 'unsupported') return null;

  // 정상 구독 중: 작은 인디케이터 + 테스트 버튼
  if (state === 'subscribed') {
    return (
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
        <div className="flex items-center gap-2 text-emerald-800">
          <Check className="h-4 w-4 shrink-0" />
          <span>알림 켜짐</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-emerald-800 hover:bg-emerald-100"
            onClick={handleTest}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : '테스트'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-emerald-800 hover:bg-emerald-100"
            onClick={handleDisable}
            disabled={busy}
          >
            끄기
          </Button>
        </div>
      </div>
    );
  }

  // 권한 거부됨: 사용자가 OS/브라우저 설정에서 풀어야 한다는 안내
  if (state === 'denied') {
    if (dismissed) return null;
    return (
      <div className="mb-3 flex items-start justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
        <div className="flex items-start gap-2 text-rose-800">
          <BellOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">알림 권한이 차단되어 있습니다.</p>
            <p className="text-xs text-rose-700 mt-0.5">
              브라우저 주소창 자물쇠 → 알림 → 허용으로 변경해주세요.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="-mr-1 -mt-1 rounded p-1 text-rose-600 hover:bg-rose-100"
          aria-label="닫기"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // 'default' (아직 안 물어봄) 또는 'granted-not-subscribed' (구독 갱신 필요)
  if (dismissed && state === 'default') return null;

  return (
    <div
      className={cn(
        'mb-3 rounded-xl border bg-sky-50 px-3 py-2.5 text-sm shadow-sm',
        'border-sky-200'
      )}
    >
      <div className="flex items-start gap-2.5">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
        <div className="flex-1">
          <p className="font-semibold text-sky-900">광고콜 알림 켜기</p>
          <p className="mt-0.5 text-xs text-sky-800">
            새 광고콜이 배정되면 즉시 알림을 받습니다. 화면이 꺼져있어도 도착해요.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 bg-sky-600 hover:bg-sky-700"
              onClick={handleEnable}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Bell className="mr-1.5 h-3.5 w-3.5" />
              )}
              알림 켜기
            </Button>
            {state === 'default' && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-sky-800 hover:bg-sky-100"
                onClick={handleDismiss}
                disabled={busy}
              >
                나중에
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
