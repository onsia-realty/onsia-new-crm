// @vitest-environment node
// 순수 로직 테스트이므로 jsdom이 필요 없다. vitest.config.ts의 전역 jsdom 설정은
// jsdom 패키지가 설치되어 있지 않아 동작하지 않으므로(리포지토리 기존 문제) 여기서 덮는다.
import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  isBlindHidden,
  excludeOwnBlindEntries,
  maskBlindCustomer,
  filterBlindCallLogs,
  BLIND_CUSTOMER_ALLOWED_FIELDS,
  BLIND_CUSTOMER_DENIED_FIELDS,
  type BlindState,
} from '@/lib/blind-db/mask';

const OWNER = 'user-owner';
const OTHER = 'user-other';

// 블라인드 체류 중인 고객 (담당자 없음, 원 소유자 = OWNER)
const blindCustomer: BlindState = {
  isBlind: true,
  blindAt: new Date('2026-07-01T00:00:00Z'),
  blindById: OWNER,
  assignedUserId: null,
};

describe('블라인드DB 마스킹', () => {
  describe('isBlindHidden - 열람 판정 진리표', () => {
    it('블라인드 + 타직원 → 가린다', () => {
      expect(isBlindHidden({ id: OTHER, role: 'EMPLOYEE' }, blindCustomer)).toBe(true);
    });

    it('블라인드 + 원 소유자 → 안 가린다 (회수용, 자기 데이터)', () => {
      expect(isBlindHidden({ id: OWNER, role: 'EMPLOYEE' }, blindCustomer)).toBe(false);
    });

    it('블라인드 + ADMIN → 안 가린다 (CS·중복정리)', () => {
      expect(isBlindHidden({ id: OTHER, role: 'ADMIN' }, blindCustomer)).toBe(false);
    });

    it('블라인드 + CEO → 안 가린다', () => {
      expect(isBlindHidden({ id: OTHER, role: 'CEO' }, blindCustomer)).toBe(false);
    });

    it('비블라인드(클레임 완료) → 안 가린다', () => {
      expect(
        isBlindHidden(
          { id: OTHER, role: 'EMPLOYEE' },
          { isBlind: false, blindAt: null, blindById: OWNER, assignedUserId: OTHER }
        )
      ).toBe(false);
    });

    it('isBlind=true 인데 blindAt=null → 가린다 (fail-closed)', () => {
      expect(
        isBlindHidden(
          { id: OTHER, role: 'EMPLOYEE' },
          { isBlind: true, blindAt: null, blindById: OWNER, assignedUserId: null }
        )
      ).toBe(true);
    });

    it('assignedUserId가 viewer 자신이면 안 가린다 (방어적)', () => {
      expect(
        isBlindHidden({ id: OTHER, role: 'EMPLOYEE' }, { ...blindCustomer, assignedUserId: OTHER })
      ).toBe(false);
    });

    it('TEAM_LEADER/HEAD는 우회 대상이 아니다', () => {
      expect(isBlindHidden({ id: OTHER, role: 'TEAM_LEADER' }, blindCustomer)).toBe(true);
      expect(isBlindHidden({ id: OTHER, role: 'HEAD' }, blindCustomer)).toBe(true);
    });
  });

  describe('excludeOwnBlindEntries - Prisma NULL 함정 회귀 방지', () => {
    it('blindById=null 행을 살리는 OR 구조를 반환한다', () => {
      // nullable 컬럼에 { not: viewerId } 만 쓰면 SQL이 `<> value`가 되어
      // blindById IS NULL 행이 조용히 사라진다. OR로 명시해야 한다.
      expect(excludeOwnBlindEntries(OWNER)).toEqual({
        OR: [{ blindById: null }, { NOT: { blindById: OWNER } }],
      });
    });
  });

  describe('filterBlindCallLogs - blindAt 경계선', () => {
    const blindAt = new Date('2026-07-01T00:00:00Z');
    const logs = [
      { content: '1차 부재', createdAt: new Date('2026-06-01T00:00:00Z') }, // 가려짐
      { content: '상담 진행', createdAt: new Date('2026-06-20T00:00:00Z') }, // 가려짐
      { content: '2차 부재', createdAt: blindAt }, // 경계값 → 노출
      { content: '재통화 예정', createdAt: new Date('2026-07-10T00:00:00Z') }, // 노출
    ];

    it('createdAt === blindAt 인 로그는 노출된다 (>= 경계)', () => {
      const { visible } = filterBlindCallLogs(logs, blindAt);
      expect(visible.map((l) => l.content)).toEqual(['2차 부재', '재통화 예정']);
    });

    it('hiddenCount는 가려진 로그 수다', () => {
      expect(filterBlindCallLogs(logs, blindAt).hiddenCount).toBe(2);
    });

    it('absenceCountTotal은 가려진 부재까지 전부 센다 (부재 차수 중복 방지)', () => {
      // 가려진 "1차 부재" + 노출된 "2차 부재" = 2 → 다음은 3차 부재가 되어야 한다
      expect(filterBlindCallLogs(logs, blindAt).absenceCountTotal).toBe(2);
    });

    it('blindAt=null 이면 전부 가린다 (fail-closed), 부재 총계는 유지', () => {
      const result = filterBlindCallLogs(logs, null);
      expect(result.visible).toEqual([]);
      expect(result.hiddenCount).toBe(4);
      expect(result.absenceCountTotal).toBe(2);
    });
  });

  describe('필드 분류 완전성', () => {
    it('Customer 스칼라 필드는 전부 allowed 또는 denied에 분류되어 있다', () => {
      // 신규 Customer 필드가 추가되면 이 테스트가 깨져서 개발자가 분류를 강제하게 되는 것이 목적
      const scalars = Object.keys(Prisma.CustomerScalarFieldEnum);
      const classified = new Set<string>([
        ...BLIND_CUSTOMER_ALLOWED_FIELDS,
        ...BLIND_CUSTOMER_DENIED_FIELDS,
      ]);
      expect(scalars.filter((f) => !classified.has(f))).toEqual([]);
    });

    it('allowed와 denied는 겹치지 않는다', () => {
      const denied = new Set<string>(BLIND_CUSTOMER_DENIED_FIELDS);
      expect(BLIND_CUSTOMER_ALLOWED_FIELDS.filter((f) => denied.has(f))).toEqual([]);
    });
  });

  describe('maskBlindCustomer - 응답 키', () => {
    const row = {
      id: 'c1',
      phone: '01012345678',
      isBlind: true,
      blindAt: new Date('2026-07-01T00:00:00Z'),
      name: '홍길동',
      memo: '가망 낮음',
    };

    it('name 키 자체가 없다 (null로 주지 않는다)', () => {
      const result = maskBlindCustomer(row);
      expect('name' in result).toBe(false);
    });

    it('허용된 4개 키 + blindMasked 표식만 남는다', () => {
      const result = maskBlindCustomer(row);
      expect(Object.keys(result).sort()).toEqual(
        [...BLIND_CUSTOMER_ALLOWED_FIELDS, 'blindMasked'].sort()
      );
      expect(result.blindMasked).toBe(true);
    });

    it('denylist 키는 하나도 실리지 않는다', () => {
      const keys = Object.keys(maskBlindCustomer(row));
      expect(keys.filter((k) => (BLIND_CUSTOMER_DENIED_FIELDS as readonly string[]).includes(k))).toEqual(
        []
      );
    });

    it('파생값은 추가로 실을 수 있다', () => {
      const result = maskBlindCustomer(row, {
        visibleCallCount: 1,
        hiddenCallLogCount: 3,
        absenceCountTotal: 2,
        isBlacklisted: false,
      });
      expect(result.hiddenCallLogCount).toBe(3);
      expect('name' in result).toBe(false);
    });
  });
});
