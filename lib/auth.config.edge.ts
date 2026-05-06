import type { NextAuthConfig } from 'next-auth'
import { Role } from '@prisma/client'

// Edge Runtime compatible auth config (no bcrypt)
export default {
  secret: process.env.AUTH_SECRET,
  providers: [],
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
      // /calls 페이지/하위 라우트만 보호하고, 매니페스트와 /calls-* 정적 자산(아이콘 등)은 공개.
      // pathname.startsWith('/calls')만 쓰면 /calls-icon-192.png 까지 잡혀서 아이콘이 로드 안 됨.
      const isPublicCallsAsset = nextUrl.pathname === '/calls/manifest.webmanifest'
      const isOnCalls =
        (nextUrl.pathname === '/calls' || nextUrl.pathname.startsWith('/calls/')) &&
        !isPublicCallsAsset
      const isOnAuth = nextUrl.pathname.startsWith('/auth')

      if (isOnDashboard || isOnAdmin || isOnCalls) {
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