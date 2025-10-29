import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

// POST /api/auth/change-password - 비밀번호 변경
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { currentPassword, newPassword } = await req.json()

    // 유효성 검사
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: '새 비밀번호는 최소 4자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true, name: true },
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 현재 비밀번호 확인
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호가 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    // 새 비밀번호 해시
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // 비밀번호 업데이트 및 플래그 제거
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
        passwordResetRequired: false, // 비밀번호 변경 완료
      },
    })

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: session.user.id,
      changes: { name: user.name },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
    })
  } catch (error) {
    console.error('Failed to change password:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to change password' },
      { status: 500 }
    )
  }
}
