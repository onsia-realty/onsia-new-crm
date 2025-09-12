import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h2 className="text-4xl font-bold mb-4">404</h2>
      <p className="text-xl text-gray-600 mb-6">페이지를 찾을 수 없습니다</p>
      <Link href="/">
        <Button variant="default">
          홈으로 돌아가기
        </Button>
      </Link>
    </div>
  )
}