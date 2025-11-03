import { describe, it, expect } from 'vitest';

/**
 * 전화번호 정규화 함수
 * 모든 비숫자 문자를 제거하고 숫자만 반환
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

describe('전화번호 정규화', () => {
  it('하이픈이 포함된 전화번호를 숫자만 추출', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
  });

  it('공백이 포함된 전화번호를 숫자만 추출', () => {
    expect(normalizePhone('010 1234 5678')).toBe('01012345678');
  });

  it('괄호와 하이픈이 포함된 전화번호를 숫자만 추출', () => {
    expect(normalizePhone('(02)123-4567')).toBe('021234567');
  });

  it('이미 정규화된 전화번호는 그대로 반환', () => {
    expect(normalizePhone('01012345678')).toBe('01012345678');
  });

  it('빈 문자열은 빈 문자열 반환', () => {
    expect(normalizePhone('')).toBe('');
  });

  it('특수문자가 섞인 전화번호를 숫자만 추출', () => {
    expect(normalizePhone('+82-10-1234-5678')).toBe('821012345678');
  });
});
