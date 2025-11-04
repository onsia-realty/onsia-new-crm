'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function UpdateWatcher() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Service Worker 등록 확인
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      setRegistration(reg);

      // 대기 중인 워커가 있으면 즉시 업데이트 표시
      if (reg.waiting) {
        setUpdateAvailable(true);
      }

      // 새로운 Service Worker 발견 시
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;

        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // 새 워커가 설치되고 대기 중인 상태가 되면
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    });

    // Controller 변경 시 (새 Service Worker 활성화) 자동 새로고침
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

  }, []);

  const handleUpdate = () => {
    if (!registration || !registration.waiting) return;

    // 대기 중인 Service Worker에게 skipWaiting 메시지 전송
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 duration-500">
      <Card className="w-80 border-2 border-blue-200 shadow-2xl bg-gradient-to-br from-blue-50 to-white">
        <CardContent className="p-4 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="pr-8">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  새로운 버전이 있습니다
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  온시아 CRM의 새로운 버전을 사용할 수 있습니다. 지금 업데이트하시겠습니까?
                </p>

                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    업데이트
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDismiss}
                    className="flex-1"
                  >
                    나중에
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
