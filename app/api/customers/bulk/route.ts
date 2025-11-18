/**
 * 고객 일괄 등록 API
 * POST /api/customers/bulk
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { customers } = body

    if (!Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json(
        { error: '고객 데이터가 없습니다' },
        { status: 400 }
      )
    }

    // 요청에서 source 확인 (OCR인지 아닌지)
    const isOcrSource = customers.some(c => c.source === 'OCR') ||
                        (customers.length > 0 && !customers[0].source); // source가 없으면 기본값이 OCR

    // OCR 일일 등록 제한 확인 (관리자는 제외, OCR 소스만 적용)
    const DAILY_LIMIT = 50;

    if (session.user.role !== 'ADMIN' && isOcrSource) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 오늘 승인 받은 횟수 확인
      const approvalCount = await prisma.dailyLimitApproval.count({
        where: {
          userId: session.user.id,
          date: today,
        },
      });

      // 현재 제한: 기본 50 + (승인 횟수 × 50)
      const currentLimit = DAILY_LIMIT + (approvalCount * DAILY_LIMIT);

      // 오늘 OCR로 등록한 고객 수 (source가 'OCR'인 것만)
      const todayOcrCount = await prisma.customer.count({
        where: {
          assignedUserId: session.user.id,
          source: 'OCR',
          createdAt: {
            gte: today,
          },
        },
      });

      // 이번 요청으로 등록될 건수 포함해서 체크
      if (todayOcrCount + customers.length > currentLimit) {
        const remaining = Math.max(0, currentLimit - todayOcrCount);
        return NextResponse.json(
          {
            success: false,
            error: `OCR 일일 등록 제한을 초과합니다. 오늘 등록 가능: ${remaining}건, 요청: ${customers.length}건`,
            needsApproval: true,
            todayCount: todayOcrCount,
            currentLimit,
            remaining,
          },
          { status: 403 }
        );
      }
    }

    // 중복 체크를 위한 전화번호 목록
    const phoneNumbers = customers
      .map(c => c.phone?.replace(/\D/g, ''))
      .filter(Boolean)

    // 기존 고객 조회
    const existingCustomers = await prisma.customer.findMany({
      where: {
        phone: {
          in: phoneNumbers,
        },
      },
      select: {
        phone: true,
      },
    })

    const existingPhones = new Set(existingCustomers.map(c => c.phone))

    // 새로운 고객만 필터링
    const newCustomers = customers.filter(c => {
      const phone = c.phone?.replace(/\D/g, '')
      return phone && !existingPhones.has(phone)
    })

    if (newCustomers.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skipped: customers.length,
        message: '모든 고객이 이미 등록되어 있습니다',
      })
    }

    // 일괄 등록
    const createData = newCustomers.map(customer => ({
      name: customer.name || '미지정',
      phone: customer.phone.replace(/\D/g, ''),
      residenceArea: customer.residenceArea || null,
      source: customer.source || 'OCR',
      assignedUserId: session.user.id,
      assignedAt: new Date(),
    }))

    const result = await prisma.customer.createMany({
      data: createData,
      skipDuplicates: true,
    })

    // 감사 로그 기록
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BULK_CREATE_CUSTOMERS_OCR',
        entity: 'Customer',
        changes: {
          count: result.count,
          skipped: customers.length - newCustomers.length,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({
      success: true,
      created: result.count,
      skipped: customers.length - newCustomers.length,
      message: `${result.count}건 등록 완료`,
    })
  } catch (error) {
    console.error('Bulk customer creation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '일괄 등록 중 오류가 발생했습니다',
      },
      { status: 500 }
    )
  }
}
