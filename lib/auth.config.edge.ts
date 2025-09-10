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