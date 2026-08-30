import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'APPROVE_USER'
  | 'REJECT_USER'
  | 'RESET_PASSWORD'
  | 'CHANGE_PASSWORD'
  | 'UPDATE_VISIT_SCHEDULE'
  | 'DELETE_VISIT_SCHEDULE'
  | 'APPROVE_DAILY_LIMIT'
  | 'DEACTIVATE'
  | 'REACTIVATE'
  | 'MARK_PUBLIC'
  | 'MARK_DISCONNECTED'
  | 'MARK_MATERIAL_SENT'
  | 'UNMARK_MATERIAL_SENT'
  | 'CLAIM_PUBLIC'
  | 'BULK_DELETE'
  | 'SOFT_DELETE'
  | 'MARK_BLIND'
  | 'CLAIM_BLIND'
  | 'RECLAIM_BLIND'
  | 'OPEN_BLIND_DB'

interface CreateAuditLogParams {
  // AuditLog.userId는 스키마상 nullable — 로그인 실패처럼 사용자를 특정할 수 없는 경우 생략 가능
  userId?: string | null
  action: AuditAction
  entity: string
  entityId?: string
  changes?: Prisma.InputJsonValue
  ipAddress?: string
  userAgent?: string
}

/**
 * 감사 로그 생성
 */
export async function createAuditLog({
  userId,
  action,
  entity,
  entityId,
  changes,
  ipAddress,
  userAgent,
}: CreateAuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId,
        changes: changes || undefined,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Request에서 IP 주소 추출
 */
export function getIpAddress(request?: Request): string {
  const forwarded = request?.headers?.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return ip
}

/**
 * Request에서 User-Agent 추출
 */
export function getUserAgent(request?: Request): string {
  return request?.headers?.get('user-agent') || 'unknown'
}