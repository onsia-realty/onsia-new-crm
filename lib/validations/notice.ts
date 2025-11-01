import { z } from 'zod'
import { NoticeCategory } from '@prisma/client'

export const createNoticeSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(200, '제목은 200자 이내여야 합니다'),
  content: z.string().min(1, '내용을 입력해주세요'),
  category: z.nativeEnum(NoticeCategory),
  isPinned: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export const updateNoticeSchema = createNoticeSchema.partial()

export const searchNoticeSchema = z.object({
  category: z.nativeEnum(NoticeCategory).optional(),
  isPinned: z.boolean().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>
export type SearchNoticeInput = z.infer<typeof searchNoticeSchema>