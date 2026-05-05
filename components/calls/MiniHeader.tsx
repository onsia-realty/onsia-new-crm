'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { LogOut, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  userName?: string;
  showBack?: boolean;
}

export function MiniHeader({ userName, showBack = false }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex h-14 items-center justify-between px-3">
        <div className="flex items-center gap-2 min-w-0">
          {showBack ? (
            <Link
              href="/calls"
              aria-label="목록으로"
              className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 active:bg-gray-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <Link href="/calls" className="flex items-center gap-2 text-gray-900">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-white">
                <Phone className="h-4 w-4" />
              </span>
              <span className="font-semibold tracking-tight">온시아 콜</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1">
          {userName && (
            <span className="hidden sm:inline text-sm text-gray-600 mr-1 truncate max-w-[140px]">
              {userName}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-gray-600 hover:text-gray-900"
            aria-label="로그아웃"
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
