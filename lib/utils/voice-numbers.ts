/**
 * 음성파일 수기 작성 템플릿 → 휴대폰번호 변환 유틸 (클라이언트 전용)
 *
 * 워크플로우(docs/voice-number-workflow.md 경로 ②)를 앱 안에서 처리:
 *  - 템플릿: B3=날짜(YY-MM-DD), B4=메모(아파트/지역), A열=번호(8자리)
 *  - 변환: 8자리 → 010 부착(normalizePhone), 이름=미정, 날짜·메모 전체 일괄 적용
 *  - 파일 내 중복 제거, 무효 번호 분리
 *
 * 추후 클로바노트 텍스트 붙여넣기 자동변환도 이 모듈에 함수 추가해 재사용한다.
 */
import * as XLSX from 'xlsx'
import { normalizePhone, formatPhone } from './phone'

export interface ManualRow {
  phone: string // 010-XXXX-XXXX 포맷
  name: string // '미정'
  memo: string // [날짜] 지역메모
}

export interface ManualParseResult {
  date: string
  memo: string
  rows: ManualRow[]
  invalid: Array<{ value: string; reason: string }>
  duplicatesRemoved: number
  total: number
}

/** 템플릿 예시행 (변환 시 무시) */
export const EXAMPLE_NUMBER = '7892-0012'

/** 날짜 + 메모를 통화기록 문자열로 결합 */
export function buildCallLogMemo(date: string, memo: string): string {
  const d = (date || '').trim()
  const m = (memo || '').trim()
  if (d && m) return `[${d}] ${m}`
  if (d) return `[${d}]`
  return m
}

/** 보정 후 유효한 전화번호인지 (숫자만, 8~11자리) */
export function isValidNormalized(normalized: string): boolean {
  return /^[0-9]+$/.test(normalized) && normalized.length >= 8 && normalized.length <= 11
}

/**
 * 원시 번호 문자열 배열 → 등록용 rows로 변환 (웹 입력 폼·붙여넣기·템플릿 공용 코어)
 * - 8자리 → 010 부착, 11자리는 그대로, 이름=미정, 통화기록=[날짜] 메모
 * - 예시번호/빈칸 무시, 무효 분리, 정규화 기준 파일내 중복 제거
 */
export function convertRawNumbers(
  rawNumbers: Array<string | number | null | undefined>,
  date: string,
  memo: string
): ManualParseResult {
  const callMemo = buildCallLogMemo(date, memo)
  const invalid: Array<{ value: string; reason: string }> = []
  const seen = new Set<string>()
  const rows: ManualRow[] = []
  let duplicatesRemoved = 0

  for (const raw0 of rawNumbers) {
    const raw = String(raw0 ?? '').trim()
    if (!raw) continue
    if (raw === EXAMPLE_NUMBER) continue // 예시행 무시

    const digits = raw.replace(/\D/g, '')
    if (digits.length === 0) continue // 숫자 없는 칸은 조용히 건너뜀

    const normalized = normalizePhone(raw)
    if (!isValidNormalized(normalized)) {
      invalid.push({ value: raw, reason: `유효하지 않은 번호 (${digits.length}자리)` })
      continue
    }
    if (seen.has(normalized)) {
      duplicatesRemoved++
      continue
    }
    seen.add(normalized)
    rows.push({ phone: formatPhone(normalized), name: '미정', memo: callMemo })
  }

  return {
    date,
    memo,
    rows,
    invalid,
    duplicatesRemoved,
    total: rows.length + invalid.length + duplicatesRemoved,
  }
}

/**
 * 수기 작성 템플릿 워크북을 파싱해 등록용 rows로 변환 (엑셀 업로드 경로용 — 현재 UI 미사용, 추후 재사용 가능)
 * 셀 직접 접근으로 빈 행/저장 방식에 영향받지 않게 처리
 */
export function parseManualTemplate(workbook: XLSX.WorkBook): ManualParseResult {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')

  const cellText = (addr: string): string => {
    const c = sheet[addr]
    return c == null ? '' : String(c.v ?? c.w ?? '').trim()
  }
  const colA = (r: number): string =>
    cellText(XLSX.utils.encode_cell({ c: 0, r }))

  const date = cellText('B3')
  const memo = cellText('B4')

  // '번호(8자리)' 헤더 행 찾기 → 그 다음 행부터 번호 입력 영역
  // 안내문에도 "번호(8자리)" 문구가 포함되므로, 공백 제거 후 정확히 일치하는 셀만 헤더로 인정
  let startRow = 7 // 헤더 못 찾을 때 폴백 (엑셀 8행 = 0-indexed 7)
  for (let r = range.s.r; r <= range.e.r; r++) {
    if (colA(r).replace(/\s/g, '') === '번호(8자리)') {
      startRow = r + 1
      break
    }
  }

  const rawNumbers: string[] = []
  for (let r = startRow; r <= range.e.r; r++) {
    rawNumbers.push(colA(r))
  }
  return convertRawNumbers(rawNumbers, date, memo)
}

/**
 * 변환 rows → 기존 대량등록 표준양식 xlsx(전화번호|이름|통화기록) File 생성
 * 기존 /api/customers/bulk-import 가 그대로 받아 처리한다.
 */
export function buildBulkImportFile(rows: ManualRow[], fileName = '수기번호_변환.xlsx'): File {
  const wsData = [
    ['전화번호', '이름', '통화기록'],
    ...rows.map((r) => [r.phone, r.name, r.memo]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // A열(전화번호)을 텍스트 형식으로 강제 — 010 앞의 0 보존
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let r = range.s.r; r <= range.e.r; r++) {
    const ref = XLSX.utils.encode_cell({ c: 0, r })
    if (ws[ref]) {
      ws[ref].t = 's'
      ws[ref].z = '@'
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '고객목록')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([buf], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * 수기 작성용 빈 템플릿 다운로드 (build_voice_template.py 양식의 셀 위치 재현)
 * 커뮤니티판 xlsx는 셀 스타일 저장을 지원하지 않아 색상은 생략, 위치/문구만 유지한다.
 */
export function downloadManualTemplate(fileName = '음성번호_수기작성_템플릿.xlsx'): void {
  const wsData: (string | undefined)[][] = [
    ['📞 음성파일 번호 수기 작성 템플릿'], // row1 (A1)
    [], // row2
    ['날짜', '', '← YY-MM-DD 형식 (예: 26-06-07)'], // row3 (B3=날짜)
    ['메모(아파트/지역)', '', '← 한 번만 작성하면 전체 번호에 동일 적용 (예: 안산, 용인, OO아파트)'], // row4 (B4=메모)
    [], // row5
    ['▶ 음성파일을 들으며 아래 "번호(8자리)" 칸에 한 줄에 하나씩 적어주세요. 010은 자동으로 붙습니다.'], // row6
    ['번호(8자리)'], // row7 (헤더)
    ['7892-0012', '← 예시 (지우고 작성)'], // row8 (예시행)
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // A열을 텍스트 형식으로 (8자리 입력 시 0 보존)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let r = range.s.r; r <= range.e.r; r++) {
    const ref = XLSX.utils.encode_cell({ c: 0, r })
    if (ws[ref]) {
      ws[ref].t = 's'
      ws[ref].z = '@'
    }
  }
  ws['!cols'] = [{ wch: 20 }, { wch: 24 }, { wch: 52 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '번호작성')
  XLSX.writeFile(wb, fileName)
}
