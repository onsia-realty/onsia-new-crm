'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // 임시 로그인 체크
    const user = localStorage.getItem('user');
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/auth/signin');
    }
  }, [router]);
  
  return null;
}