'use client';

import { useEffect, useState } from 'react';
import { X, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function InstallPrompt() {
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // iOS 기기 감지
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);

    // Standalone 모드 확인 (이미 홈 화면에 추가되었는지)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                       (window.navigator as { standalone?: boolean }).standalone === true;

    setIsIos(ios);
    setIsStandalone(standalone);

    // iOS이고 아직 설치하지 않은 경우, 로컬스토리지 확인
    if (ios && !standalone) {
      const dismissed = localStorage.getItem('pwa-install-prompt-dismissed');
      const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000; // 1주일

      // 1주일이 지났거나 처음 방문한 경우 프롬프트 표시
      if (!dismissed || (now - dismissedTime > oneWeek)) {
        setShowPrompt(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-prompt-dismissed', Date.now().toString());
  };

  // iOS가 아니거나, 이미 설치되었거나, 프롬프트를 표시하지 않는 경우
  if (!isIos || isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 inset-x-0 z-50 px-4 animate-in slide-in-from-bottom-5 duration-500">
      <Card className="max-w-md mx-auto border-2 border-blue-200 shadow-2xl bg-white">
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
              <div className="flex-shrink-0 bg-blue-100 rounded-lg p-2">
                <svg
                  className="h-8 w-8 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  온시아 CRM 앱 설치하기
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  홈 화면에 추가하면 앱처럼 빠르게 접근할 수 있습니다
                </p>

                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="flex-shrink-0 bg-white rounded p-1 shadow-sm">
                      <Share className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      1. 공유 버튼을 누르세요
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex-shrink-0 bg-white rounded p-1 shadow-sm">
                      <Plus className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      2. &ldquo;홈 화면에 추가&rdquo;를 선택하세요
                    </span>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  이 안내는 1주일 후 다시 표시됩니다
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
