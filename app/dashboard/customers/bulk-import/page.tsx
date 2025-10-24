'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, AlertCircle, CheckCircle2, XCircle, FileSpreadsheet, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  duplicates: number;
  errors: Array<{
    row: number;
    phone: string;
    error: string;
  }>;
  results: Array<{
    phone: string;
    name?: string;
    status: 'success' | 'duplicate' | 'error';
    message?: string;
  }>;
}

interface PreviewRow {
  phone: string;
  name: string;
  memo: string;
}

export default function BulkImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // 샘플 엑셀 템플릿 다운로드
  const downloadTemplate = () => {
    const ws_data = [
      ['전화번호 (필수)', '이름 (선택, 없으면 자동생성)', '메모 (선택)'],
      ['010-1234-5678', '홍길동', '신규 고객'],
      ['010-9876-5432', '김철수', ''],
      ['010-5555-5555', '', '전화 상담 예정 (이름 없이 등록 가능)'],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '고객목록');
    
    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 15 }, // 전화번호
      { wch: 12 }, // 이름
      { wch: 30 }, // 메모
    ];
    
    XLSX.writeFile(wb, '고객_대량등록_템플릿.xlsx');
    
    toast({
      title: '템플릿 다운로드',
      description: '엑셀 템플릿이 다운로드되었습니다.',
    });
  };

  // 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
      toast({
        title: '오류',
        description: '엑셀 파일(.xlsx, .xls) 또는 CSV 파일만 업로드 가능합니다.',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setImportResult(null);
    previewFile(selectedFile);
  };

  // 파일 미리보기
  const previewFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        // 헤더 제외하고 처음 10개 행만 미리보기
        type ExcelRow = (string | number | null | undefined)[]
        const previewData = (jsonData.slice(1, 11) as ExcelRow[]).map((row) => ({
          phone: String(row[0] || ''),
          name: String(row[1] || ''),
          memo: String(row[2] || ''),
        }));

        setPreview(previewData);
      } catch {
        toast({
          title: '오류',
          description: '파일을 읽을 수 없습니다.',
          variant: 'destructive',
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  // 파일 업로드 및 처리
  const handleUpload = async () => {
    if (!file) {
      toast({
        title: '오류',
        description: '파일을 선택해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/customers/bulk-import', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '업로드 실패');
      }
      
      setImportResult(data);
      
      if (data.success > 0) {
        toast({
          title: '업로드 완료',
          description: `총 ${data.total}건 중 ${data.success}건 등록 성공`,
        });
      }
      
      if (data.duplicates > 0) {
        toast({
          title: '중복 발견',
          description: `${data.duplicates}건의 중복 번호가 발견되었습니다.`,
          variant: 'default',
        });
      }
      
      if (data.failed > 0) {
        toast({
          title: '오류 발생',
          description: `${data.failed}건 등록 실패`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: '오류',
        description: '파일 업로드 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">고객 대량 등록</h1>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/customers')}
        >
          고객 목록으로
        </Button>
      </div>

      {/* 안내 사항 */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          엑셀 파일로 고객 전화번호를 대량으로 등록할 수 있습니다. 
          전화번호는 필수이며, 이름과 메모는 선택사항입니다.
          중복된 전화번호는 자동으로 건너뜁니다.
        </AlertDescription>
      </Alert>

      {/* 템플릿 다운로드 */}
      <Card>
        <CardHeader>
          <CardTitle>1단계: 템플릿 다운로드</CardTitle>
          <CardDescription>
            먼저 엑셀 템플릿을 다운로드하여 양식에 맞게 데이터를 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            엑셀 템플릿 다운로드
          </Button>
        </CardContent>
      </Card>

      {/* 파일 업로드 */}
      <Card>
        <CardHeader>
          <CardTitle>2단계: 파일 업로드</CardTitle>
          <CardDescription>
            작성한 엑셀 파일을 선택하여 업로드하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              disabled={loading}
            />
            {file && (
              <Badge variant="secondary">
                <FileSpreadsheet className="mr-1 h-3 w-3" />
                {file.name}
              </Badge>
            )}
          </div>

          {/* 미리보기 */}
          {preview.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">미리보기 (처음 10개)</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>전화번호</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>메모</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.phone}</TableCell>
                      <TableCell>{row.name || '-'}</TableCell>
                      <TableCell>{row.memo || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full"
          >
            {loading ? (
              <>처리 중...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                업로드 및 등록
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 결과 표시 */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle>등록 결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{importResult.total}</div>
                <div className="text-sm text-muted-foreground">전체</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {importResult.success}
                </div>
                <div className="text-sm text-muted-foreground">성공</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {importResult.duplicates}
                </div>
                <div className="text-sm text-muted-foreground">중복</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {importResult.failed}
                </div>
                <div className="text-sm text-muted-foreground">실패</div>
              </div>
            </div>

            {/* 상세 결과 */}
            {importResult.results && importResult.results.length > 0 && (
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <h4 className="font-medium mb-2">상세 내역</h4>
                <div className="space-y-1">
                  {importResult.results.map((result, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {result.status === 'success' && (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      )}
                      {result.status === 'duplicate' && (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                      {result.status === 'error' && (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>{result.phone}</span>
                      {result.name && <span>({result.name})</span>}
                      {result.message && (
                        <span className="text-muted-foreground">- {result.message}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => router.push('/dashboard/customers')}
              className="w-full"
            >
              <Users className="mr-2 h-4 w-4" />
              고객 목록 보기
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}