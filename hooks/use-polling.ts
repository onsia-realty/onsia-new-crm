'use client'

import { useEffect, useRef } from 'react'

/**
 * 주기적 폴링 훅 — 탭이 백그라운드일 때는 호출 정지, 다시 보이면 즉시 1회 호출.
 *
 * 사용 예:
 *   usePolling(fetchData, 60_000)
 *
 * @param handler   주기마다 호출할 함수. 가장 최근 참조를 사용 (의존성 배열 불필요).
 * @param intervalMs 폴링 주기(ms). 0 또는 음수면 자동 폴링 비활성화.
 * @param options.runOnMount 첫 마운트 시 즉시 1회 호출 여부 (기본 true)
 */
export function usePolling(
  handler: () => void | Promise<void>,
  intervalMs: number,
  options: { runOnMount?: boolean } = {},
) {
  const { runOnMount = true } = options
  const handlerRef = useRef(handler)

  // 항상 최신 handler 참조 유지
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    const run = () => {
      void handlerRef.current()
    }

    if (runOnMount) run()

    if (intervalMs <= 0) return

    const tick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        run()
      }
    }
    const interval = setInterval(tick, intervalMs)

    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
    }

    return () => {
      clearInterval(interval)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
  }, [intervalMs, runOnMount])
}
