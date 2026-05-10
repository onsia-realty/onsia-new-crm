import { z } from 'zod'

// 빈 필드를 null로 보내는 클라이언트(예: ConvertCallForm)와 호환되도록
// 모든 optional 문자열 필드는 nullable 허용
const optStr = () => z.string().optional().nullable()

export const createCustomerSchema = z.object({
  // 기본 정보
  name: z.string().min(2, '이름은 2자 이상이어야 합니다').optional().or(z.literal('')).nullable(),
  phone: z.string().regex(
    /^(0[0-9]{1,2}|1[0-9]{3})[0-9]{6,8}$/,
    '유효한 전화번호를 입력해주세요 (휴대폰: 010-xxxx-xxxx, 지역번호: 02/031/032 등)'
  ),
  email: z.string().email('유효한 이메일을 입력해주세요').optional().or(z.literal('')).nullable(),
  address: optStr(),
  memo: optStr(),
  assignedUserId: optStr(),

  // 방문 예정일 및 현장 정보
  nextVisitDate: optStr(), // ISO date string or null
  // 현장명은 lib/constants/sites.ts SITES + DB Site 테이블에서 동적 관리되므로
  // enum 대신 자유 문자열 허용 (실제 검증은 클라이언트의 SITES dropdown에서 담당)
  assignedSite: optStr(),

  // 온시아 고객관리카드 - 개인 정보
  gender: z.enum(['MALE', 'FEMALE']).optional().nullable(),
  ageRange: z.enum(['TWENTIES', 'THIRTIES', 'FORTIES', 'FIFTIES', 'SIXTIES_PLUS']).optional().nullable(),
  residenceArea: optStr(),
  familyRelation: optStr(),
  occupation: optStr(),

  // 온시아 고객관리카드 - 영업 정보
  source: z.enum(['AD', 'TM', 'WALKING', 'CAR_ORDER', 'FIELD', 'REFERRAL', 'OCR']).optional().nullable(),
  grade: z.enum(['A', 'B', 'C']).default('C'),
  investmentStyle: optStr(), // JSON string
  expectedBudget: z.number().int().positive().optional().nullable(),
  ownedProperties: optStr(), // JSON string
  recentVisitedMH: optStr(),
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