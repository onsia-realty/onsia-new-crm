'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConfirmStatus } from './types'

interface VBadgeProps {
  status: ConfirmStatus
  onClick?: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function VBadge({ status, onClick, disabled, size = 'md' }: VBadgeProps) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  const base = `inline-flex items-center justify-center ${dim} rounded-full border font-bold transition`
  if (status === 'UNCHANGED') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title="변함없음 (클릭하여 다음 상태)"
        className={cn(base, 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 disabled:opacity-60')}
      >
        V
      </button>
    )
  }
  if (status === 'CHANGED') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title="변동됨 (클릭하여 다음 상태)"
        className={cn(base, 'bg-sky-500 text-white border-sky-600 hover:bg-sky-600 disabled:opacity-60')}
      >
        V
      </button>
    )
  }
  if (status === 'NO_SHOW') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        title="방문 깨짐 (클릭하여 초기화)"
        className={cn(base, 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600 disabled:opacity-60')}
      >
        V
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title="미체크 (클릭하여 변함없음으로)"
      className={cn(base, 'bg-white text-gray-400 border-gray-300 hover:border-gray-400 hover:text-gray-600 disabled:opacity-60')}
    >
      <Check className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
    </button>
  )
}

export function cycleConfirm(cur: ConfirmStatus): ConfirmStatus {
  if (cur === null) return 'UNCHANGED'
  if (cur === 'UNCHANGED') return 'CHANGED'
  if (cur === 'CHANGED') return 'NO_SHOW'
  return null
}
