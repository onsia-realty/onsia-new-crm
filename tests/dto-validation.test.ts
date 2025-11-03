import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * 고객 생성 DTO 스키마
 */
export const CreateCustomerSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').optional(),
  phone: z.string().regex(/^\d{10,11}$/, '올바른 전화번호 형식이 아닙니다'),
  gender: z.enum(['남성', '여성', '기타']).optional(),
  ageRange: z.string().optional(),
  residenceArea: z.string().optional(),
  familyRelation: z.string().optional(),
  occupation: z.string().optional(),
  investHabit: z.enum(['시세차익', '월수익', '실거주']).optional(),
  expectedBudget: z.number().int().positive().optional(),
  ownAssets: z.string().optional(),
  lastVisitMH: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(['광고', 'TM', '필드', '소개', '기타']).optional(),
});

export type CreateCustomerDTO = z.infer<typeof CreateCustomerSchema>;

describe('고객 DTO 검증', () => {
  it('유효한 고객 데이터는 검증 통과', () => {
    const validData: CreateCustomerDTO = {
      name: '홍길동',
      phone: '01012345678',
      gender: '남성',
      investHabit: '시세차익',
      expectedBudget: 50000000,
      source: '광고',
    };

    const result = CreateCustomerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('전화번호가 없으면 검증 실패', () => {
    const invalidData = {
      name: '홍길동',
    };

    const result = CreateCustomerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('전화번호에 하이픈이 포함되면 검증 실패', () => {
    const invalidData = {
      phone: '010-1234-5678',
    };

    const result = CreateCustomerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('올바른 전화번호 형식이 아닙니다');
    }
  });

  it('전화번호가 10자리 또는 11자리가 아니면 검증 실패', () => {
    const invalidData = {
      phone: '123456',
    };

    const result = CreateCustomerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('투자성향이 정의된 값이 아니면 검증 실패', () => {
    const invalidData = {
      phone: '01012345678',
      investHabit: '잘못된값',
    };

    const result = CreateCustomerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('예상투자금액이 음수면 검증 실패', () => {
    const invalidData = {
      phone: '01012345678',
      expectedBudget: -1000,
    };

    const result = CreateCustomerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
