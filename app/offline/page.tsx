'use client';

import { WifiOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <WifiOff className="h-8 w-8 text-gray-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            오프라인 상태입니다
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            인터넷 연결을 확인할 수 없습니다.
            <br />
            네트워크 연결을 확인한 후 다시 시도해주세요.
          </p>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h3 className="font-semibold text-sm text-gray-900 mb-2">
              오프라인에서도 사용 가능한 기능:
            </h3>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>최근 조회한 고객 정보 (캐시된 데이터)</li>
              <li>방문 일정 확인 (캐시된 데이터)</li>
              <li>공지사항 열람 (캐시된 데이터)</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong className="font-semibold">참고:</strong> 오프라인 상태에서는 데이터 수정이나 새로운 정보 등록이 제한됩니다.
              온라인 연결 후 다시 시도해주세요.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => window.location.reload()}
          >
            다시 시도
          </Button>

          <p className="text-xs text-center text-gray-500">
            연결이 복구되면 자동으로 최신 데이터와 동기화됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
