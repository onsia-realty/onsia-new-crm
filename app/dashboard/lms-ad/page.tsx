'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Download, AlertCircle, RefreshCw, Upload, PenLine } from 'lucide-react';
import * as XLSX from 'xlsx';

const BATCH_SIZE = 500;

interface LmsRow {
  id: string;
  phoneMasked: string;
  assignee: string;
  lmsAdAt: string | null;
}

interface Candidate {
  id: string;
  phoneMasked: string;
  assignee: string;
  site: string;
  createdAt: string | null;
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

  // 올릴 후보 (LMS 수기등록 & 아직 안 올림)
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candTotal, setCandTotal] = useState(0);
  const [candTruncated, setCandTruncated] = useState(false);
  const [loadingCand, setLoadingCand] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [marking, setMarking] = useState(false);

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

  const fetchCandidates = useCallback(async () => {
    setLoadingCand(true);
    try {
      const res = await fetch('/api/customers/lms-ad?mode=candidates', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '후보 목록을 불러오지 못했습니다.');
      setCandidates(data.candidates || []);
      setCandTotal(data.total || 0);
      setCandTruncated(!!data.truncated);
      setSelected(new Set());
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '후보 목록을 불러오지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoadingCand(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRows();
    fetchCandidates();
  }, [fetchRows, fetchCandidates]);

  // 선택 토글
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected = candidates.length > 0 && candidates.every((c) => selected.has(c.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.id)));
  };

  // 선택 후보를 LMS광고에 올리기 (서버가 lmsEligible=true & lmsAd=false 만 처리 → 중복 등록 방지)
  const handleAddSelected = async () => {
    if (selected.size === 0) {
      toast({ title: '알림', description: '올릴 고객을 선택해주세요.' });
      return;
    }
    if (!confirm(`선택한 ${selected.size.toLocaleString()}건을 LMS광고에 올리시겠습니까?\n\n※ 이미 1차·2차 목록에 올라간 데이터는 자동 제외됩니다.`)) return;

    setMarking(true);
    try {
      const res = await fetch('/api/customers/lms-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', customerIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'LMS광고 등록 실패');
      toast({ title: 'LMS광고 등록', description: data.message });
      await Promise.all([fetchCandidates(), fetchRows()]);
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : 'LMS광고 등록에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setMarking(false);
    }
  };

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchRows(); fetchCandidates(); }}
            disabled={loading || loadingCand}
          >
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
          아래 <strong>&quot;올릴 수 있는 LMS 수기등록 DB&quot;</strong>에서 체크 후 <strong>일괄 등록</strong>하면 올린 순서대로 <strong>500개씩 차수(1차·2차…)</strong>로 묶입니다.
          <strong> LMS 수기번호 등록</strong>으로 만든 신규 DB만 올릴 수 있고, 이미 차수에 올라간 데이터는 자동 제외됩니다.
          {isAdmin
            ? ' 관리자는 각 차수를 엑셀로 추출해 문자광고에 사용할 수 있습니다.'
            : ' 엑셀 추출(원본번호)은 관리자만 가능합니다.'}
        </AlertDescription>
      </Alert>

      {/* 올릴 수 있는 후보 (LMS 수기등록 & 미등록) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                올릴 수 있는 LMS 수기등록 DB
                {candTotal > 0 && (
                  <Badge variant="secondary">{candTotal.toLocaleString()}건</Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {isAdmin ? '전체' : '내'} 신규 LMS 수기등록 고객 중 아직 LMS광고에 안 올린 건만 표시됩니다.
                {candTruncated && ' (최근 1,000건만 표시 — 나머지는 등록 후 다시 표시됩니다)'}
              </CardDescription>
            </div>
            <Button
              onClick={handleAddSelected}
              disabled={marking || selected.size === 0}
              className="bg-rose-600 hover:bg-rose-700"
            >
              <Upload className="h-4 w-4 mr-1" />
              {marking ? '등록 중...' : `선택 ${selected.size.toLocaleString()}건 LMS광고에 올리기`}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCand ? (
            <p className="text-sm text-muted-foreground py-6 text-center">불러오는 중...</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              올릴 수 있는 신규 LMS 수기등록 고객이 없습니다. (LMS 수기번호 등록으로 먼저 등록하세요)
            </p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[32rem] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted z-10">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          aria-label="전체 선택"
                        />
                      </TableHead>
                      <TableHead>전화번호</TableHead>
                      <TableHead>현장</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead>등록일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => toggleOne(c.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(c.id)}
                            onCheckedChange={() => toggleOne(c.id)}
                            aria-label="선택"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.phoneMasked}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{c.site}</Badge>
                        </TableCell>
                        <TableCell>{c.assignee}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.createdAt ? c.createdAt.slice(0, 10) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
