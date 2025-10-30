import { Role } from '@prisma/client'
import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface User {
    role: Role
    passwordResetRequired?: boolean
  }

  interface Session {
    user: {
      id: string
      role: Role
      passwordResetRequired?: boolean
    } & DefaultSession['user']
  }
}