'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Download, AlertCircle, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const BATCH_SIZE = 500;

interface LmsRow {
  id: string;
  phoneMasked: string;
  assignee: string;
  lmsAdAt: string | null;
}

export default function LmsAdPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [rows, setRows] = useState<LmsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(1);
  const [exporting, setExporting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers/lms-ad', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '목록을 불러오지 못했습니다.');
      setRows(data.rows || []);
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '목록을 불러오지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const total = rows.length;
  const batchCount = Math.max(1, Math.ceil(total / BATCH_SIZE));

  // 차수별 메타 (1차 500 / 2차 500 / ...)
  const batches = useMemo(() => {
    return Array.from({ length: batchCount }, (_, i) => {
      const start = i * BATCH_SIZE;
      const count = Math.min(BATCH_SIZE, total - start);
      const full = count >= BATCH_SIZE;
      return { batch: i + 1, count, full };
    });
  }, [batchCount, total]);

  // 선택 차수가 범위를 벗어나면 보정
  useEffect(() => {
    if (selectedBatch > batchCount) setSelectedBatch(batchCount);
  }, [batchCount, selectedBatch]);

  const batchRows = useMemo(() => {
    const start = (selectedBatch - 1) * BATCH_SIZE;
    return rows.slice(start, start + BATCH_SIZE);
  }, [rows, selectedBatch]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/customers/lms-ad?export=1&batch=${selectedBatch}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '추출 실패');

      const wsData = [
        ['전화번호', '담당자'],
        ...(data.rows as Array<{ phone: string; assignee: string }>).map((r) => [r.phone, r.assignee]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      // A열 텍스트 형식 (010 앞 0 보존)
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let r = range.s.r; r <= range.e.r; r++) {
        const ref = XLSX.utils.encode_cell({ c: 0, r });
        if (ws[ref]) { ws[ref].t = 's'; ws[ref].z = '@'; }
      }
      ws['!cols'] = [{ wch: 16 }, { wch: 14 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${selectedBatch}차`);
      XLSX.writeFile(wb, `LMS광고_${selectedBatch}차_${data.rows.length}건.xlsx`);

      toast({ title: '추출 완료', description: `${selectedBatch}차 ${data.rows.length}건을 엑셀로 추출했습니다.` });
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '추출에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Megaphone className="h-7 w-7" /> LMS광고
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" /> 새로고침
          </Button>
          <Button variant="outline" onClick={() => router.push('/dashboard/customers')}>
            고객 목록으로
          </Button>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          고객 목록에서 <strong>&quot;LMS광고에 올리기&quot;</strong>로 모은 고객이 올린 순서대로 <strong>500개씩 차수(1차·2차…)</strong>로 묶입니다.
          전화번호는 마스킹되어 표시되며 담당자가 함께 보입니다.
          {isAdmin
            ? ' 관리자는 각 차수를 엑셀로 추출해 문자광고에 사용할 수 있습니다.'
            : ' 엑셀 추출(원본번호)은 관리자만 가능합니다.'}
        </AlertDescription>
      </Alert>

      {/* 차수 요약 */}
      <Card>
        <CardHeader>
          <CardTitle>차수 현황 (총 {total.toLocaleString()}개 수집)</CardTitle>
          <CardDescription>차수를 선택하면 아래에 해당 500개 목록이 표시됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">아직 LMS광고에 올린 고객이 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {batches.map((b) => (
                <button
                  key={b.batch}
                  onClick={() => setSelectedBatch(b.batch)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    selectedBatch === b.batch
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  {b.batch}차 {b.count.toLocaleString()}개{!b.full && ' (진행중)'}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 선택 차수 목록 */}
      {total > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>{selectedBatch}차 목록 ({batchRows.length.toLocaleString()}개)</CardTitle>
              {isAdmin && (
                <Button onClick={handleExport} disabled={exporting || batchRows.length === 0}>
                  <Download className="h-4 w-4 mr-1" />
                  {exporting ? '추출 중...' : `${selectedBatch}차 엑셀 추출 (원본번호)`}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[40rem] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead className="w-16 text-center">#</TableHead>
                      <TableHead>전화번호</TableHead>
                      <TableHead>담당자</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchRows.map((row, i) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-center text-muted-foreground">
                          {(selectedBatch - 1) * BATCH_SIZE + i + 1}
                        </TableCell>
                        <TableCell className="font-medium">{row.phoneMasked}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.assignee}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
