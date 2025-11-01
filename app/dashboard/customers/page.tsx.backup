'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Edit, Trash2, Eye, FileSpreadsheet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { formatPhone } from '@/lib/utils/phone'

interface Customer {
  id: string
  name: string
  phone: string
  email?: string
  address?: string
  memo?: string
  assignedUser?: {
    id: string
    name: string
  }
  _count: {
    interestCards: number
    visitSchedules: number
  }
  createdAt: string
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    memo: '',
  })

  // 고객 목록 조회
  const fetchCustomers = async () => {
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append('query', searchQuery)
      
      const response = await fetch(`/api/customers?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setCustomers(data.data)
      }
    } catch (error) {
      toast.error('고객 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCustomers()
  }, [searchQuery])

  // 고객 생성
  const handleCreate = async () => {
    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success('고객이 등록되었습니다')
        setIsCreateOpen(false)
        setFormData({ name: '', phone: '', email: '', address: '', memo: '' })
        fetchCustomers()
      } else {
        toast.error(data.error || '고객 등록에 실패했습니다')
      }
    } catch (error) {
      toast.error('고객 등록 중 오류가 발생했습니다')
    }
  }

  // 고객 수정
  const handleEdit = async () => {
    if (!selectedCustomer) return
    
    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success('고객 정보가 수정되었습니다')
        setIsEditOpen(false)
        setSelectedCustomer(null)
        setFormData({ name: '', phone: '', email: '', address: '', memo: '' })
        fetchCustomers()
      } else {
        toast.error(data.error || '고객 수정에 실패했습니다')
      }
    } catch (error) {
      toast.error('고객 수정 중 오류가 발생했습니다')
    }
  }

  // 고객 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말 이 고객을 삭제하시겠습니까?')) return
    
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast.success('고객이 삭제되었습니다')
        fetchCustomers()
      } else {
        toast.error(data.error || '고객 삭제에 실패했습니다')
      }
    } catch (error) {
      toast.error('고객 삭제 중 오류가 발생했습니다')
    }
  }

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer)
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      memo: customer.memo || '',
    })
    setIsEditOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">고객 관리</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/customers/bulk-import')}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            엑셀 대량 등록
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            새 고객 등록
          </Button>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="이름, 전화번호, 이메일로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>담당자</TableHead>
              <TableHead>관심카드</TableHead>
              <TableHead>방문일정</TableHead>
              <TableHead>등록일</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  로딩 중...
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">
                  등록된 고객이 없습니다
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{formatPhone(customer.phone)}</TableCell>
                  <TableCell>{customer.email || '-'}</TableCell>
                  <TableCell>{customer.assignedUser?.name || '미배정'}</TableCell>
                  <TableCell>{customer._count.interestCards}</TableCell>
                  <TableCell>{customer._count.visitSchedules}</TableCell>
                  <TableCell>
                    {new Date(customer.createdAt).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(customer.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 생성 다이얼로그 */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 고객 등록</DialogTitle>
            <DialogDescription>
              새로운 고객 정보를 입력해주세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">이름 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">전화번호 *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="010-1234-5678"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="memo">메모</Label>
              <Textarea
                id="memo"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreate}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>고객 정보 수정</DialogTitle>
            <DialogDescription>
              고객 정보를 수정해주세요
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">이름 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">전화번호 *</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-email">이메일</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-address">주소</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-memo">메모</Label>
              <Textarea
                id="edit-memo"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              취소
            </Button>
            <Button onClick={handleEdit}>수정</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}