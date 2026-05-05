import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const Schema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().max(500).optional(),
  scope: z.enum(['calls', 'crm']).optional(),
});

/**
 * POST /api/push/subscribe
 * 클라이언트가 발급받은 PushSubscription을 DB에 저장.
 * - endpoint가 unique 키 → 같은 단말 재구독 시 자동 갱신
 * - userId는 항상 현재 세션 사용자로 갱신 (다른 직원이 같은 단말 쓰는 경우 대응)
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.issues[0]?.message },
      { status: 400 }
    );
  }

  const { endpoint, keys, userAgent, scope } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId: session.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
      scope: scope ?? null,
      lastSeenAt: new Date(),
    },
    create: {
      userId: session.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
      scope: scope ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
