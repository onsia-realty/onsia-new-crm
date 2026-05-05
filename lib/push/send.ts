import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { getVapidKeys } from './vapid';

export interface PushPayload {
  /** 알림 제목 (잠금화면에도 노출) */
  title: string;
  /** 알림 본문 */
  body: string;
  /** 알림 클릭 시 열 URL (예: '/calls/abc123') */
  url: string;
  /** 같은 tag의 알림은 새 알림이 기존 알림 위에 합쳐짐 (스팸 방지) */
  tag?: string;
  /** 알림 아이콘 (기본: /calls-icon-192.png) */
  icon?: string;
  /** 작은 단색 배지 (Android) */
  badge?: string;
}

export interface SendResult {
  /** 성공 발송 수 */
  sent: number;
  /** 410/404 응답으로 자동 삭제된 만료 구독 수 */
  cleaned: number;
  /** 그 외 에러로 실패한 수 (재시도 대상 아님) */
  failed: number;
}

let initialized = false;

function ensureInit() {
  if (initialized) return;
  const { publicKey, privateKey, subject } = getVapidKeys();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialized = true;
}

/**
 * 한 사용자의 모든 활성 구독에 푸시 발송.
 * - 사용자가 알림 종류를 OFF로 했으면 발송 스킵
 * - 410/404 응답이면 해당 구독 row 자동 삭제 (브라우저 데이터 삭제, 권한 회수 등)
 * - 한 단말 실패가 다른 단말 발송을 막지 않음 (Promise.allSettled)
 *
 * @param userId 발송 대상 직원 id
 * @param payload 알림 페이로드
 * @param options.kind 알림 종류 — 사용자 토글 체크용
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  options: { kind?: 'adCalls' | 'awards' } = {}
): Promise<SendResult> {
  ensureInit();

  const kind = options.kind ?? 'adCalls';

  // 사용자 토글 + 구독 조회
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      notifyAdCalls: true,
      notifyAwards: true,
      pushSubscriptions: {
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      },
    },
  });

  if (!user || !user.isActive) {
    return { sent: 0, cleaned: 0, failed: 0 };
  }

  // 알림 종류별 토글 체크
  if (kind === 'adCalls' && !user.notifyAdCalls) {
    return { sent: 0, cleaned: 0, failed: 0 };
  }
  if (kind === 'awards' && !user.notifyAwards) {
    return { sent: 0, cleaned: 0, failed: 0 };
  }

  if (user.pushSubscriptions.length === 0) {
    return { sent: 0, cleaned: 0, failed: 0 };
  }

  const body = JSON.stringify(payload);
  const expired: string[] = [];
  const sentIds: string[] = [];
  let failed = 0;

  await Promise.allSettled(
    user.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 3600, urgency: 'high' }
        );
        sentIds.push(sub.id);
      } catch (err) {
        const status =
          (err as { statusCode?: number }).statusCode ??
          (err as { status?: number }).status;
        if (status === 410 || status === 404) {
          expired.push(sub.id);
        } else {
          failed++;
          console.error(
            `[push] send failed for sub ${sub.id} (status ${status}):`,
            err
          );
        }
      }
    })
  );

  // 만료 구독 정리 + 성공 발송 lastSeenAt 갱신
  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { id: { in: expired } },
    });
  }
  if (sentIds.length > 0) {
    await prisma.pushSubscription.updateMany({
      where: { id: { in: sentIds } },
      data: { lastSeenAt: new Date() },
    });
  }

  return { sent: sentIds.length, cleaned: expired.length, failed };
}

/**
 * 여러 사용자에게 동일 페이로드 발송 (병렬, 격리).
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
  options: { kind?: 'adCalls' | 'awards' } = {}
): Promise<SendResult> {
  const results = await Promise.allSettled(
    userIds.map((uid) => sendPushToUser(uid, payload, options))
  );

  const total: SendResult = { sent: 0, cleaned: 0, failed: 0 };
  for (const r of results) {
    if (r.status === 'fulfilled') {
      total.sent += r.value.sent;
      total.cleaned += r.value.cleaned;
      total.failed += r.value.failed;
    } else {
      total.failed++;
    }
  }
  return total;
}
