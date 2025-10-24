'use client'

import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface DuplicateCustomer {
  id: string
  name?: string | null
  phone: string
  email?: string | null
  createdAt: string
  assignedUser?: {
    id: string
    name: string
    role: string
    teamId?: string
  } | null
}

interface DuplicatePhoneModalProps {
  isOpen: boolean
  phone: string
  duplicates: DuplicateCustomer[]
  onContinue: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function DuplicatePhoneModal({
  isOpen,
  phone,
  duplicates,
  onContinue,
  onCancel,
  isLoading = false
}: DuplicatePhoneModalProps) {
  if (!isOpen) return null

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => {
      if (!open && !isLoading) onCancel()
    }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600">
            중복된 전화번호 발견
          </AlertDialogTitle>
          <AlertDialogDescription>
            입력한 전화번호 <strong>{phone}</strong>는 이미 등록된 번호입니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 my-4">
          <p className="text-sm font-medium text-gray-700">
            등록된 고객 정보:
          </p>

          {duplicates.map((customer) => (
            <div
              key={customer.id}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {customer.name || '(이름 없음)'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    📱 {customer.phone}
                  </p>
                  {customer.email && (
                    <p className="text-xs text-gray-600">
                      📧 {customer.email}
                    </p>
                  )}
                  {customer.assignedUser && (
                    <p className="text-xs text-gray-600 mt-1">
                      👤 담당자: {customer.assignedUser.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    등록일: {new Date(customer.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <Link href={`/dashboard/customers/${customer.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    자세히
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            💡 같은 번호로 새 고객을 등록하려면 <strong>계속</strong>을 클릭하세요.
            <br />
            기존 고객을 수정하려면 위의 <strong>자세히</strong>를 클릭하세요.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <AlertDialogCancel
            onClick={onCancel}
            disabled={isLoading}
            className="mr-2"
          >
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onContinue}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? '처리 중...' : '계속 등록'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
