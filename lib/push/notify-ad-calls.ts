import { prisma } from '@/lib/prisma';
import { maskPhone } from '@/lib/utils/phone';
import { sendPushToUser } from './send';

/**
 * 광고콜 1건이 직원에게 배정되었을 때 푸시 발송.
 * - 페이로드는 마스킹된 전화번호 + 현장명 (잠금화면 노출 시 개인정보 최소화)
 * - 알림 클릭 시 해당 광고콜 상세 페이지(/calls/[id])로 직행
 * - 발송 실패는 로그만 남기고 호출 측에 전파하지 않음 (배정 자체는 성공해야 함)
 */
export async function notifyAdCallAssigned(
  adCallId: string,
  assignedUserId: string
): Promise<void> {
  try {
    const call = await prisma.adCallNumber.findUnique({
      where: { id: adCallId },
      select: { id: true, phone: true, siteName: true },
    });
    if (!call) return;

    const masked = maskPhone(call.phone);
    const site = call.siteName ? `${call.siteName}` : '광고콜';

    await sendPushToUser(
      assignedUserId,
      {
        title: `📞 새 광고콜 — ${site}`,
        body: `${masked} 즉시 응답하세요`,
        url: `/calls/${call.id}`,
        tag: `ad-call:${call.id}`, // 같은 콜 재발송 시 알림 합쳐짐
        icon: '/calls-icon-192.png',
        badge: '/calls-icon-192.png',
      },
      { kind: 'adCalls' }
    );
  } catch (err) {
    console.error('[notifyAdCallAssigned] failed:', err);
  }
}

/**
 * 시상(AdCallAward) 등록 시 받는 직원에게 푸시 발송.
 * - 알림 클릭 → /dashboard/leaderboard?openMyAwards=1&week=<weekKey>
 *   → 리더보드 진입 즉시 본인 시상 상세 모달 자동 오픈
 * - User.notifyAwards 토글 존중 (kind: 'awards')
 * - 발송 실패는 로그만 남기고 호출 측에 전파하지 않음 (시상 등록 자체는 성공해야 함)
 */
export async function notifyAwardCreated(
  awardId: string,
  recipientUserId: string
): Promise<void> {
  try {
    const award = await prisma.adCallAward.findUnique({
      where: { id: awardId },
      select: { id: true, count: true, siteName: true, feedback: true, weekKey: true },
    });
    if (!award) return;

    const sitePart = award.siteName ? ` — ${award.siteName}` : '';
    const feedbackSnippet =
      award.feedback && award.feedback.trim()
        ? award.feedback.trim().slice(0, 80) + (award.feedback.trim().length > 80 ? '…' : '')
        : '리더보드에서 확인하세요';

    await sendPushToUser(
      recipientUserId,
      {
        title: `🏆 새 시상 +${award.count}콜${sitePart}`,
        body: feedbackSnippet,
        url: `/dashboard/leaderboard?openMyAwards=1&week=${encodeURIComponent(award.weekKey)}`,
        tag: `award:${award.id}`,
        icon: '/calls-icon-192.png',
        badge: '/calls-icon-192.png',
      },
      { kind: 'awards' }
    );
  } catch (err) {
    console.error('[notifyAwardCreated] failed:', err);
  }
}

/**
 * 여러 건이 한 직원에게 동시 배정 시 1개의 요약 푸시 발송 (스팸 방지).
 * 1건이면 단건 알림으로 위임.
 */
export async function notifyAdCallsBatchAssigned(
  adCallIds: string[],
  assignedUserId: string
): Promise<void> {
  if (adCallIds.length === 0) return;
  if (adCallIds.length === 1) {
    return notifyAdCallAssigned(adCallIds[0], assignedUserId);
  }

  try {
    await sendPushToUser(
      assignedUserId,
      {
        title: `📞 광고콜 ${adCallIds.length}건 새로 배정`,
        body: `탭하여 새 광고콜을 확인하세요`,
        url: '/calls',
        tag: 'ad-calls:batch',
        icon: '/calls-icon-192.png',
        badge: '/calls-icon-192.png',
      },
      { kind: 'adCalls' }
    );
  } catch (err) {
    console.error('[notifyAdCallsBatchAssigned] failed:', err);
  }
}
