import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkPermission, createAuditLog } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

// 사용자 비활성화 (소프트 삭제) 또는 완전 삭제 (하드 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인 - 사용자 삭제는 ADMIN 이상만 가능
    let canDelete = false;
    try {
      canDelete = await checkPermission('users', 'delete');
    } catch (permError) {
      console.error('Permission check error:', permError);
      // Permission 테이블이 비어있거나 에러가 있을 경우, 역할 기반 체크
      const userRole = session.user.role;
      canDelete = userRole === 'ADMIN' || userRole === 'CEO';
    }

    if (!canDelete) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // 쿼리 파라미터로 완전 삭제(permanent) 여부 확인
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // CEO는 삭제/비활성화 불가 (보호)
    if (targetUser.role === 'CEO') {
      return NextResponse.json(
        { error: 'CEO 계정은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 본인 삭제 불가
    if (targetUser.id === session.user.id) {
      return NextResponse.json(
        { error: '본인 계정은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }

    // 관리자는 활성 상태에서도 완전 삭제 가능

    // 완전 삭제 (하드 삭제) 처리
    if (permanent) {
      const result = await prisma.$transaction(async (tx) => {
        // 1. 관련 데이터 삭제 (외래키 제약 해결)
        // 감사 로그는 유지 (userId를 null로 설정)
        await tx.auditLog.updateMany({
          where: { userId: id },
          data: { userId: null },
        });

        // 고객 배분 기록에서 fromUserId, toUserId, allocatedById null 처리
        await tx.customerAllocation.updateMany({
          where: { fromUserId: id },
          data: { fromUserId: null },
        });
        await tx.customerAllocation.updateMany({
          where: { toUserId: id },
          data: { toUserId: null },
        });
        await tx.customerAllocation.updateMany({
          where: { allocatedById: id },
          data: { allocatedById: null },
        });

        // 공지사항 작성자 null 처리
        await tx.notice.updateMany({
          where: { authorId: id },
          data: { authorId: null },
        });

        // 통화 기록 사용자 null 처리
        await tx.callLog.updateMany({
          where: { userId: id },
          data: { userId: null },
        });

        // 방문 일정 사용자 null 처리
        await tx.visitSchedule.updateMany({
          where: { userId: id },
          data: { userId: null },
        });

        // 고객 담당자 null 처리
        await tx.customer.updateMany({
          where: { assignedUserId: id },
          data: { assignedUserId: null },
        });

        // 업무보고 삭제
        await tx.dailyReport.deleteMany({
          where: { userId: id },
        });

        // 2. 사용자 완전 삭제
        await tx.user.delete({
          where: { id },
        });

        return { userName: targetUser.name, userEmail: targetUser.email };
      });

      // 감사 로그 - 에러가 발생해도 API는 정상 동작하도록
      try {
        await createAuditLog(
          session.user.id,
          'PERMANENT_DELETE_USER',
          'User',
          id,
          {
            userName: result.userName,
            userEmail: result.userEmail,
            userRole: targetUser.role,
          },
          request.headers.get('x-forwarded-for') || undefined,
          request.headers.get('user-agent') || undefined
        );
      } catch (logError) {
        console.error('Failed to create audit log:', logError);
      }

      return NextResponse.json({
        success: true,
        message: `${result.userName} 직원이 완전히 삭제되었습니다.`,
        permanent: true,
      });
    }

    // 소프트 삭제 (비활성화) 처리
    const result = await prisma.$transaction(async (tx) => {
      // 1. 삭제 대상 직원의 고객 수 확인
      const customerCount = await tx.customer.count({
        where: { assignedUserId: id },
      });

      // 2. 고객이 있다면 관리자(현재 세션 사용자)에게 재배분
      if (customerCount > 0) {
        await tx.customer.updateMany({
          where: { assignedUserId: id },
          data: {
            assignedUserId: session.user.id,
            assignedAt: new Date(),
          },
        });

        // 재배분 기록 생성
        const customers = await tx.customer.findMany({
          where: { assignedUserId: session.user.id },
          select: { id: true },
        });

        // 각 고객에 대한 배분 기록 생성
        for (const customer of customers) {
          await tx.customerAllocation.create({
            data: {
              customerId: customer.id,
              fromUserId: id,
              toUserId: session.user.id,
              allocatedById: session.user.id,
              reason: `직원 삭제로 인한 자동 재배분 (${targetUser.name})`,
            },
          });
        }
      }

      // 3. 소프트 삭제 (isActive를 false로 변경)
      const user = await tx.user.update({
        where: { id },
        data: {
          isActive: false,
        },
      });

      return { user, customerCount };
    });

    // 감사 로그 - 에러가 발생해도 API는 정상 동작하도록
    try {
      await createAuditLog(
        session.user.id,
        'DEACTIVATE_USER',
        'User',
        id,
        {
          userName: result.user.name,
          userEmail: result.user.email,
          userRole: result.user.role,
          reassignedCustomers: result.customerCount,
        },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );
    } catch (logError) {
      console.error('Failed to create audit log:', logError);
    }

    return NextResponse.json({
      success: true,
      user: result.user,
      reassignedCustomers: result.customerCount,
      message: result.customerCount > 0
        ? `${result.customerCount}명의 고객이 관리자에게 재배분되었습니다.`
        : '재배분할 고객이 없습니다.',
      permanent: false,
    });
  } catch (error) {
    console.error('Failed to deactivate user:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate user' },
      { status: 500 }
    );
  }
}

// 사용자 정보 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한 확인
    let canUpdate = false;
    try {
      canUpdate = await checkPermission('users', 'update');
    } catch (permError) {
      console.error('Permission check error:', permError);
      // Permission 테이블이 비어있거나 에러가 있을 경우, 역할 기반 체크
      const userRole = session.user.role;
      canUpdate = userRole === 'ADMIN' || userRole === 'CEO' || userRole === 'HEAD';
    }

    if (!canUpdate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // CEO 정보는 CEO만 수정 가능
    if (targetUser.role === 'CEO' && session.user.role !== 'CEO') {
      return NextResponse.json(
        { error: 'CEO 계정 정보는 수정할 수 없습니다.' },
        { status: 403 }
      );
    }

    const data = await request.json();

    // role과 password 변경은 별도 API 사용
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role, password, ...updateData } = data;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    // 감사 로그 - 에러가 발생해도 API는 정상 동작하도록
    try {
      await createAuditLog(
        session.user.id,
        'UPDATE_USER',
        'User',
        id,
        {
          userName: user.name,
          userEmail: user.email,
          changes: updateData,
        },
        request.headers.get('x-forwarded-for') || undefined,
        request.headers.get('user-agent') || undefined
      );
    } catch (logError) {
      console.error('Failed to create audit log:', logError);
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
