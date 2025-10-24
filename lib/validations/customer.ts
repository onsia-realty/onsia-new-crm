import { z } from 'zod'

export const createCustomerSchema = z.object({
  // 기본 정보
  name: z.string().min(2, '이름은 2자 이상이어야 합니다').optional().or(z.literal('')),
  phone: z.string().regex(
    /^(0[0-9]{1,2}|1[0-9]{3})[0-9]{6,8}$/,
    '유효한 전화번호를 입력해주세요 (휴대폰: 010-xxxx-xxxx, 지역번호: 02/031/032 등)'
  ),
  email: z.string().email('유효한 이메일을 입력해주세요').optional().or(z.literal('')),
  address: z.string().optional(),
  memo: z.string().optional(),
  assignedUserId: z.string().optional(),

  // 방문 예정일 및 현장 정보
  nextVisitDate: z.string().optional(), // ISO date string
  assignedSite: z.enum(['용인경남아너스빌', '신광교클라우드시티', '평택 로제비앙']).optional().nullable(),

  // 온시아 고객관리카드 - 개인 정보
  gender: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  ageRange: z.enum(['TWENTIES', 'THIRTIES', 'FORTIES', 'FIFTIES', 'SIXTIES_PLUS']).optional().nullable(),
  residenceArea: z.string().optional(),
  familyRelation: z.string().optional(),
  occupation: z.string().optional(),

  // 온시아 고객관리카드 - 영업 정보
  source: z.enum(['AD', 'TM', 'FIELD', 'REFERRAL']).optional().nullable(),
  grade: z.enum(['A', 'B', 'C']).default('C'),
  investmentStyle: z.string().optional(), // JSON string
  expectedBudget: z.number().int().positive().optional().nullable(),
  ownedProperties: z.string().optional(), // JSON string
  recentVisitedMH: z.string().optional(),
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