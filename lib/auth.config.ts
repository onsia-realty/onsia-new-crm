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
            email: true,
            name: true,
            password: true,
            role: true,
            isActive: true,
            approvedAt: true,
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
          email: user.email,
          name: user.name,
          role: user.role,
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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    }
  },
} satisfies NextAuthConfig