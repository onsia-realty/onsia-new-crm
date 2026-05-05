import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendPushToUser } from '@/lib/push/send';

export const runtime = 'nodejs';

/**
 * POST /api/push/test
 * 현재 로그인한 사용자 본인의 모든 등록 단말로 테스트 푸시 발송.
 * 푸시 인프라 동작 검증용 — 실제 광고콜 알림은 PR #5에서 자동 트리거.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendPushToUser(
      session.user.id,
      {
        title: '🔔 온시아 콜 테스트 알림',
        body: '푸시 알림이 정상 작동합니다. 이 알림을 탭하면 광고콜 화면이 열립니다.',
        url: '/calls',
        tag: 'push-test',
        icon: '/calls-icon-192.png',
      },
      { kind: 'adCalls' }
    );
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('[push/test] failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
