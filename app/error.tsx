'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h2 className="text-2xl font-bold mb-4">문제가 발생했습니다</h2>
      <p className="text-gray-600 mb-6">죄송합니다. 오류가 발생했습니다.</p>
      <Button
        onClick={() => reset()}
        variant="default"
      >
        다시 시도
      </Button>
    </div>
  )
}