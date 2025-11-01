import NextAuth from 'next-auth'
import authConfig from '@/lib/auth.config.edge'

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - API routes (api/*)
     * - Static files (_next/static)
     * - Image optimization (_next/image)
     * - Favicon
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}