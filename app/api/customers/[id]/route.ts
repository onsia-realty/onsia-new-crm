import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateCustomerSchema } from '@/lib/validations/customer'
import { normalizePhone } from '@/lib/utils/phone'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

// GET /api/customers/[id] - 고객 상세 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        interestCards: {
          orderBy: { createdAt: 'desc' },
        },
        callLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
        visitSchedules: {
          orderBy: { visitDate: 'desc' },
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    // 권한 체크
    if (
      session.user.role === 'EMPLOYEE' &&
      customer.assignedUserId !== session.user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 중복 전화번호 체크
    const duplicateCount = await prisma.customer.count({
      where: {
        phone: customer.phone,
        isDeleted: false
      }
    })

    const customerWithDuplicateFlag = {
      ...customer,
      isDuplicate: duplicateCount > 1
    }

    return NextResponse.json({
      success: true,
      data: customerWithDuplicateFlag,
    })
  } catch (error) {
    console.error('Failed to fetch customer:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

// PATCH /api/customers/[id] - 고객 수정
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validatedData = updateCustomerSchema.parse(body)

    // 권한 체크
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    })

    if (!existingCustomer) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      )
    }

    if (
      session.user.role === 'EMPLOYEE' &&
      existingCustomer.assignedUserId !== session.user.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 전화번호 변경 시 중복 체크
    if (validatedData.phone) {
      const normalizedPhone = normalizePhone(validatedData.phone)
      const duplicateCustomer = await prisma.customer.findFirst({
        where: {
          phone: normalizedPhone,
          NOT: { id },
        },
      })

      if (duplicateCustomer) {
        return NextResponse.json(
          { success: false, error: '이미 사용 중인 전화번호입니다' },
          { status: 409 }
        )
      }

      validatedData.phone = normalizedPhone
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...validatedData,
        ...(validatedData.assignedUserId && {
          assignedAt: new Date(),
        }),
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'Customer',
      entityId: customer.id,
      changes: validatedData,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      data: customer,
    })
  } catch (error) {
    console.error('Failed to update customer:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

// DELETE /api/customers/[id] - 고객 삭제
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 관리자만 삭제 가능
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    await prisma.customer.delete({
      where: { id },
    })

    // 감사 로그
    await createAuditLog({
      userId: session.user.id,
      action: 'DELETE',
      entity: 'Customer',
      entityId: id,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({
      success: true,
      message: '고객이 삭제되었습니다',
    })
  } catch (error) {
    console.error('Failed to delete customer:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}