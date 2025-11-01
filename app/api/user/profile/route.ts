import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    // 입력 검증
    if (!name) {
      return NextResponse.json(
        { success: false, message: '이름은 필수입니다.' },
        { status: 400 }
      );
    }

    // 현재 사용자 정보 조회
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, name: true, email: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 사용자 이름만 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    // 감사 로그 기록
    await prisma.auditLog.create({
      data: {
        userId: updatedUser.id,
        action: 'UPDATE_PROFILE',
        entity: 'User',
        entityId: updatedUser.id,
        changes: {
          oldName: currentUser.name,
          newName: name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { success: false, message: '프로필 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
