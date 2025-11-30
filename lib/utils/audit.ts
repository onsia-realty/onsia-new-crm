import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
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

interface CreateAuditLogParams {
  userId: string
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
        userId,
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
export function getIpAddress(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return ip
}

/**
 * Request에서 User-Agent 추출
 */
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown'
}