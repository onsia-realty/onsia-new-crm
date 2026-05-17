'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { FileSignature, Pencil, Plus, Trash2 } from 'lucide-react'
import { SITES, SITE_COLORS } from '@/lib/constants/sites'
import { cn } from '@/lib/utils'
import { usePolling } from '@/hooks/use-polling'

type ContractSource = 'AD' | 'TM' | 'WALKING' | 'CAR_ORDER' | 'FIELD' | 'REFERRAL' | 'OCR'

interface ContractActivity {
  id: string
  siteName: string | null
  customerName: string | null
  unitNumber: string | null
  unitType: string | null
  source: ContractSource | null
  commission: number | null
  customerInfo: string | null // [DEPRECATED] 과거 자유 텍스트 — 신규 데이터는 분리 컬럼 사용
  contractDate: string
  memo: string | null
  employee: { id: string; name: string; position: string | null } | null
}

const SOURCE_OPTIONS: Array<{ value: ContractSource; label: string }> = [
  { value: 'AD', label: '광고' },
  { value: 'TM', label: 'TM' },
  { value: 'WALKING', label: '워킹' },
  { value: 'FIELD', label: '필드' },
  { value: 'REFERRAL', label: '소개' },
  { value: 'CAR_ORDER', label: '카오더' },
]

const SOURCE_BADGE_STYLE: Record<ContractSource, string> = {
  AD: 'bg-amber-100 text-amber-700 border-amber-200',
  TM: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  WALKING: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FIELD: 'bg-violet-100 text-violet-700 border-violet-200',
  REFERRAL: 'bg-pink-100 text-pink-700 border-pink-200',
  CAR_ORDER: 'bg-orange-100 text-orange-700 border-orange-200',
  OCR: 'bg-gray-100 text-gray-700 border-gray-200',
}

function sourceLabel(s: ContractSource | null): string | null {
  if (!s) return null
  return SOURCE_OPTIONS.find((o) => o.value === s)?.label ?? s
}

function formatCommission(value: number | null): string | null {
  if (value === null || value === undefined) return null
  // 만원 단위 정수 — 1,000 → "1,000만원"
  return `${value.toLocaleString('ko-KR')}만원`
}

interface EmployeeOption {
  id: string
  name: string
  position: string | null
}

const ADMIN_ROLES = new Set(['HEAD', 'ADMIN', 'CEO'])

// 정계약 / 청약 / 청약(해지) — DB 컬럼 없이 localStorage에만 저장 (관리자 표기용)
type ContractKind = 'CONTRACT' | 'SUBSCRIPTION' | 'SUBSCRIPTION_CANCELLED'
const CONTRACT_KIND_KEY = 'contractActivity:kind:v1'
const DEFAULT_KIND: ContractKind = 'CONTRACT'

const KIND_CYCLE: Record<ContractKind, ContractKind> = {
  CONTRACT: 'SUBSCRIPTION',
  SUBSCRIPTION: 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_CANCELLED: 'CONTRACT',
}

function loadKindMap(): Record<string, ContractKind> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CONTRACT_KIND_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveKindMap(map: Record<string, ContractKind>) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CONTRACT_KIND_KEY, JSON.stringify(map))
  } catch {
    /* silent */
  }
}

function formatKstDate(iso: string): string {
  const d = new Date(iso)
  // KST 변환
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const m = kst.getUTCMonth() + 1
  const day = kst.getUTCDate()
  return `${m}/${day}`
}

export function ContractActivityMini() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const role = (session?.user?.role as string | undefined) ?? ''
  const isAdmin = ADMIN_ROLES.has(role)

  const [list, setList] = useState<ContractActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [kindMap, setKindMap] = useState<Record<string, ContractKind>>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    setKindMap(loadKindMap())
  }, [])

  const toggleKind = (id: string) => {
    if (!isAdmin) return
    setKindMap((prev) => {
      const current = prev[id] ?? DEFAULT_KIND
      const next = KIND_CYCLE[current]
      const updated = { ...prev, [id]: next }
      saveKindMap(updated)
      return updated
    })
  }
  const [form, setForm] = useState<{
    employeeId: string
    siteName: string
    customerName: string
    unitNumber: string
    unitType: string
    source: string
    commission: string
    contractDate: string
    memo: string
    kind: ContractKind
  }>({
    employeeId: '',
    siteName: '',
    customerName: '',
    unitNumber: '',
    unitType: '',
    source: '',
    commission: '',
    contractDate: '',
    memo: '',
    kind: DEFAULT_KIND,
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/contract-activities?limit=10', { cache: 'no-store' })
      const json = await res.json()
      if (json.success) setList(json.data as ContractActivity[])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [])

  usePolling(fetchList, 180_000) // 3 min

  const loadEmployees = async () => {
    if (employees.length > 0) return
    try {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const d = String(now.getDate()).padStart(2, '0')
      const res = await fetch(`/api/visit-board?date=${y}-${m}-${d}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.success) {
        const users = (json.data?.users ?? []) as Array<{ id: string; name: string; position: string | null }>
        setEmployees(users.map((u) => ({ id: u.id, name: u.name, position: u.position })))
      }
    } catch {
      /* silent */
    }
  }

  const openDialog = async () => {
    setEditingId(null)
    setDialogOpen(true)
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    setForm({
      employeeId: '',
      siteName: '',
      customerName: '',
      unitNumber: '',
      unitType: '',
      source: '',
      commission: '',
      contractDate: `${y}-${m}-${d}`,
      memo: '',
      kind: DEFAULT_KIND,
    })
    await loadEmployees()
  }

  const openEditDialog = async (item: ContractActivity) => {
    setEditingId(item.id)
    setDialogOpen(true)
    // contractDate(UTC) → KST 날짜로 환산
    const utc = new Date(item.contractDate)
    const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000)
    const y = kst.getUTCFullYear()
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0')
    const d = String(kst.getUTCDate()).padStart(2, '0')
    setForm({
      employeeId: item.employee?.id ?? '',
      siteName: item.siteName ?? '',
      customerName: item.customerName ?? '',
      unitNumber: item.unitNumber ?? '',
      unitType: item.unitType ?? '',
      source: item.source ?? '',
      commission: item.commission != null ? String(item.commission) : '',
      contractDate: `${y}-${m}-${d}`,
      memo: item.memo ?? '',
      kind: kindMap[item.id] ?? DEFAULT_KIND,
    })
    await loadEmployees()
  }

  const handleSubmit = async () => {
    if (!form.employeeId || !form.contractDate) {
      toast({ title: '입력 누락', description: '직원과 계약일은 필수입니다.', variant: 'destructive' })
      return
    }
    if (!form.customerName.trim() && !form.unitNumber.trim()) {
      toast({ title: '입력 누락', description: '계약자 이름 또는 동·호실 중 하나는 입력해야 합니다.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const { kind, ...payload } = form
      const isEdit = !!editingId
      const url = isEdit ? `/api/contract-activities/${editingId}` : '/api/contract-activities'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          commission: payload.commission ? Number(payload.commission.replace(/[^0-9]/g, '')) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '실패')
      // 정계약/청약 분류는 DB 미변경 — 레코드 id에 매핑하여 로컬 저장
      const targetId = (isEdit ? editingId : (json?.data?.id as string | undefined)) ?? null
      if (targetId) {
        setKindMap((prev) => {
          const updated = { ...prev, [targetId]: kind }
          saveKindMap(updated)
          return updated
        })
      }
      toast({ title: isEdit ? '수정되었습니다' : '등록되었습니다' })
      setDialogOpen(false)
      setEditingId(null)
      setForm({
        employeeId: '',
        siteName: '',
        customerName: '',
        unitNumber: '',
        unitType: '',
        source: '',
        commission: '',
        contractDate: '',
        memo: '',
        kind: DEFAULT_KIND,
      })
      fetchList()
    } catch (e) {
      toast({ title: '등록 실패', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 계약 활동을 삭제하시겠어요?')) return
    try {
      const res = await fetch(`/api/contract-activities/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: '삭제되었습니다' })
      fetchList()
    } catch {
      toast({ title: '삭제 실패', variant: 'destructive' })
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="bg-purple-50 border-b py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSignature className="h-5 w-5 text-purple-600" />
            계약 활동
          </CardTitle>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={openDialog} type="button" className="h-7 px-2 text-xs">
              <Plus className="w-3.5 h-3.5 mr-0.5" /> 추가
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 md:p-4 flex-1">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            등록된 계약 활동이 없습니다.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {list.slice(0, 5).map((item) => {
              const siteStyle = item.siteName ? SITE_COLORS[item.siteName] : null
              const commissionStr = formatCommission(item.commission)
              const sourceText = sourceLabel(item.source)
              const sourceStyle = item.source ? SOURCE_BADGE_STYLE[item.source] : null
              // 새 필드 우선, fallback으로 customerInfo
              const detail =
                [item.customerName, item.unitNumber].filter(Boolean).join(' · ') || item.customerInfo || ''
              const kind = kindMap[item.id] ?? DEFAULT_KIND
              const isContract = kind === 'CONTRACT'
              const isCancelled = kind === 'SUBSCRIPTION_CANCELLED'
              const kindLabel = isContract ? '정계약' : '청약'
              return (
                <li
                  key={item.id}
                  className="rounded px-2 py-1.5 hover:bg-purple-50/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleKind(item.id)}
                        disabled={!isAdmin}
                        title={
                          isAdmin
                            ? '클릭하여 전환: 정계약 → 청약 → 청약(해지) → 정계약'
                            : undefined
                        }
                        className={cn(
                          'relative inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold shrink-0 transition',
                          isContract
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : isCancelled
                              ? 'bg-sky-50 text-sky-600 border-red-400'
                              : 'bg-sky-100 text-sky-700 border-sky-200',
                          isAdmin && 'cursor-pointer hover:opacity-80',
                        )}
                      >
                        <span className={cn(isCancelled && 'line-through decoration-red-600 decoration-2')}>
                          {kindLabel}
                        </span>
                        {isCancelled && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 flex items-center justify-center"
                          >
                            <span className="block h-[2px] w-full rotate-[-15deg] bg-red-600/80 rounded" />
                          </span>
                        )}
                      </button>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {formatKstDate(item.contractDate)}
                      </span>
                      <span className="font-medium text-sm shrink-0">{item.employee?.name ?? '—'}</span>
                      {item.siteName && (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] shrink-0',
                            siteStyle?.bg ?? 'bg-gray-50',
                            siteStyle?.text ?? 'text-gray-700',
                            siteStyle?.border ?? 'border-gray-200'
                          )}
                        >
                          {item.siteName}
                        </span>
                      )}
                      {item.unitType && (
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 px-1.5 py-0 text-[10px] shrink-0">
                          {item.unitType}
                        </span>
                      )}
                      {detail && <span className="text-sm text-muted-foreground truncate">{detail}</span>}
                      {sourceText && (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold shrink-0',
                            sourceStyle ?? 'bg-gray-100 text-gray-700 border-gray-200'
                          )}
                        >
                          {sourceText}
                        </span>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditDialog(item)}
                          className="text-gray-400 hover:text-blue-500"
                          title="수정"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="text-gray-400 hover:text-rose-500"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  {commissionStr && (
                    <div className="mt-0.5 ml-1 text-sm font-bold text-emerald-700 tabular-nums">
                      💰 {commissionStr}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? '계약 활동 수정' : '계약 활동 등록'}</DialogTitle>
            <DialogDescription>관리자만 {editingId ? '수정' : '등록'} 가능합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">계약 종류</Label>
              <div className="mt-1 inline-flex rounded-md border bg-gray-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, kind: 'CONTRACT' })}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded transition',
                    form.kind === 'CONTRACT'
                      ? 'bg-rose-100 text-rose-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  정계약
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, kind: 'SUBSCRIPTION' })}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded transition',
                    form.kind === 'SUBSCRIPTION'
                      ? 'bg-sky-100 text-sky-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  청약
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, kind: 'SUBSCRIPTION_CANCELLED' })}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold rounded transition',
                    form.kind === 'SUBSCRIPTION_CANCELLED'
                      ? 'bg-sky-50 text-sky-600 border border-red-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  <span
                    className={cn(
                      form.kind === 'SUBSCRIPTION_CANCELLED' &&
                        'line-through decoration-red-600 decoration-2',
                    )}
                  >
                    청약 해지
                  </span>
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs">담당 직원</Label>
              <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="직원 선택" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 && (
                    <SelectItem value="__none" disabled>활동 기록 있는 직원만 노출됩니다</SelectItem>
                  )}
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} {e.position ?? ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">현장</Label>
              <Select value={form.siteName} onValueChange={(v) => setForm({ ...form, siteName: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="현장 선택 (선택)" />
                </SelectTrigger>
                <SelectContent>
                  {SITES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">계약자 이름</Label>
                <Input
                  className="mt-1"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="이남주"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs">동·호실</Label>
                <Input
                  className="mt-1"
                  value={form.unitNumber}
                  onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                  placeholder="109동 2002호"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">타입</Label>
                <Select value={form.unitType} onValueChange={(v) => setForm({ ...form, unitType: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="타입" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="59m²">59m²</SelectItem>
                    <SelectItem value="74m²">74m²</SelectItem>
                    <SelectItem value="84m²">84m²</SelectItem>
                    <SelectItem value="99m²">99m²</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">출처</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="출처" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">수수료 (만원)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  step={10}
                  value={form.commission}
                  onChange={(e) => setForm({ ...form, commission: e.target.value })}
                  placeholder="400"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">계약일</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.contractDate}
                onChange={(e) => setForm({ ...form, contractDate: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">메모 (선택)</Label>
              <Textarea
                className="mt-1"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} type="button">
              취소
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} type="button">
              {submitting ? (editingId ? '수정 중...' : '등록 중...') : (editingId ? '수정' : '등록')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
