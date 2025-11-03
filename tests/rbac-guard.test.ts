import { describe, it, expect } from 'vitest';

/**
 * 사용자 역할 정의
 */
export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  LEADER = 'LEADER',
  HEAD = 'HEAD',
  ADMIN = 'ADMIN',
}

/**
 * 역할 계층 구조 (숫자가 클수록 높은 권한)
 */
const RoleHierarchy: Record<Role, number> = {
  [Role.EMPLOYEE]: 1,
  [Role.LEADER]: 2,
  [Role.HEAD]: 3,
  [Role.ADMIN]: 4,
};

/**
 * RBAC 가드 함수
 * @param userRole 사용자 역할
 * @param requiredRole 필요한 최소 역할
 * @returns 권한이 있으면 true, 없으면 false
 */
export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
}

/**
 * 특정 역할인지 확인
 */
export function isRole(userRole: Role, targetRole: Role): boolean {
  return userRole === targetRole;
}

/**
 * 여러 역할 중 하나인지 확인
 */
export function hasAnyRole(userRole: Role, targetRoles: Role[]): boolean {
  return targetRoles.includes(userRole);
}

describe('RBAC 권한 가드', () => {
  describe('hasPermission - 역할 계층 구조 테스트', () => {
    it('ADMIN은 모든 역할의 권한을 가짐', () => {
      expect(hasPermission(Role.ADMIN, Role.EMPLOYEE)).toBe(true);
      expect(hasPermission(Role.ADMIN, Role.LEADER)).toBe(true);
      expect(hasPermission(Role.ADMIN, Role.HEAD)).toBe(true);
      expect(hasPermission(Role.ADMIN, Role.ADMIN)).toBe(true);
    });

    it('HEAD는 LEADER와 EMPLOYEE 권한을 가짐', () => {
      expect(hasPermission(Role.HEAD, Role.EMPLOYEE)).toBe(true);
      expect(hasPermission(Role.HEAD, Role.LEADER)).toBe(true);
      expect(hasPermission(Role.HEAD, Role.HEAD)).toBe(true);
      expect(hasPermission(Role.HEAD, Role.ADMIN)).toBe(false);
    });

    it('LEADER는 EMPLOYEE 권한을 가짐', () => {
      expect(hasPermission(Role.LEADER, Role.EMPLOYEE)).toBe(true);
      expect(hasPermission(Role.LEADER, Role.LEADER)).toBe(true);
      expect(hasPermission(Role.LEADER, Role.HEAD)).toBe(false);
      expect(hasPermission(Role.LEADER, Role.ADMIN)).toBe(false);
    });

    it('EMPLOYEE는 EMPLOYEE 권한만 가짐', () => {
      expect(hasPermission(Role.EMPLOYEE, Role.EMPLOYEE)).toBe(true);
      expect(hasPermission(Role.EMPLOYEE, Role.LEADER)).toBe(false);
      expect(hasPermission(Role.EMPLOYEE, Role.HEAD)).toBe(false);
      expect(hasPermission(Role.EMPLOYEE, Role.ADMIN)).toBe(false);
    });
  });

  describe('isRole - 특정 역할 확인', () => {
    it('정확히 일치하는 역할만 true 반환', () => {
      expect(isRole(Role.ADMIN, Role.ADMIN)).toBe(true);
      expect(isRole(Role.ADMIN, Role.HEAD)).toBe(false);
    });
  });

  describe('hasAnyRole - 여러 역할 중 하나 확인', () => {
    it('역할 목록에 포함되면 true 반환', () => {
      expect(hasAnyRole(Role.ADMIN, [Role.ADMIN, Role.HEAD])).toBe(true);
      expect(hasAnyRole(Role.HEAD, [Role.ADMIN, Role.HEAD])).toBe(true);
      expect(hasAnyRole(Role.LEADER, [Role.ADMIN, Role.HEAD])).toBe(false);
    });
  });
});
