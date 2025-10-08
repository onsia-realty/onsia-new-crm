import { z } from 'zod'

export const createCustomerSchema = z.object({
  name: z.string().min(2, '이름은 2자 이상이어야 합니다'),
  phone: z.string().regex(
    /^(0[0-9]{1,2}|1[0-9]{3})[0-9]{6,8}$/,
    '유효한 전화번호를 입력해주세요 (휴대폰: 010-xxxx-xxxx, 지역번호: 02/031/032 등)'
  ),
  email: z.string().email('유효한 이메일을 입력해주세요').optional().or(z.literal('')),
  address: z.string().optional(),
  memo: z.string().optional(),
  assignedUserId: z.string().optional(),
})

export const updateCustomerSchema = createCustomerSchema.partial()

export const searchCustomerSchema = z.object({
  query: z.string().optional(),
  assignedUserId: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type SearchCustomerInput = z.infer<typeof searchCustomerSchema>