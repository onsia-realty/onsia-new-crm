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
      createdById: session.user.id,
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
