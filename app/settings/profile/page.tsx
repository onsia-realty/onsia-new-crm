'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, User } from 'lucide-react';

export default function ProfileSettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
  });
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }

    if (session?.user) {
      setFormData({
        name: session.user.name || '',
      });
      // username과 email은 읽기 전용
      const userData = session.user as { username?: string; email?: string; name?: string | null };
      setUsername(userData.username || userData.email?.split('@')[0] || '');
      setEmail(session.user.email || '');
    }
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: formData.name }),
      });

      const result = await response.json();

      if (result.success) {
        // 세션 업데이트 시도
        await update({
          name: formData.name,
        });

        toast({
          title: '프로필 업데이트 성공',
          description: '이름이 성공적으로 업데이트되었습니다. 페이지를 새로고침합니다.',
        });

        // NextAuth v5의 세션 업데이트가 즉시 반영되지 않을 수 있으므로
        // 완전한 페이지 리로드로 확실하게 새 세션을 가져옴
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        toast({
          title: '업데이트 실패',
          description: result.message || '프로필 업데이트 중 오류가 발생했습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '프로필 업데이트 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button onClick={() => router.back()} variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            뒤로
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">프로필 설정</h1>
            <p className="text-xs text-gray-600">내 정보를 수정할 수 있습니다</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              프로필 정보
            </CardTitle>
            <CardDescription>
              이름을 변경할 수 있습니다 (로그인 ID와 이메일은 변경 불가)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">로그인 ID (아이디)</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">로그인 아이디는 변경할 수 없습니다</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">이메일은 자동으로 생성되며 변경할 수 없습니다</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="이름을 입력하세요"
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  {loading ? '저장 중...' : '변경사항 저장'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={loading}
                >
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6 border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm text-yellow-800">안내사항</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700">
            <ul className="list-disc list-inside space-y-1">
              <li>로그인 ID는 시스템 관리자에게 문의하여 변경할 수 있습니다.</li>
              <li>이메일은 로그인 ID를 기반으로 자동 생성됩니다.</li>
              <li>비밀번호를 변경하려면 &apos;비밀번호 변경&apos; 메뉴를 이용해주세요.</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
