import NextAuth from 'next-auth'
import authConfig from '@/lib/auth.config'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  ...authConfig,
})