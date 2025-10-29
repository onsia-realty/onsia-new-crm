import type { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signInSchema } from '@/lib/validations/auth'
import { Role } from '@prisma/client'

export default {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const validatedFields = signInSchema.safeParse(credentials)

        if (!validatedFields.success) {
          return null
        }

        const { username, password } = validatedFields.data

        const user = await prisma.user.findUnique({
          where: { username },
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            password: true,
            role: true,
            isActive: true,
            approvedAt: true,
            passwordResetRequired: true,
          }
        })

        if (!user || !user.password) {
          return null
        }

        // Check if user is approved (not PENDING role and has approvedAt)
        if (user.role === 'PENDING' || !user.approvedAt) {
          return null
        }

        if (!user.isActive) {
          return null
        }

        const passwordMatch = await bcrypt.compare(password, user.password)

        if (!passwordMatch) {
          return null
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          passwordResetRequired: user.passwordResetRequired,
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isOnAdmin = nextUrl.pathname.startsWith('/admin')
      const isOnAuth = nextUrl.pathname.startsWith('/auth')

      console.log('Authorized callback:', { isLoggedIn, pathname: nextUrl.pathname, user: auth?.user }) // 디버그용

      if (isOnDashboard || isOnAdmin) {
        if (isLoggedIn) {
          // CEO와 ADMIN만 관리자 페이지 접근 가능
          if (isOnAdmin && auth.user.role !== 'ADMIN' && auth.user.role !== 'CEO') {
            return Response.redirect(new URL('/dashboard', nextUrl))
          }
          return true
        }
        return false
      } else if (isLoggedIn && isOnAuth) {
        return Response.redirect(new URL('/dashboard', nextUrl))
      }

      return true
    },
    async jwt({ token, user, trigger, session }) {
      console.log('[JWT Callback] trigger:', trigger, 'user:', !!user, 'session:', !!session, 'token.id:', token.id)

      // 초기 로그인 시
      if (user) {
        const userData = user as { id: string; username?: string; role: Role; name?: string | null; email?: string | null; passwordResetRequired?: boolean };
        token.id = userData.id
        token.username = userData.username
        token.role = userData.role
        token.name = userData.name
        token.email = userData.email
        token.passwordResetRequired = userData.passwordResetRequired
        console.log('[JWT Callback] User logged in, name:', userData.name)
      }

      // update 트리거가 발생했을 때 - session 객체에서 업데이트된 값을 받음
      if (trigger === 'update' && session) {
        console.log('[JWT Callback] Update trigger with session data:', session)

        // session 객체에서 전달된 name이 있으면 업데이트
        if (session.name) {
          token.name = session.name
          console.log('[JWT Callback] Updated name from session:', session.name)
        }
      }

      // update 트리거가 발생했지만 session이 없을 때 - DB에서 최신 정보 가져오기
      if (trigger === 'update' && !session && token.id) {
        console.log('[JWT Callback] Update trigger without session, fetching from DB...')
        const updatedUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            username: true,
            name: true,
            email: true,
            role: true,
            passwordResetRequired: true,
          },
        })

        if (updatedUser) {
          console.log('[JWT Callback] Updated user name from DB:', updatedUser.name)
          token.username = updatedUser.username
          token.name = updatedUser.name
          token.email = updatedUser.email
          token.role = updatedUser.role
          token.passwordResetRequired = updatedUser.passwordResetRequired
        }
      }

      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.name = token.name as string
        session.user.email = token.email as string
        const extendedUser = session.user as typeof session.user & { username?: string; passwordResetRequired?: boolean };
        extendedUser.username = token.username as string;
        extendedUser.passwordResetRequired = token.passwordResetRequired as boolean;
      }
      return session
    }
  },
} satisfies NextAuthConfig