'use client'

import { Bell, User, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Home,
  Users,
  Calendar,
  Bell as BellIcon,
} from 'lucide-react'

interface HeaderProps {
  userName?: string
  userEmail?: string
}

export function Header({ userName, userEmail }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentDate, setCurrentDate] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navigation = [
    { name: '홈', href: '/dashboard', icon: Home },
    { name: '고객', href: '/dashboard/customers', icon: Users },
    { name: '일정', href: '/dashboard/schedules', icon: Calendar },
    { name: '공지', href: '/dashboard/notices', icon: BellIcon },
  ]

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })
    )
  }, [])

  return (
    <header className="flex h-14 md:h-16 items-center justify-between border-b bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* 모바일 햄버거 메뉴 */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex h-16 items-center justify-center border-b">
              <h1 className="text-lg font-bold">온시아 CRM</h1>
            </div>
            <nav className="space-y-1 p-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center px-3 py-2 text-sm font-medium rounded-md',
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <h2 className="text-sm md:text-lg font-semibold text-gray-800 hidden md:block">
          {currentDate || '로딩 중...'}
        </h2>
        <h2 className="text-sm font-semibold text-gray-800 md:hidden">
          온시아 CRM
        </h2>
      </div>

      <div className="flex items-center space-x-2 md:space-x-4">
        <Button variant="ghost" size="icon" className="relative hidden md:flex">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">
            3
          </Badge>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="md:w-auto md:px-3">
              <User className="h-5 w-5" />
              <span className="text-sm font-medium hidden md:inline ml-2">{userName || '사용자'}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-gray-500">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
              프로필 설정
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings/password')}>
              비밀번호 변경
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}