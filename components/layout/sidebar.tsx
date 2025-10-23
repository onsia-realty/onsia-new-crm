'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Users,
  Calendar,
  CreditCard,
  Bell,
  BarChart3,
  Settings,
  LogOut,
  FileSpreadsheet,
  Shield,
} from 'lucide-react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

interface SidebarProps {
  userRole?: string
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const navigation = [
    { name: '대시보드', href: '/dashboard', icon: Home },
    { name: '고객 관리', href: '/dashboard/customers', icon: Users },
    { name: '관심 카드', href: '/dashboard/cards', icon: CreditCard },
    { name: '방문 일정', href: '/dashboard/schedules', icon: Calendar },
    { name: '공지사항', href: '/dashboard/notices', icon: Bell },
    { name: '통계', href: '/dashboard/stats', icon: BarChart3 },
    { name: '엑셀 대량 등록', href: '/dashboard/customers/bulk-import', icon: FileSpreadsheet },
  ]

  const adminNavigation = [
    { name: '사용자 관리', href: '/admin/users', icon: Shield },
    { name: '시스템 설정', href: '/admin/settings', icon: Settings },
  ]

  const handleSignOut = async () => {
    try {
      // NextAuth v5에서 redirect: false 사용 시 CSRF 토큰 문제 해결
      // callbackUrl을 사용하여 자동 리다이렉트
      await signOut({ callbackUrl: '/auth/signin', redirect: true })
    } catch (error) {
      console.error('Sign out error:', error)
      // 에러가 발생해도 강제로 로그인 페이지로 이동
      window.location.href = '/auth/signin'
    }
  }

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center justify-center border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">온시아 CRM</h1>
      </div>
      
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5',
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                )}
              />
              {item.name}
            </Link>
          )
        })}
        
        {userRole === 'ADMIN' && (
          <>
            <div className="my-4 border-t border-gray-800" />
            {adminNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  )}
                >
                  <item.icon
                    className={cn(
                      'mr-3 h-5 w-5',
                      isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </>
        )}
      </nav>
      
      <div className="border-t border-gray-800 p-4">
        <Button
          onClick={handleSignOut}
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:bg-gray-700 hover:text-white"
        >
          <LogOut className="mr-3 h-5 w-5" />
          로그아웃
        </Button>
      </div>
    </div>
  )
}