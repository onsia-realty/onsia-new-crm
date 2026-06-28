'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

export function CopyBriefingButton({ text }: { text: string }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({ title: '복사되었습니다', description: '카톡 단체방에 붙여넣어 주세요.' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: '복사 실패',
        description: '브라우저 권한을 확인하거나 텍스트를 직접 선택해 주세요.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Button onClick={handleCopy} className="gap-2">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? '복사됨' : '전체 복사'}
    </Button>
  )
}
