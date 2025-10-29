import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

// POST /api/admin/users/[id]/reset-password - 비밀번호 0000으로 초기화
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()

    // 관리자 권한 체크
    if (!session?.user || !['ADMIN', 'HEAD'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Admin or Head role required' },
        { status: 403 }
      )
    }

    const userId = params.id

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // ADMIN 계정은 초기화 불가
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Cannot reset admin password' },
        { status: 400 }
      )
    }

    // 비밀번호를 0000으로 초기화
    const hashedPassword = await bcrypt.hash('0000', 10)

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordResetRequired: true, // 비밀번호 변경 필수 플래그
      },
    })

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'RESET_PASSWORD',
      entity: 'User',
      entityId: userId,
      changes: {
        targetUser: user.name,
        targetUsername: user.username,
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      message: `${user.name}님의 비밀번호가 0000으로 초기화되었습니다. 다음 로그인 시 비밀번호 변경이 필요합니다.`,
    })
  } catch (error) {
    console.error('Failed to reset password:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}
