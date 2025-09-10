import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signUpSchema } from '@/lib/validations/auth'
import { normalizePhone } from '@/lib/utils/phone'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const validatedFields = signUpSchema.safeParse(body)
    
    if (!validatedFields.success) {
      return NextResponse.json(
        { success: false, errors: validatedFields.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    
    const { username, email, name, phone, password } = validatedFields.data
    const normalizedPhone = normalizePhone(phone)
    
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
          { phone: normalizedPhone }
        ]
      }
    })
    
    if (existingUser) {
      let field = '이메일'
      if (existingUser.username === username) field = '아이디'
      else if (existingUser.email === email) field = '이메일'
      else field = '전화번호'
      return NextResponse.json(
        { success: false, message: `이미 사용 중인 ${field}입니다` },
        { status: 409 }
      )
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        name,
        phone: normalizedPhone,
        password: hashedPassword,
        role: 'PENDING',
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
      }
    })
    
    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })
    
    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.',
      data: user,
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { success: false, message: '회원가입 처리 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}