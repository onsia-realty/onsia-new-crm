import { z } from 'zod'
import { VisitType, VisitStatus } from '@prisma/client'

export const createScheduleSchema = z.object({
  customerId: z.string().min(1, '고객을 선택해주세요'),
  visitDate: z.string().or(z.date()).transform((val) => new Date(val)),
  visitType: z.nativeEnum(VisitType),
  location: z.string().min(1, '위치를 입력해주세요'),
  memo: z.string().optional(),
})

export const updateScheduleSchema = z.object({
  visitDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  visitType: z.nativeEnum(VisitType).optional(),
  location: z.string().min(1, '위치를 입력해주세요').optional(),
  status: z.nativeEnum(VisitStatus).optional(),
  memo: z.string().optional(),
})

export const searchScheduleSchema = z.object({
  userId: z.string().optional(),
  customerId: z.string().optional(),
  status: z.nativeEnum(VisitStatus).optional(),
  startDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  endDate: z.string().or(z.date()).transform((val) => new Date(val)).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
export type SearchScheduleInput = z.infer<typeof searchScheduleSchema>