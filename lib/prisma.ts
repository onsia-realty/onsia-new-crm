import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 데이터베이스 URL 확인 및 로깅
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in environment variables');
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Vercel 환경에서 연결 풀 최적화
  ...(process.env.NODE_ENV === 'production' && {
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })
})

// 연결 테스트 (개발 환경에서만)
if (process.env.NODE_ENV === 'development' && !globalForPrisma.prisma) {
  prisma.$connect()
    .then(() => console.log('✅ Database connected successfully'))
    .catch((err) => console.error('❌ Database connection failed:', err));
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma