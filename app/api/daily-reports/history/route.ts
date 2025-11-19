import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - 직원 본인의 업무보고 기록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '30')

    const reports = await prisma.dailyReport.findMany({
      where: {
        userId: session.user.id
      },
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error('업무보고 기록 조회 오류:', error)
    return NextResponse.json({ error: '업무보고 기록 조회에 실패했습니다.' }, { status: 500 })
  }
}
