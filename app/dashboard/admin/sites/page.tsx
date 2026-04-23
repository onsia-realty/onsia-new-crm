'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Building2, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { refreshSites } from '@/lib/hooks/useSites';

interface SiteRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

const COLOR_PRESETS = ['blue', 'green', 'purple', 'orange', 'cyan', 'red', 'indigo', 'pink', 'yellow', 'gray'];
const ICON_PRESETS = ['🏢', '🏙️', '🏘️', '🏗️', '🌊', '🏠', '🏡', '🌆', '🌇', '🌃', '🗼', '⛲', '🏛️', '🏟️'];

export default function AdminSitesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', color: 'cyan', icon: '🏢', sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const canManage = session?.user?.role && ['ADMIN', 'CEO'].includes(session.user.role);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!canManage) {
      router.push('/dashboard');
      return;
    }
    loadSites();
  }, [status, session, canManage, router]);

  async function loadSites() {
    setLoading(true);
    try {
      // 관리 화면은 비활성 포함 전체 조회가 필요하므로 별도 endpoint 없이 Prisma에 직접 — 대신 GET /api/sites는 활성만
      // 단순화를 위해 여기선 GET /api/sites만 사용 (비활성 복구 기능은 재생성 시 자동 처리)
      const res = await fetch('/api/sites');
      const json = await res.json();
      if (json.success) setSites(json.data);
    } catch (err) {
      console.error(err);
      toast({ title: '오류', description: '현장 목록을 불러올 수 없습니다.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    const maxOrder = sites.reduce((m, s) => Math.max(m, s.sortOrder), 0);
    setForm({ name: '', color: 'cyan', icon: '🏢', sortOrder: maxOrder + 10 });
    setShowDialog(true);
  }

  function openEdit(site: SiteRow) {
    setEditingId(site.id);
    setForm({ name: site.name, color: site.color, icon: site.icon, sortOrder: site.sortOrder });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: '오류', description: '현장명을 입력해주세요.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/sites/${editingId}` : '/api/sites';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '저장 실패');
      }
      toast({ title: editingId ? '수정 완료' : '등록 완료', description: form.name });
      setShowDialog(false);
      await loadSites();
      await refreshSites(); // 다른 페이지 캐시 갱신
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '저장 실패',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '삭제 실패');
      toast({ title: '비활성화', description: '현장이 비활성화되었습니다.' });
      setDeleteConfirmId(null);
      await loadSites();
      await refreshSites();
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '삭제 실패',
        variant: 'destructive',
      });
    }
  }

  if (status === 'loading' || !canManage) {
    return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-7 w-7" /> 현장 관리
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSites}>
            <RefreshCw className="h-4 w-4 mr-1" /> 새로고침
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> 새 현장 추가
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>현장 목록</CardTitle>
          <CardDescription>
            여기서 추가한 현장은 고객 등록, 대량 등록, 계약 대장 등 모든 현장 선택 화면에 자동 노출됩니다.
            <br />
            <span className="text-amber-600">
              ※ 비활성화해도 해당 현장으로 배정된 기존 고객 데이터는 그대로 유지됩니다.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">로딩 중...</p>
          ) : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 현장이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">순서</TableHead>
                  <TableHead className="w-20">아이콘</TableHead>
                  <TableHead>현장명</TableHead>
                  <TableHead className="w-32">색상</TableHead>
                  <TableHead className="w-40 text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="text-sm text-muted-foreground">{site.sortOrder}</TableCell>
                    <TableCell className="text-2xl">{site.icon}</TableCell>
                    <TableCell className="font-medium">{site.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`bg-${site.color}-50 text-${site.color}-700 border-${site.color}-200`}>
                        {site.color}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(site)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(site.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 추가/수정 다이얼로그 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? '현장 수정' : '새 현장 추가'}</DialogTitle>
            <DialogDescription>
              현장명은 고유해야 합니다. 색상/아이콘은 화면 표시용입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="site-name">현장명 *</Label>
              <Input
                id="site-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 잠실 리버리치"
                maxLength={50}
              />
            </div>
            <div>
              <Label>아이콘</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ICON_PRESETS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm({ ...form, icon })}
                    className={`w-10 h-10 text-xl border rounded transition ${
                      form.icon === icon ? 'border-primary bg-primary/10 ring-2 ring-primary' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>색상</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={`px-3 py-1 rounded border transition text-xs bg-${color}-50 text-${color}-700 border-${color}-200 ${
                      form.color === color ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="site-order">정렬 순서 (작을수록 상위)</Label>
              <Input
                id="site-order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : editingId ? '수정' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>현장 비활성화</DialogTitle>
            <DialogDescription>
              정말 이 현장을 비활성화하시겠습니까? 해당 현장으로 배정된 기존 고객 데이터는 유지되지만,
              현장 선택 화면에서는 더 이상 노출되지 않습니다. (동일 이름으로 재등록 시 복구 가능)
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              비활성화
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
