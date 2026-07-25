import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getBlindDbState, setBlindDbState } from '@/lib/blind-db/config'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/utils/audit'

const openSchema = z
  .object({
    open: z.boolean().optional(),
    reshuffle: z.boolean().optional(),
  })
  .refine((d) => d.open !== undefined || d.reshuffle !== undefined, {
    message: 'open 또는 reshuffle을 지정해주세요.',
  })

// POST /api/blind-db/open — 블라인드DB 오픈/닫기/재셔플 (ADMIN/CEO 전용)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['ADMIN', 'CEO'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: '관리자만 블라인드DB를 오픈할 수 있습니다.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validation = openSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { open, reshuffle } = validation.data
    const current = await getBlindDbState()

    let state = current
    let action: string
    let message: string

    if (reshuffle) {
      // 시드만 교체 — 오픈 상태는 유지
      state = await setBlindDbState({ shuffleSeed: randomUUID() }, session.user.id)
      action = 'reshuffle'
      message = '블라인드DB 순서를 다시 섞었습니다.'
    } else if (open) {
      if (current.open) {
        // 이미 오픈 상태 — 시드를 재생성하면 진행 중인 순서가 흔들리므로 그대로 둔다
        action = 'open_noop'
        message = '이미 오픈된 상태입니다.'
      } else {
        state = await setBlindDbState(
          {
            open: true,
            openedAt: new Date().toISOString(),
            shuffleSeed: randomUUID(),
            openedById: session.user.id,
          },
          session.user.id
        )
        action = 'open'
        message = '블라인드DB를 오픈했습니다.'
      }
    } else {
      // 닫기 — 시드는 유지 (다시 열 때 같은 순서)
      state = await setBlindDbState({ open: false }, session.user.id)
      action = 'close'
      message = '블라인드DB를 닫았습니다.'
    }

    await createAuditLog({
      userId: session.user.id,
      action: 'OPEN_BLIND_DB',
      entity: 'AppConfig',
      entityId: 'blindDb.state',
      changes: {
        action,
        before: { open: current.open, shuffleSeed: current.shuffleSeed },
        after: { open: state.open, shuffleSeed: state.shuffleSeed },
      },
      ipAddress: getIpAddress(req),
      userAgent: getUserAgent(req),
    })

    return NextResponse.json({ success: true, data: state, message })
  } catch (error) {
    console.error('Failed to update blind-db open state:', error)
    return NextResponse.json(
      { success: false, error: '블라인드DB 상태 변경에 실패했습니다.' },
      { status: 500 }
    )
  }
}
