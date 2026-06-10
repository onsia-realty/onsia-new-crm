'use client';

import { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, AlertCircle, CheckCircle2, Users, Building2, Copy, Globe, Plus, PenLine, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSites, refreshSites } from '@/lib/hooks/useSites';
import { normalizePhone, formatPhone } from '@/lib/utils/phone';
import { convertRawNumbers, buildBulkImportFile, isValidNormalized } from '@/lib/utils/voice-numbers';

const DUPLICATE_OPTIONS = [
  { value: 'skip', label: '건너뛰기', description: '기존에 등록된 번호와 중복되면 등록하지 않음' },
  { value: 'create', label: '별도 등록', description: '중복되더라도 새 고객으로 등록 (중복 표시됨)' },
];

const INITIAL_ROWS = 15;

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
}

type RowStatus = 'empty' | 'valid' | 'dup' | 'invalid';

export default function ManualImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { sites } = useSites();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN'; // 관리자만 '별도 등록'·'공개DB' 사용 가능

  // 공통 입력
  const [date, setDate] = useState('');
  const [memo, setMemo] = useState('');

  // 번호 그리드 (각 행의 원시 입력값)
  const [rows, setRows] = useState<string[]>(() => Array(INITIAL_ROWS).fill(''));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>('LMS 수기DB'); // LMS 수기등록 기본 현장 (분류용 — 자격은 lmsEligible 표식이 판단)
  const [duplicateHandling, setDuplicateHandling] = useState<string>('skip');
  const [isPublic, setIsPublic] = useState<boolean>(false);

  // 새 현장 추가 모달
  const [showAddSiteDialog, setShowAddSiteDialog] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [addingSite, setAddingSite] = useState(false);

  // 행별 변환 상태 (미리보기/검수용 — 중복은 첫 등장 기준)
  const analysis = useMemo(() => {
    const seen = new Set<string>();
    return rows.map((raw): { status: RowStatus; display: string; reason?: string } => {
      const t = (raw || '').trim();
      if (!t) return { status: 'empty', display: '' };
      const digits = t.replace(/\D/g, '');
      if (digits.length === 0) return { status: 'invalid', display: '', reason: '숫자 없음' };
      const norm = normalizePhone(t);
      if (!isValidNormalized(norm)) return { status: 'invalid', display: '', reason: `${digits.length}자리` };
      if (seen.has(norm)) return { status: 'dup', display: formatPhone(norm) };
      seen.add(norm);
      return { status: 'valid', display: formatPhone(norm) };
    });
  }, [rows]);

  const validCount = analysis.filter((a) => a.status === 'valid').length;
  const dupCount = analysis.filter((a) => a.status === 'dup').length;
  const invalidCount = analysis.filter((a) => a.status === 'invalid').length;

  // 행 값 변경
  const setRowValue = (index: number, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  // Enter / 방향키 이동 (엑셀 느낌)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const isLast = index === rows.length - 1;
      if (isLast && e.key === 'Enter') {
        setRows((prev) => [...prev, '']);
      }
      requestAnimationFrame(() => inputRefs.current[index + 1]?.focus());
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
  };

  // 여러 줄 붙여넣기 → 행 분배 (엑셀 한 열 복사 / 줄·콤마 구분 목록 지원)
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    // 각 항목에서 숫자만 추출 후 뒤 8자리 (전체번호를 붙여넣어도 휴대폰 뒤 8자리만 사용)
    const parts = text
      .split(/[\r\n,;]+/)
      .map((s) => s.replace(/\D/g, '').slice(-8))
      .filter((s) => s.length > 0);
    if (parts.length === 0) return;
    e.preventDefault();
    setRows((prev) => {
      const next = [...prev];
      for (let k = 0; k < parts.length; k++) {
        const idx = index + k;
        if (idx >= next.length) next.push('');
        next[idx] = parts[k];
      }
      return next;
    });
  };

  const addRows = (n = 10) => setRows((prev) => [...prev, ...Array(n).fill('')]);
  const clearRows = () => {
    setRows(Array(INITIAL_ROWS).fill(''));
    setImportResult(null);
  };

  async function handleAddNewSite() {
    const name = newSiteName.trim();
    if (!name) {
      toast({ title: '오류', description: '현장명을 입력해주세요.', variant: 'destructive' });
      return;
    }
    setAddingSite(true);
    try {
      const maxOrder = sites.reduce((m, s) => Math.max(m, s.sortOrder), 0);
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: 'cyan', icon: '🏢', sortOrder: maxOrder + 10 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '현장 추가 실패');
      toast({ title: '현장 추가 완료', description: `"${name}" 현장이 추가되었습니다.` });
      await refreshSites();
      setSelectedSite(name);
      setShowAddSiteDialog(false);
      setNewSiteName('');
    } catch (err) {
      toast({
        title: '오류',
        description: err instanceof Error ? err.message : '현장 추가 실패',
        variant: 'destructive',
      });
    } finally {
      setAddingSite(false);
    }
  }

  // 등록: 변환 rows를 표준 양식으로 만들어 기존 대량등록 API 호출
  const handleRegister = async () => {
    const result = convertRawNumbers(rows, date, memo);
    if (result.rows.length === 0) {
      toast({
        title: '오류',
        description: '등록할 유효한 번호가 없습니다.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const convertedFile = buildBulkImportFile(result.rows);
      const formData = new FormData();
      formData.append('file', convertedFile);
      formData.append('assignedSite', selectedSite === 'none' ? '' : selectedSite);
      formData.append('duplicateHandling', duplicateHandling);
      formData.append('orderMode', 'excel'); // 입력 순서 유지
      formData.append('isPublic', isPublic ? 'true' : 'false');
      formData.append('lmsEligible', 'true'); // 이 페이지로 등록한 고객만 LMS광고 자격 부여 (불변 표식)

      const response = await fetch('/api/customers/bulk-import', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || '등록 실패');
      }

      setImportResult(data);

      if (data.success > 0) {
        toast({
          title: '등록 완료',
          description: `총 ${data.total}건 중 ${data.success}건 등록 성공${selectedSite !== 'none' ? ` (현장: ${selectedSite})` : ''}`,
        });
      }
      if (data.duplicates > 0) {
        toast({ title: '중복 발견', description: `${data.duplicates}건의 중복 번호가 발견되었습니다.` });
      }
      if (data.failed > 0) {
        toast({ title: '오류 발생', description: `${data.failed}건 등록 실패`, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Manual import error:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '등록 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <PenLine className="h-7 w-7" /> LMS 수기번호 등록
        </h1>
        <Button variant="outline" onClick={() => router.push('/dashboard/customers')}>
          고객 목록으로
        </Button>
      </div>

      {/* 안내 */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          음성파일을 들으며 휴대폰 <strong>뒤 8자리</strong>만 아래 칸에 한 줄에 하나씩 입력하면, 자동으로
          <strong> 010을 붙이고 이름은 &quot;미정&quot;</strong>으로, 날짜·메모(지역)는 전체에 동일하게 적용해 등록합니다.
          <br />
          <span className="text-destructive text-xs font-medium">
            ※ 엑셀처럼 번호 목록을 복사해 붙여넣을 수 있습니다. Enter로 다음 줄 이동. 음성 받아쓰기는 1개만 밀려도 뒤가 전부 틀어지니 등록 전 검수하세요.
          </span>
        </AlertDescription>
      </Alert>

      {/* 1단계: 공통 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>1단계: 날짜 · 메모 (1회 입력 → 전체 적용)</CardTitle>
          <CardDescription>날짜와 메모(아파트/지역)는 이번에 입력한 모든 번호에 동일하게 적용됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="date">날짜 (YY-MM-DD)</Label>
              <Input id="date" value={date} onChange={(e) => setDate(e.target.value)} placeholder="예: 26-06-09" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="memo">메모 (아파트/지역)</Label>
              <Input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 안산 OO아파트" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2단계: 현장 선택 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> 2단계: 현장 선택
          </CardTitle>
          <CardDescription>
            등록할 고객들의 현장(프로젝트)을 선택하세요. 선택하지 않으면 현장 미지정으로 등록됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="site-select">현장명</Label>
            <div className="flex items-center gap-2">
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger id="site-select" className="w-full max-w-xs">
                  <SelectValue placeholder="현장을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">현장 미지정</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.name} value={site.name}>
                      {site.icon} {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddSiteDialog(true)} title="새 현장 추가">
                <Plus className="h-4 w-4 mr-1" /> 새 현장
              </Button>
            </div>
            {selectedSite !== 'none' && (
              <p className="text-sm text-muted-foreground">
                선택된 현장: <span className="font-medium text-primary">{selectedSite}</span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 새 현장 추가 모달 */}
      <Dialog open={showAddSiteDialog} onOpenChange={setShowAddSiteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 현장 추가</DialogTitle>
            <DialogDescription>
              새 현장은 즉시 드롭다운에 추가되며, 다른 모든 현장 선택 화면에서도 자동으로 노출됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-site-name">현장명 *</Label>
            <Input
              id="new-site-name"
              value={newSiteName}
              onChange={(e) => setNewSiteName(e.target.value)}
              placeholder="예: 반포 자이, 송도 더샵"
              maxLength={50}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !addingSite) {
                  e.preventDefault();
                  handleAddNewSite();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSiteDialog(false);
                setNewSiteName('');
              }}
              disabled={addingSite}
            >
              취소
            </Button>
            <Button onClick={handleAddNewSite} disabled={addingSite}>
              {addingSite ? '추가 중...' : '추가'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3단계: 등록 옵션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" /> 3단계: 등록 옵션
          </CardTitle>
          <CardDescription>중복 처리 방식과 등록 대상 DB를 선택하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-semibold">중복 처리</Label>
            <RadioGroup value={duplicateHandling} onValueChange={setDuplicateHandling} className="space-y-3 mt-2">
              {DUPLICATE_OPTIONS.filter((o) => isAdmin || o.value === 'skip').map((option) => (
                <div key={option.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={option.value} id={`dup-${option.value}`} className="mt-1" />
                  <div className="grid gap-1">
                    <Label htmlFor={`dup-${option.value}`} className="font-medium cursor-pointer">{option.label}</Label>
                    <p className="text-sm text-muted-foreground">{option.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm font-semibold flex items-center gap-1"><Globe className="h-4 w-4" /> 등록 대상 DB</Label>
            <RadioGroup value={isPublic ? 'public' : 'private'} onValueChange={(v) => setIsPublic(v === 'public')} className="space-y-3 mt-2">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="private" id="db-private" className="mt-1" />
                <div className="grid gap-1">
                  <Label htmlFor="db-private" className="font-medium cursor-pointer">내 DB (기본)</Label>
                  <p className="text-sm text-muted-foreground">나에게 배분된 고객으로 등록됩니다.</p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-start space-x-3">
                  <RadioGroupItem value="public" id="db-public" className="mt-1" />
                  <div className="grid gap-1">
                    <Label htmlFor="db-public" className="font-medium cursor-pointer">공개DB</Label>
                    <p className="text-sm text-muted-foreground">담당자 없이 공개DB로 등록됩니다. 모든 직원이 가져갈 수 있습니다.</p>
                  </div>
                </div>
              )}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* 4단계: 번호 입력 (엑셀 폼) */}
      <Card>
        <CardHeader>
          <CardTitle>4단계: 번호 입력</CardTitle>
          <CardDescription>
            휴대폰 <strong>뒤 8자리</strong>만 한 줄에 하나씩 입력하세요 (예: <code>78920012</code>). 자동으로 010이 붙습니다.
            9자리 이상은 입력되지 않습니다. 오른쪽에 변환 결과와 상태가 실시간으로 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 요약 */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-green-600">유효 <strong>{validCount}</strong>건</span>
            {dupCount > 0 && <span className="text-yellow-600">중복(제외) <strong>{dupCount}</strong>건</span>}
            {invalidCount > 0 && <span className="text-red-600">무효(제외) <strong>{invalidCount}</strong>건</span>}
            {(date || memo) && (
              <span className="text-muted-foreground">
                통화기록: <strong>{[date && `[${date}]`, memo].filter(Boolean).join(' ') || '-'}</strong>
              </span>
            )}
          </div>

          {/* 그리드 */}
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_1fr_5rem] bg-muted text-xs font-semibold">
              <div className="px-2 py-2 text-center border-r">#</div>
              <div className="px-2 py-2 border-r">번호 입력 (뒤 8자리)</div>
              <div className="px-2 py-2 border-r">변환 결과</div>
              <div className="px-2 py-2 text-center">상태</div>
            </div>
            <div className="max-h-[28rem] overflow-y-auto">
              {rows.map((raw, i) => {
                const a = analysis[i];
                return (
                  <div key={i} className="grid grid-cols-[3rem_1fr_1fr_5rem] items-center border-t text-sm">
                    <div className="px-2 py-1 text-center text-muted-foreground">{i + 1}</div>
                    <div className="px-1 py-1 border-l">
                      <input
                        ref={(el) => { inputRefs.current[i] = el; }}
                        value={raw}
                        onChange={(e) => setRowValue(i, e.target.value.replace(/\D/g, '').slice(0, 8))}
                        onKeyDown={(e) => handleKeyDown(e, i)}
                        onPaste={(e) => handlePaste(e, i)}
                        inputMode="numeric"
                        maxLength={8}
                        className="w-full px-2 py-1 bg-transparent outline-none focus:bg-yellow-50"
                        placeholder={i === 0 ? '예: 78920012 (뒤 8자리)' : ''}
                      />
                    </div>
                    <div className="px-2 py-1 border-l font-medium">{a.display || ''}</div>
                    <div className="px-2 py-1 border-l text-center">
                      {a.status === 'valid' && <Badge className="bg-green-100 text-green-700 hover:bg-green-100">유효</Badge>}
                      {a.status === 'dup' && <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">중복</Badge>}
                      {a.status === 'invalid' && (
                        <Badge variant="destructive" title={a.reason}>무효</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addRows(10)}>
              <Plus className="h-4 w-4 mr-1" /> 행 10개 추가
            </Button>
            <Button variant="outline" size="sm" onClick={clearRows}>
              <RotateCcw className="h-4 w-4 mr-1" /> 전체 비우기
            </Button>
          </div>

          <Button onClick={handleRegister} disabled={validCount === 0 || loading} className="w-full">
            {loading ? (
              <>처리 중...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {validCount}건 등록
                {selectedSite !== 'none' && ` (현장: ${selectedSite})`}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 결과 */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>등록 결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center gap-3 p-6 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div className="text-2xl font-bold text-green-700">
                {importResult.success}/{importResult.total}건 등록완료
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{importResult.total}</div>
                <div className="text-sm text-muted-foreground">전체</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
                <div className="text-sm text-muted-foreground">성공</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{importResult.duplicates}</div>
                <div className="text-sm text-muted-foreground">중복</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                <div className="text-sm text-muted-foreground">실패</div>
              </div>
            </div>

            <Button onClick={() => router.push('/dashboard/customers')} className="w-full">
              <Users className="mr-2 h-4 w-4" />
              고객 목록 보기
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
