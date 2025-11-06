'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [show, setShow] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // 세션 스토리지 체크 (새로고침 시 인트로 스킵)
    const hasSeenIntro = sessionStorage.getItem('onsia_intro_seen');

    if (hasSeenIntro === 'true') {
      onComplete();
      return;
    }

    // 인트로 지속 시간: 1.8초
    const timer = setTimeout(() => {
      sessionStorage.setItem('onsia_intro_seen', 'true');
      setShow(false);

      // 페이드아웃 애니메이션 후 완료 콜백
      setTimeout(() => {
        onComplete();
      }, 300);
    }, 1800);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!show && typeof window !== 'undefined') return null;

  // 애니메이션 감소 선호 시 정적 버전
  if (prefersReducedMotion) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <Image
          src="/온시아로고.png"
          alt="온시아 로고"
          width={120}
          height={120}
          priority
        />
        <h1 className="mt-6 text-3xl font-bold text-white">온시아 CRM</h1>
        <p className="mt-2 text-base text-[#F18B5E] opacity-90">
          AI 부동산 고객관리
        </p>
      </div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      }}
      initial={{ opacity: 1 }}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo Animation */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{
          duration: 0.8,
          ease: [0.34, 1.56, 0.64, 1], // easeOutBack
        }}
        className="relative"
        style={{
          filter: 'drop-shadow(0 10px 40px rgba(241, 139, 94, 0.3))',
        }}
      >
        <Image
          src="/온시아로고.png"
          alt="온시아 로고"
          width={120}
          height={120}
          priority
          className="select-none"
        />
      </motion.div>

      {/* Brand Text with Stagger Animation */}
      <motion.h1
        className="mt-6 text-3xl font-bold text-white tracking-tight sm:text-4xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        {'온시아 CRM'.split('').map((char, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.6 + i * 0.08,
              duration: 0.4,
              ease: 'easeOut',
            }}
            className="inline-block"
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
      </motion.h1>

      {/* Subtext */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.9 }}
        transition={{ delay: 1.0, duration: 0.5 }}
        className="mt-2 text-base text-[#F18B5E] sm:text-lg"
      >
        AI 부동산 고객관리
      </motion.p>

      {/* Progress Bar */}
      <div className="mt-8 w-64 h-0.5 bg-gray-700 rounded-full overflow-hidden sm:w-80">
        <motion.div
          className="h-full bg-[#F18B5E] rounded-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{
            duration: 1.5,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Optional: Version or Copyright */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        className="absolute bottom-8 text-xs text-gray-500"
      >
        © 2025 Onsia. All rights reserved.
      </motion.p>
    </motion.div>
  );
}
