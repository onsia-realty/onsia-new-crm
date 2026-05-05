import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const Schema = z.object({
  endpoint: z.string().url().optional(),
});

/**
 * POST /api/push/unsubscribe
 * - body.endpoint 지정: 그 단말 구독만 삭제
 * - body 비어있음: 현재 사용자의 모든 구독 삭제 (모든 단말 알림 끄기)
 *
 * 안전장치: 본인 row만 지움. 다른 사용자 구독 endpoint를 알아도 못 지움.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // body 없어도 OK (전체 해지)
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload' },
      { status: 400 }
    );
  }

  const { endpoint } = parsed.data;

  const result = await prisma.pushSubscription.deleteMany({
    where: {
      userId: session.user.id,
      ...(endpoint ? { endpoint } : {}),
    },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
