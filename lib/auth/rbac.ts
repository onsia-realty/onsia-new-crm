import { Role, Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export type Resource = 'users' | 'customers' | 'settings' | 'reports';
export type Action = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'allocate' | 'export';

// 역할 계층 구조
const roleHierarchy: Record<Role, number> = {
  PENDING: 0,
  EMPLOYEE: 1,
  TEAM_LEADER: 2,
  HEAD: 3,
  ADMIN: 4,
};

// 권한 확인 함수
export async function hasPermission(
  userRole: Role,
  resource: Resource,
  action: Action
): Promise<boolean> {
  // PENDING 사용자는 모든 권한 거부
  if (userRole === 'PENDING') {
    return false;
  }

  // 데이터베이스에서 권한 확인
  const permission = await prisma.permission.findUnique({
    where: {
      role_resource_action: {
        role: userRole,
        resource,
        action,
      },
    },
  });

  return permission?.isAllowed ?? false;
}

// 현재 사용자의 권한 확인
export async function checkPermission(
  resource: Resource,
  action: Action
): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.role) {
    return false;
  }

  return hasPermission(session.user.role as Role, resource, action);
}

// 권한 요구 (페이지 보호용)
export async function requirePermission(
  resource: Resource,
  action: Action,
  redirectTo: string = '/unauthorized'
) {
  const hasAccess = await checkPermission(resource, action);
  if (!hasAccess) {
    redirect(redirectTo);
  }
}

// 역할 기반 접근 제어
export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// 고객 데이터 접근 규칙
export async function canViewCustomer(
  userId: string,
  customerId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customers: {
        where: { id: customerId },
      },
    },
  });

  if (!user) return false;

  // ADMIN과 HEAD는 모든 고객 조회 가능
  if (user.role === 'ADMIN' || user.role === 'HEAD') {
    return true;
  }

  // TEAM_LEADER는 자신의 팀 고객만 조회 가능
  if (user.role === 'TEAM_LEADER') {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        assignedUser: true,
      },
    });

    return customer?.assignedUser?.teamId === user.teamId;
  }

  // EMPLOYEE는 자신에게 할당된 고객만 조회 가능
  return user.customers.length > 0;
}

// 사용자 목록 조회 범위 필터
export async function getUserViewScope(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  switch (user.role) {
    case 'ADMIN':
      // 모든 사용자 조회 가능
      return {};
    
    case 'HEAD':
      // 자신의 부서 사용자만 조회 가능
      return { department: user.department };
    
    case 'TEAM_LEADER':
      // 자신의 팀 사용자만 조회 가능
      return { teamId: user.teamId };
    
    default:
      // EMPLOYEE는 자신만 조회 가능
      return { id: userId };
  }
}

// 고객 목록 조회 범위 필터
export async function getCustomerViewScope(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) return null;

  switch (user.role) {
    case 'ADMIN':
    case 'HEAD':
      // 모든 고객 조회 가능
      return {};
    
    case 'TEAM_LEADER':
      // 팀 소속 직원들의 고객 조회 가능
      const teamMembers = await prisma.user.findMany({
        where: { teamId: user.teamId },
        select: { id: true },
      });
      return {
        assignedUserId: {
          in: teamMembers.map(m => m.id),
        },
      };
    
    default:
      // EMPLOYEE는 자신의 고객만 조회 가능
      return { assignedUserId: userId };
  }
}

// 감사 로그 생성
export async function createAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  changes?: Prisma.InputJsonValue,
  ipAddress?: string,
  userAgent?: string
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      changes: changes || undefined,
      ipAddress,
      userAgent,
    },
  });
}