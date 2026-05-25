'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { SITES, SITE_COLORS } from '@/lib/constants/sites'
import { cn } from '@/lib/utils'

type ContractSource = 'AD' | 'TM' | 'WALKING' | 'CAR_ORDER' | 'FIELD' | 'REFERRAL' | 'OCR'
type ContractKind = 'CONTRACT' | 'SUBSCRIPTION' | 'SUBSCRIPTION_CANCELLED'

interface ContractActivity {
  id: string
  siteName: string | null
  customerName: string | null
  unitNumber: string | null
  unitType: string | null
  source: ContractSource | null
  commission: number | null
  customerInfo: string | null
  contractDate: string
  memo: string | null
  kind: ContractKind
  employee: { id: string; name: string; position: string | null } | null
}

interface EmployeeOption {
  id: string
  name: string
  position: string | null
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

const KIND_CYCLE: Record<ContractKind, ContractKind> = {
  CONTRACT: 'SUBSCRIPTION',
  SUBSCRIPTION: 'SUBSCRIPTION_CANCELLED',
  SUBSCRIPTION_CANCELLED: 'CONTRACT',
}

const DEFAULT_KIND: ContractKind = 'CONTRACT'
const ADMIN_ROLES = new Set(['HEAD', 'ADMIN', 'CEO'])

function sourceLabel(s: ContractSource | null): string | null {
  if (!s) return null
  return SOURCE_OPTIONS.find((o) => o.value === s)?.label ?? s
}

function formatCommission(value: number | null): string | null {
  if (value === null || value === undefined) return null
  return `${value.toLocaleString('ko-KR')}만원`
}

function formatKstDate(iso: string): string {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth() + 1
  const day = kst.getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function AdminContractActivitiesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const role = (session?.user?.role as string | undefined) ?? ''
  const isAdmin = ADMIN_ROLES.has(role)

  const [list, setList] = useState<ContractActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const totalPages = Math.max(Math.ceil(total / pageSize), 1)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [submitting, setSubmitting] = useState(false)
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

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/contract-activities?page=${page}&pageSize=${pageSize}`,
        { cache: 'no-store' },
      )
      const json = await res.json()
      if (json.success) {
        setList(json.data as ContractActivity[])
        if (typeof json.total === 'number') setTotal(json.total)
      } else {
        toast({ title: '오류', description: json.error || '불러오기 실패', variant: 'destructive' })
      }
    } catch {
      toast({ title: '오류', description: '계약 활동을 불러오지 못했습니다.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, toast])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    if (!isAdmin) {
      router.push('/dashboard')
      return
    }
    fetchList()
  }, [status, session, isAdmin, router, fetchList])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

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
        const users = (json.data?.users ?? []) as EmployeeOption[]
        setEmployees(users.map((u) => ({ id: u.id, name: u.name, position: u.position })))
      }
    } catch {
      /* silent */
    }
  }

  const openCreate = async () => {
    setEditingId(null)
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
    setDialogOpen(true)
    await loadEmployees()
  }

  const openEdit = async (item: ContractActivity) => {
    setEditingId(item.id)
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
      kind: item.kind ?? DEFAULT_KIND,
    })
    setDialogOpen(true)
    await loadEmployees()
  }

  const handleSubmit = async () => {
    if (!form.employeeId || !form.contractDate) {
      toast({ title: '입력 누락', description: '직원과 계약일은 필수입니다.', variant: 'destructive' })
      return
    }
    if (!form.customerName.trim() && !form.unitNumber.trim()) {
      toast({
        title: '입력 누락',
        description: '계약자 이름 또는 동·호실 중 하나는 입력해야 합니다.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const isEdit = !!editingId
      const url = isEdit ? `/api/contract-activities/${editingId}` : '/api/contract-activities'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          commission: form.commission ? Number(form.commission.replace(/[^0-9]/g, '')) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '실패')
      toast({ title: isEdit ? '수정되었습니다' : '등록되었습니다' })
      setDialogOpen(false)
      setEditingId(null)
      if (!isEdit && page !== 1) setPage(1)
      else fetchList()
    } catch (e) {
      toast({ title: '실패', description: (e as Error).message, variant: 'destructive' })
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

  const toggleKind = async (item: ContractActivity) => {
    const next = KIND_CYCLE[item.kind ?? DEFAULT_KIND]
    setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, kind: next } : x)))
    try {
      const res = await fetch(`/api/contract-activities/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setList((prev) => prev.map((x) => (x.id === item.id ? { ...x, kind: item.kind } : x)))
      toast({ title: '종류 변경 실패', variant: 'destructive' })
    }
  }

  const pageNumbers = (() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const start = Math.max(1, Math.min(page - 3, totalPages - 6))
    return Array.from({ length: 7 }, (_, i) => start + i)
  })()

  if (status === 'loading' || !isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileSignature className="h-7 w-7 text-purple-600" />
            계약 활동 관리
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            전체 계약 활동을 페이지 단위로 조회·관리합니다 (총 {total}건)
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" /> 계약 활동 추가
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">계약 활동 목록</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">페이지당</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[88px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10건</SelectItem>
                <SelectItem value="20">20건</SelectItem>
                <SelectItem value="50">50건</SelectItem>
                <SelectItem value="100">100건</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">종류</TableHead>
                  <TableHead className="w-[100px]">계약일</TableHead>
                  <TableHead>담당</TableHead>
                  <TableHead>현장</TableHead>
                  <TableHead>계약자</TableHead>
                  <TableHead>동·호실</TableHead>
                  <TableHead>타입</TableHead>
                  <TableHead>출처</TableHead>
                  <TableHead className="text-right">수수료</TableHead>
                  <TableHead className="w-[90px] text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      로딩 중...
                    </TableCell>
                  </TableRow>
                ) : list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      등록된 계약 활동이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((item) => {
                    const siteStyle = item.siteName ? SITE_COLORS[item.siteName] : null
                    const kind = item.kind ?? DEFAULT_KIND
                    const isContract = kind === 'CONTRACT'
                    const isCancelled = kind === 'SUBSCRIPTION_CANCELLED'
                    const kindLabel = isContract ? '정계약' : '청약'
                    const srcStyle = item.source ? SOURCE_BADGE_STYLE[item.source] : null
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => toggleKind(item)}
                            title="클릭: 정계약 → 청약 → 청약(해지) → 정계약"
                            className={cn(
                              'relative inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer hover:opacity-80',
                              isContract
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : isCancelled
                                  ? 'bg-sky-50 text-sky-600 border-red-400'
                                  : 'bg-sky-100 text-sky-700 border-sky-200',
                            )}
                          >
                            <span className={cn(isCancelled && 'line-through decoration-red-600 decoration-2')}>
                              {kindLabel}
                            </span>
                          </button>
                        </TableCell>
                        <TableCell className="tabular-nums text-sm">
                          {formatKstDate(item.contractDate)}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {item.employee?.name ?? '—'}
                          {item.employee?.position && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {item.employee.position}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.siteName ? (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]',
                                siteStyle?.bg ?? 'bg-gray-50',
                                siteStyle?.text ?? 'text-gray-700',
                                siteStyle?.border ?? 'border-gray-200',
                              )}
                            >
                              {item.siteName}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{item.customerName || '—'}</TableCell>
                        <TableCell className="text-sm">{item.unitNumber || '—'}</TableCell>
                        <TableCell className="text-sm">
                          {item.unitType ? (
                            <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[11px]">
                              {item.unitType}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.source ? (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                                srcStyle ?? 'bg-gray-100 text-gray-700 border-gray-200',
                              )}
                            >
                              {sourceLabel(item.source)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-semibold text-emerald-700">
                          {formatCommission(item.commission) ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="text-gray-400 hover:text-blue-600 p-1"
                              title="수정"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="text-gray-400 hover:text-rose-600 p-1"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 페이지네이션 1, 2, 3 ... */}
          {!loading && total > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t">
              <div className="text-xs text-muted-foreground tabular-nums">
                {total}건 중 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page <= 1}
                  className="inline-flex h-8 px-2 items-center justify-center rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  처음
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={cn(
                      'inline-flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm font-medium transition',
                      n === page
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="다음 페이지"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  className="inline-flex h-8 px-2 items-center justify-center rounded text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  마지막
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
              <Select
                value={form.employeeId}
                onValueChange={(v) => setForm({ ...form, employeeId: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="직원 선택" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 && (
                    <SelectItem value="__none" disabled>
                      직원 목록을 불러오지 못했습니다
                    </SelectItem>
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
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
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
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
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
              {submitting
                ? editingId
                  ? '수정 중...'
                  : '등록 중...'
                : editingId
                  ? '수정'
                  : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
