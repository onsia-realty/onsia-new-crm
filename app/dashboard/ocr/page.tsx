'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle2, XCircle, ImageIcon, ZoomIn } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface OCRData {
  phoneNumber: string | null
  time: string | null
  address: string | null
  date: string | null
  dayOfWeek: string | null
  rawText: string
  method: string
  aiEnhanced: boolean
}

export default function OCRPage() {
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrData, setOcrData] = useState<OCRData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [editableData, setEditableData] = useState({
    phoneNumber: '',
    address: '',
    date: '',
    time: ''
  })

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      setPreviewUrl(URL.createObjectURL(file))
      setOcrData(null)
      setError(null)
    }
  }

  const handleExtractData = async () => {
    if (!selectedImage) {
      toast.error('이미지를 선택해주세요')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', selectedImage)

      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setOcrData(result.data)
        // 추출된 데이터를 편집 가능한 상태로 설정
        setEditableData({
          phoneNumber: result.data.phoneNumber || '',
          address: result.data.address || '',
          date: result.data.date || '',
          time: result.data.time || ''
        })
        toast.success('데이터 추출 완료!')
      } else {
        setError(result.error || '데이터 추출에 실패했습니다')
        toast.error(result.error || '데이터 추출 실패')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
      toast.error('OCR 처리 중 오류가 발생했습니다')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRegisterCustomer = () => {
    if (!editableData.phoneNumber) {
      toast.error('전화번호가 필요합니다')
      return
    }

    // 수정된 데이터를 쿼리 파라미터로 전달하여 고객 등록 페이지로 이동
    const params = new URLSearchParams()

    // 전화번호 (숫자만)
    const phoneOnly = editableData.phoneNumber.replace(/\D/g, '')
    params.append('phone', phoneOnly)

    // 이름: 전화번호 뒷자리 4자리 + " (OCR)"
    const lastName4 = phoneOnly.slice(-4)
    params.append('name', `${lastName4} (OCR)`)

    // 거주지역: 주소
    if (editableData.address) {
      params.append('residenceArea', editableData.address)
    }

    // 고객 출처: 카오더
    params.append('source', '카오더')

    // OCR에서 왔음을 표시
    params.append('fromOCR', 'true')

    router.push(`/dashboard/customers/new?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">이미지 OCR</h1>
        <p className="text-muted-foreground mt-2">
          이미지에서 고객 정보를 자동으로 추출하여 신규 고객을 등록하세요
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 이미지 업로드 및 미리보기 */}
        <Card>
          <CardHeader>
            <CardTitle>이미지 업로드</CardTitle>
            <CardDescription>
              고객 정보가 포함된 이미지를 업로드하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="image-upload">이미지 선택</Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={isProcessing}
                className="mt-2"
              />
            </div>

            {previewUrl && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">미리보기</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowImageModal(true)}
                    className="h-8 w-8 p-0"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <div className="relative aspect-video bg-black/5 rounded overflow-hidden cursor-pointer" onClick={() => setShowImageModal(true)}>
                  <img
                    src={previewUrl}
                    alt="업로드된 이미지"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            {!previewUrl && (
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  이미지를 선택하면 여기에 표시됩니다
                </p>
              </div>
            )}

            <Button
              onClick={handleExtractData}
              disabled={!selectedImage || isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  데이터 추출 중...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  데이터 추출하기
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 추출된 데이터 */}
        <Card>
          <CardHeader>
            <CardTitle>추출된 데이터</CardTitle>
            <CardDescription>
              이미지에서 추출된 고객 정보입니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-4 border border-red-200 bg-red-50 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">오류 발생</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {ocrData && (
              <>
                <div className="flex items-start gap-2 p-4 border border-green-200 bg-green-50 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">데이터 추출 완료</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-phone" className="text-sm text-muted-foreground">
                      전화번호 (수정 가능)
                    </Label>
                    <Input
                      id="edit-phone"
                      value={editableData.phoneNumber}
                      onChange={(e) => setEditableData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                      placeholder="전화번호를 입력하세요"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-address" className="text-sm text-muted-foreground">
                      주소 (수정 가능)
                    </Label>
                    <Input
                      id="edit-address"
                      value={editableData.address}
                      onChange={(e) => setEditableData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="주소를 입력하세요"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-date" className="text-sm text-muted-foreground">
                      날짜 (수정 가능)
                    </Label>
                    <Input
                      id="edit-date"
                      value={editableData.date}
                      onChange={(e) => setEditableData(prev => ({ ...prev, date: e.target.value }))}
                      placeholder="날짜를 입력하세요"
                      className="mt-1"
                    />
                    {ocrData.dayOfWeek && (
                      <p className="text-xs text-muted-foreground mt-1">
                        요일: {ocrData.dayOfWeek}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="edit-time" className="text-sm text-muted-foreground">
                      시간 (수정 가능)
                    </Label>
                    <Input
                      id="edit-time"
                      value={editableData.time}
                      onChange={(e) => setEditableData(prev => ({ ...prev, time: e.target.value }))}
                      placeholder="시간을 입력하세요"
                      className="mt-1"
                    />
                  </div>

                  {ocrData.rawText && ocrData.rawText !== '(AI Vision으로 직접 분석)' && (
                    <div>
                      <Label className="text-sm text-muted-foreground">전체 텍스트</Label>
                      <div className="mt-1 p-3 bg-muted rounded text-sm max-h-32 overflow-y-auto">
                        {ocrData.rawText}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleRegisterCustomer}
                  disabled={!editableData.phoneNumber}
                  className="w-full"
                  size="lg"
                >
                  이 정보로 고객 등록하기
                </Button>
              </>
            )}

            {!ocrData && !error && !isProcessing && (
              <div className="text-center py-12 text-muted-foreground">
                <p>이미지를 업로드하고 데이터를 추출하세요</p>
              </div>
            )}

            {isProcessing && (
              <div className="text-center py-12">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-muted-foreground">
                  이미지를 분석하고 있습니다...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 이미지 확대 모달 */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>이미지 크게 보기</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-full max-h-[75vh] overflow-auto bg-black/5 rounded-lg">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="업로드된 이미지 확대"
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
