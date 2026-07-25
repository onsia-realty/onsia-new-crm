// 블라인드DB 오픈 게이트 상태 — AppConfig 테이블의 'blindDb.state' 키 한 행.
//
// 셔플 시드를 오픈 시점에 고정 저장한다. 공개DB는 시드가 없으면 매일 날짜를 쓰지만,
// 블라인드DB는 "다 모아서 한 번 섞는다"는 요구이므로 오픈 이후 순서가 바뀌면 안 된다.
import { prisma } from '@/lib/prisma'

const CONFIG_KEY = 'blindDb.state'

export type BlindDbState = {
  open: boolean
  openedAt: string | null // ISO 문자열 (Json 필드라 Date 왕복 불가)
  shuffleSeed: string | null
  openedById: string | null
}

const DEFAULT_STATE: BlindDbState = {
  open: false,
  openedAt: null,
  shuffleSeed: null,
  openedById: null,
}

// Json 필드이므로 형태 보장이 없다. 어긋나면 기본값으로 폴백(닫힌 상태).
function parseState(value: unknown): BlindDbState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_STATE
  const v = value as Record<string, unknown>
  return {
    open: typeof v.open === 'boolean' ? v.open : false,
    openedAt: typeof v.openedAt === 'string' ? v.openedAt : null,
    shuffleSeed: typeof v.shuffleSeed === 'string' ? v.shuffleSeed : null,
    openedById: typeof v.openedById === 'string' ? v.openedById : null,
  }
}

export async function getBlindDbState(): Promise<BlindDbState> {
  const row = await prisma.appConfig.findUnique({ where: { key: CONFIG_KEY } })
  return parseState(row?.value)
}

export async function setBlindDbState(
  patch: Partial<BlindDbState>,
  userId: string
): Promise<BlindDbState> {
  const next: BlindDbState = { ...(await getBlindDbState()), ...patch }
  await prisma.appConfig.upsert({
    where: { key: CONFIG_KEY },
    create: { key: CONFIG_KEY, value: next, updatedById: userId },
    update: { value: next, updatedById: userId },
  })
  return next
}
