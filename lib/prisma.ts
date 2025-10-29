import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 데이터베이스 URL 확인 및 로깅
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in environment variables');
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
})

// 연결 테스트 (개발 환경에서만)
if (process.env.NODE_ENV === 'development' && !globalForPrisma.prisma) {
  prisma.$connect()
    .then(() => console.log('✅ Database connected successfully'))
    .catch((err) => console.error('❌ Database connection failed:', err));
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma