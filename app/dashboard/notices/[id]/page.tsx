'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Notice {
  id: string
  title: string
  content: string
  category: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  author: {
    id: string
    name: string
    email: string
  }
}

export default function NoticeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(true)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'GENERAL',
    isPinned: false
  })

  // 임시로 항상 true (테스트용)
  const canEdit = true
  const canDelete = true

  useEffect(() => {
    fetchNotice()
  }, [params.id])

  const fetchNotice = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/notices/${params.id}`)
      if (!response.ok) throw new Error('Failed to fetch notice')
      const data = await response.json()
      setNotice(data.notice)
    } catch (error) {
      console.error('Failed to fetch notice:', error)
      toast({
        title: '오류',
        description: '공지사항을 불러오는데 실패했습니다.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (!notice) return
    setFormData({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      isPinned: notice.isPinned
    })
    setEditDialogOpen(true)
  }

  const handleSave = async () => {
    if (!notice) return
    try {
      const response = await fetch('/api/notices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: notice.id,
          ...formData
        })
      })

      if (!response.ok) throw new Error('Failed to update notice')

      toast({
        title: '성공',
        description: '공지사항이 수정되었습니다.'
      })
      setEditDialogOpen(false)
      fetchNotice()
    } catch (error) {
      console.error('Failed to update notice:', error)
      toast({
        title: '오류',
        description: '공지사항 수정에 실패했습니다.',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async () => {
    if (!notice) return
    if (!confirm('정말로 이 공지사항을 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/notices?id=${notice.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete notice')

      toast({
        title: '성공',
        description: '공지사항이 삭제되었습니다.'
      })
      router.push('/dashboard/notices')
    } catch (error) {
      console.error('Failed to delete notice:', error)
      toast({
        title: '오류',
        description: '공지사항 삭제에 실패했습니다.',
        variant: 'destructive'
      })
    }
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      GENERAL: '일반',
      SYSTEM: '시스템',
      ANNOUNCEMENT: '공지',
      URGENT: '긴급'
    }
    return labels[category] || category
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!notice) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">공지사항을 찾을 수 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header with back button and actions */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          목록으로
        </Button>

        {(canEdit || canDelete) && (
          <div className="flex gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                수정
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                삭제
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Notice content */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              {getCategoryLabel(notice.category)}
            </span>
            {notice.isPinned && (
              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                고정
              </span>
            )}
          </div>
          <CardTitle className="text-2xl">{notice.title}</CardTitle>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-4">
            <span>작성자: 관리자</span>
            <span>작성일: {new Date(notice.createdAt).toLocaleDateString('ko-KR')}</span>
            {notice.updatedAt !== notice.createdAt && (
              <span>수정일: {new Date(notice.updatedAt).toLocaleDateString('ko-KR')}</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none whitespace-pre-wrap">
            {notice.content}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>공지사항 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="공지사항 제목을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="공지사항 내용을 입력하세요"
                rows={10}
              />
            </div>
            <div>
              <Label htmlFor="category">카테고리</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERAL">일반</SelectItem>
                  <SelectItem value="SYSTEM">시스템</SelectItem>
                  <SelectItem value="ANNOUNCEMENT">공지</SelectItem>
                  <SelectItem value="URGENT">긴급</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="pinned"
                checked={formData.isPinned}
                onCheckedChange={(checked) => setFormData({ ...formData, isPinned: checked })}
              />
              <Label htmlFor="pinned">상단 고정</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
