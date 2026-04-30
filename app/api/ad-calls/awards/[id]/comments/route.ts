import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// 권한: 시상의 본인(받는 직원) + ADMIN/HEAD만 코멘트 작성/조회 가능
async function checkAccess(awardId: string, userId: string, role: string) {
  const award = await prisma.adCallAward.findUnique({
    where: { id: awardId },
    select: { userId: true },
  });
  if (!award) return { ok: false, reason: 'not-found' as const };
  const isOwner = award.userId === userId;
  const isAdmin = role === 'ADMIN' || role === 'HEAD';
  if (!isOwner && !isAdmin) return { ok: false, reason: 'forbidden' as const };
  return { ok: true, isOwner, isAdmin };
}

// GET /api/ad-calls/awards/[id]/comments
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const access = await checkAccess(id, session.user.id, session.user.role || '');
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.reason === 'not-found' ? '시상을 찾을 수 없습니다' : '접근 권한 없음' },
        { status: access.reason === 'not-found' ? 404 : 403 }
      );
    }

    const comments = await prisma.adCallAwardComment.findMany({
      where: { awardId: id },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json({
      success: true,
      data: comments.map((c) => ({
        id: c.id,
        content: c.content,
        isStaff: c.isStaff,
        authorId: c.authorId,
        authorName: c.author.name,
        authorRole: c.author.role,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 });
  }
}

const PostSchema = z.object({
  content: z.string().min(1, '내용을 입력해주세요').max(2000, '2000자 이하로 입력해주세요'),
});

// POST /api/ad-calls/awards/[id]/comments
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const access = await checkAccess(id, session.user.id, session.user.role || '');
    if (!access.ok) {
      return NextResponse.json(
        { success: false, error: access.reason === 'not-found' ? '시상을 찾을 수 없습니다' : '접근 권한 없음' },
        { status: access.reason === 'not-found' ? 404 : 403 }
      );
    }

    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? '입력값 오류' },
        { status: 400 }
      );
    }

    const created = await prisma.adCallAwardComment.create({
      data: {
        awardId: id,
        authorId: session.user.id,
        content: parsed.data.content.trim(),
        isStaff: access.isOwner === true && !access.isAdmin, // 본인이고 관리자가 아니면 직원 코멘트
      },
      include: { author: { select: { id: true, name: true, role: true } } },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        content: created.content,
        isStaff: created.isStaff,
        authorId: created.authorId,
        authorName: created.author.name,
        authorRole: created.author.role,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create comment:', error);
    return NextResponse.json({ success: false, error: 'Failed to create comment' }, { status: 500 });
  }
}
