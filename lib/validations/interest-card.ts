import { z } from 'zod'
import { PropertyType, TransactionType, Priority, CardStatus } from '@prisma/client'

export const createInterestCardSchema = z.object({
  customerId: z.string().min(1, '고객을 선택해주세요'),
  propertyType: z.nativeEnum(PropertyType),
  transactionType: z.nativeEnum(TransactionType),
  location: z.string().min(1, '위치를 입력해주세요'),
  priceRange: z.string().optional(),
  area: z.string().optional(),
  features: z.array(z.string()).default([]),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(CardStatus).default(CardStatus.ACTIVE),
  memo: z.string().optional(),
})

export const updateInterestCardSchema = createInterestCardSchema.partial()

export const searchInterestCardSchema = z.object({
  customerId: z.string().optional(),
  propertyType: z.nativeEnum(PropertyType).optional(),
  transactionType: z.nativeEnum(TransactionType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(CardStatus).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export type CreateInterestCardInput = z.infer<typeof createInterestCardSchema>
export type UpdateInterestCardInput = z.infer<typeof updateInterestCardSchema>
export type SearchInterestCardInput = z.infer<typeof searchInterestCardSchema>