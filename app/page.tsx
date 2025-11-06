'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { SplashScreen } from '@/components/intro/SplashScreen';

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleIntroComplete = () => {
    setShowIntro(false);
  };

  useEffect(() => {
    // 인트로가 완료된 후에만 라우팅 실행
    if (showIntro) return;
    if (status === 'loading') return;

    if (session) {
      router.push('/dashboard');
    } else {
      router.push('/auth/signin');
    }
  }, [showIntro, session, status, router]);

  // 인트로 화면 표시
  if (showIntro) {
    return <SplashScreen onComplete={handleIntroComplete} />;
  }

  // 세션 로딩 중 (인트로 이후)
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#F18B5E] mx-auto"></div>
          <p className="mt-4 text-gray-300">로딩 중...</p>
        </div>
      </div>
    );
  }

  return null;
}