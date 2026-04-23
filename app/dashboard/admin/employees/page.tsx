'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserCog, Search, ArrowRight, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmployeeRow {
  id: string;
  name: string;
  username: string;
  role: string;
  department: string | null;
  position: string | null;
  isActive: boolean;
  customerCount: number;
}

export default function EmployeesListPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const canView = session?.user?.role && ['ADMIN', 'CEO', 'HEAD', 'TEAM_LEADER'].includes(session.user.role);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    if (!canView) {
      router.push('/dashboard');
      return;
    }
    loadEmployees();
  }, [status, session, canView, router]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      const raw = Array.isArray(json) ? json : json?.data ?? [];
      const list: EmployeeRow[] = raw
        .filter((u: { role: string; isActive?: boolean }) =>
          u.role !== 'PENDING'
        )
        .map((u: {
          id: string;
          name: string;
          username: string;
          role: string;
          department: string | null;
          position: string | null;
          isActive: boolean;
          _count?: { customers: number };
        }) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          role: u.role,
          department: u.department,
          position: u.position,
          isActive: u.isActive,
          customerCount: u._count?.customers ?? 0,
        }));
      setEmployees(list);
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '직원 목록 조회 실패',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const filtered = employees.filter((e) => {
    if (roleFilter !== 'all' && e.role !== roleFilter) return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.username.toLowerCase().includes(q) ||
      (e.department?.toLowerCase().includes(q) ?? false)
    );
  });

  if (status === 'loading' || !canView) {
    return <div className="p-6 text-sm text-muted-foreground">로딩 중...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <UserCog className="h-7 w-7" /> 직원 화면 보기
        </h1>
        <Button variant="outline" size="sm" onClick={loadEmployees} disabled={loading}>
          새로고침
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">직원 선택</CardTitle>
          <CardDescription>
            직원을 클릭하면 해당 직원의 통계·통화기록·담당고객·업무보고를 볼 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름, 아이디, 부서로 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-1">
              {[
                { value: 'all', label: '전체' },
                { value: 'EMPLOYEE', label: '직원' },
                { value: 'TEAM_LEADER', label: '팀장' },
                { value: 'HEAD', label: '본부장' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRoleFilter(opt.value)}
                  className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                    roleFilter === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loading && employees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">로딩 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {query ? '검색 결과가 없습니다.' : '직원이 없습니다.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => router.push(`/dashboard/admin/employees/${emp.id}`)}
                  className="text-left border rounded-lg p-4 hover:bg-gray-50 hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{emp.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {emp.role}
                      </Badge>
                      {!emp.isActive && (
                        <Badge variant="destructive" className="text-xs">
                          비활성
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {emp.department || '부서 미지정'}
                      {emp.position ? ` · ${emp.position}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      담당 고객 {emp.customerCount.toLocaleString()}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
