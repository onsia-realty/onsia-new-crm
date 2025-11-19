'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Users,
  Phone,
  Calendar,
  FileText,
  CheckCircle,
  AlertCircle,
  LogIn,
  LogOut,
  RefreshCw,
  History,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { useRef } from 'react';

interface Contract {
  id: string;
  status: string;
  amount: number | null;
  createdAt: string;
  customer: {
    id: string;
    name: string | null;
    phone: string;
  };
}

interface DailyReport {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  customersCreated: number;
  allocationsReceived: number;
  callLogsCreated: number;
  memosCreated: number;
  contractsCount: number;
  subscriptionsCount: number;
  note: string | null;
  visits?: Array<{
    id: string;
    visitDate: string;
    status: string;
    customer: { name: string | null; phone: string };
  }>;
  contracts?: Contract[];
}

export default function DailyReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [report, setReport] = useState<DailyReport | null>(null);
  const [history, setHistory] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const handleCapture = async () => {
    if (!reportRef.current) {
      toast.error('캡쳐할 영역이 없습니다.');
      return;
    }

    try {
      const dataUrl = await toPng(reportRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        skipFonts: true,
        filter: (node) => {
          // 외부 스타일시트 제외
          if (node instanceof HTMLLinkElement) {
            return false;
          }
          return true;
        },
      });

      const link = document.createElement('a');
      const dateStr = format(new Date(), 'MMdd');
      link.download = `업무보고_${userName}_${dateStr}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('이미지가 다운로드되었습니다.');
    } catch (error) {
      console.error('이미지 저장 오류:', error);
      toast.error('이미지 저장에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }
    fetchReport();
    fetchHistory();
  }, [session, status, router]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/daily-reports/history?limit=30');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('기록 조회 오류:', error);
    }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/daily-reports');
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const todayReport = data[0];
          setReport(todayReport);
          setNote(todayReport.note || '');
        }
      }
    } catch (error) {
      console.error('보고서 조회 오류:', error);
      toast.error('보고서를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClock = async (type: 'in' | 'out') => {
    try {
      setSaving(true);
      const res = await fetch('/api/daily-reports/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchReport();
      } else {
        const error = await res.json();
        toast.error(error.error || '기록 실패');
      }
    } catch (error) {
      toast.error('기록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveReport = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/daily-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note,
        }),
      });

      if (res.ok) {
        toast.success('업무보고가 저장되었습니다.');
        fetchReport();
        fetchHistory();
      } else {
        const error = await res.json();
        toast.error(error.error || '저장 실패');
      }
    } catch (error) {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const today = new Date();

  const userName = session?.user?.name || '';
  const userPosition = (session?.user as any)?.position || '';

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-2">
        <Button variant="outline" onClick={fetchReport} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
        <Button variant="outline" onClick={handleCapture}>
          <Download className="h-4 w-4 mr-2" />
          이미지 저장
        </Button>
      </div>

      <div ref={reportRef} className="space-y-6 bg-white p-4 rounded-lg">
        {/* 캡쳐 영역 시작 - 제목 */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold">
            업무보고
            <span className="text-lg font-normal text-muted-foreground ml-2">
              ({userName}{userPosition ? ` ${userPosition}` : ''})
            </span>
          </h1>
          <p className="text-muted-foreground">
            {format(today, 'yyyy년 M월 d일 EEEE', { locale: ko })}
          </p>
        </div>

      {/* 출퇴근 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="h-5 w-5 text-green-500" />
              출근(업무시작)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report?.clockIn ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {format(new Date(report.clockIn), 'HH:mm')}
                  </p>
                  <p className="text-sm text-muted-foreground">출근 완료</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  완료
                </Badge>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">출근 기록 없음</p>
                <Button onClick={() => handleClock('in')} disabled={saving}>
                  출근하기
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="h-5 w-5 text-orange-500" />
              퇴근
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report?.clockOut ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {format(new Date(report.clockOut), 'HH:mm')}
                  </p>
                  <p className="text-sm text-muted-foreground">퇴근 완료</p>
                </div>
                <Button
                  onClick={() => handleClock('out')}
                  disabled={saving}
                  variant="outline"
                  size="sm"
                >
                  수정
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground">퇴근 기록 없음</p>
                <Button
                  onClick={() => handleClock('out')}
                  disabled={saving || !report?.clockIn}
                  variant="outline"
                >
                  퇴근하기
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 업무 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>금일 업무 현황</CardTitle>
          <CardDescription>자동으로 집계된 오늘의 업무 현황입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between sm:flex-col sm:items-start">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-600 font-medium">고객 등록</span>
                </div>
                <p className="text-2xl font-bold sm:mt-2">{report?.customersCreated || 0}건</p>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between sm:flex-col sm:items-start">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">고객 배분</span>
                </div>
                <p className="text-2xl font-bold sm:mt-2">{report?.allocationsReceived || 0}건</p>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between sm:flex-col sm:items-start">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-purple-600 font-medium">통화/메모</span>
                </div>
                <p className="text-2xl font-bold sm:mt-2">{report?.callLogsCreated || 0}건</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 금일 등록 방문 일정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            금일 등록 방문 일정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-bold text-green-600">
              {report?.visits?.length || 0}
            </span>
            <span className="text-lg text-muted-foreground">건</span>
          </div>

          {report?.visits && report.visits.length > 0 ? (
            <div className="space-y-2">
              {report.visits.map((visit) => (
                <div
                  key={visit.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {format(new Date(visit.visitDate), 'M/d HH:mm')}
                    </span>
                    <span className="font-medium">
                      {visit.customer.name || '이름 없음'}
                    </span>
                  </div>
                  <Badge variant={visit.status === 'CHECKED' ? 'default' : 'secondary'}>
                    {visit.status === 'SCHEDULED' && '예정'}
                    {visit.status === 'CHECKED' && '완료'}
                    {visit.status === 'NO_SHOW' && '노쇼'}
                    {visit.status === 'CANCELLED' && '취소'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              오늘 등록된 방문 일정이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 계약 및 청약 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            계약 및 청약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-600 font-medium mb-1">계약</p>
              <p className="text-3xl font-bold text-amber-600">
                {report?.contracts?.filter(c => c.status === 'COMPLETED').length || 0}
              </p>
            </div>
            <div className="bg-sky-50 rounded-lg p-4 text-center">
              <p className="text-sm text-sky-600 font-medium mb-1">청약</p>
              <p className="text-3xl font-bold text-sky-600">
                {report?.contracts?.filter(c => c.status === 'ACTIVE').length || 0}
              </p>
            </div>
          </div>

          {report?.contracts && report.contracts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">오늘 등록된 계약 목록</p>
              {report.contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={contract.status === 'COMPLETED' ? 'default' : 'secondary'}>
                      {contract.status === 'COMPLETED' ? '계약' : '청약'}
                    </Badge>
                    <button
                      onClick={() => router.push(`/dashboard/customers/${contract.customer.id}`)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {contract.customer.name || '이름 없음'}
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {contract.customer.phone}
                    </span>
                  </div>
                  {contract.amount && (
                    <span className="text-sm font-medium">
                      {(contract.amount / 10000).toLocaleString()}만원
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              오늘 등록된 계약/청약이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 특이사항 */}
      <Card>
        <CardHeader>
          <CardTitle>특이사항</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="오늘의 특이사항이나 메모를 입력하세요..."
            rows={3}
          />

          <Button
            onClick={handleSaveReport}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                업무보고 저장
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      </div>

      {/* 과거 업무보고 기록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-gray-600" />
            업무보고 기록
          </CardTitle>
          <CardDescription>최근 30일간의 업무보고 기록입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="space-y-2">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="p-3 bg-gray-50 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {format(new Date(record.date), 'M월 d일 (EEE)', { locale: ko })}
                    </span>
                    <div className="flex items-center gap-1 text-xs">
                      {record.clockIn && (
                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px]">
                          {format(new Date(record.clockIn), 'HH:mm')}
                        </span>
                      )}
                      {record.clockOut && (
                        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[10px]">
                          {format(new Date(record.clockOut), 'HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>등록 {record.customersCreated}</span>
                    <span>배분 {record.allocationsReceived || 0}</span>
                    <span>통화 {record.callLogsCreated}</span>
                    <span>계약 {record.contractsCount}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              저장된 업무보고 기록이 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
