import type { NextAuthConfig } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signInSchema } from '@/lib/validations/auth'
import { Role } from '@prisma/client'

export default {
  secret: process.env.AUTH_SECRET,
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
          }
        })
        
        if (!user || !user.password) {
          return null
        }
        
        if (user.role === 'PENDING') {
          throw new Error('계정 승인 대기 중입니다')
        }
        
        if (!user.isActive) {
          throw new Error('비활성화된 계정입니다')
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
      
      if (isOnDashboard || isOnAdmin) {
        if (isLoggedIn) {
          if (isOnAdmin && auth.user.role !== 'ADMIN') {
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