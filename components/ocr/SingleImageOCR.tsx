'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle2, XCircle, ZoomIn } from 'lucide-react'
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

interface SingleImageOCRProps {
  uploadCount: { today: number; limit: number }
  onUploadCountChange: () => void
}

export function SingleImageOCR({ onUploadCountChange }: SingleImageOCRProps) {
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

      console.log('📤 OCR API 요청 시작:', selectedImage.name)

      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        body: formData,
      })

      console.log('📥 OCR API 응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ OCR API 에러 응답:', errorText)
        throw new Error(`서버 오류 (${response.status}): ${errorText}`)
      }

      const result = await response.json()
      console.log('✅ OCR API 결과:', result)

      if (result.success) {
        setOcrData(result.data)
        setEditableData({
          phoneNumber: result.data?.phoneNumber || '',
          address: result.data?.address || '',
          date: result.data?.date || '',
          time: result.data?.time || ''
        })
        toast.success('데이터 추출 완료!')
        onUploadCountChange()
      } else {
        const errorMsg = result.error || '데이터 추출에 실패했습니다'
        console.error('❌ OCR 추출 실패:', errorMsg)
        setError(errorMsg)
        toast.error(errorMsg)
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : '오류가 발생했습니다'
      console.error('❌ OCR 처리 예외:', err)
      setError(errorMsg)
      toast.error(`OCR 처리 중 오류: ${errorMsg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRegisterCustomer = () => {
    if (!editableData.phoneNumber) {
      toast.error('전화번호가 필요합니다')
      return
    }

    const params = new URLSearchParams()
    const phoneOnly = editableData.phoneNumber.replace(/\D/g, '')
    params.append('phone', phoneOnly)

    const lastName4 = phoneOnly.slice(-4)
    params.append('name', `${lastName4} (OCR)`)

    if (editableData.address) {
      params.append('residenceArea', editableData.address)
    }

    params.append('source', 'OCR')
    params.append('fromOCR', 'true')

    router.push(`/dashboard/customers/new?${params.toString()}`)
  }

  return (
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
                데이터 추출
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* OCR 결과 */}
      <Card>
        <CardHeader>
          <CardTitle>추출된 데이터</CardTitle>
          <CardDescription>
            {ocrData ? '추출된 정보를 확인하고 수정할 수 있습니다' : 'OCR 결과가 여기에 표시됩니다'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2">
              <XCircle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-medium">추출 실패</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {ocrData && (
            <>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="phone">전화번호</Label>
                  <Input
                    id="phone"
                    value={editableData.phoneNumber}
                    onChange={(e) => setEditableData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="전화번호를 입력하세요"
                  />
                </div>

                <div>
                  <Label htmlFor="address">주소</Label>
                  <Input
                    id="address"
                    value={editableData.address}
                    onChange={(e) => setEditableData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="주소를 입력하세요"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="date">날짜</Label>
                    <Input
                      id="date"
                      value={editableData.date}
                      onChange={(e) => setEditableData(prev => ({ ...prev, date: e.target.value }))}
                      placeholder="MM-DD-YYYY"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">시간</Label>
                    <Input
                      id="time"
                      value={editableData.time}
                      onChange={(e) => setEditableData(prev => ({ ...prev, time: e.target.value }))}
                      placeholder="HH:MM"
                    />
                  </div>
                </div>

                {/* 추출 방법과 AI 향상 정보는 숨김 처리 */}
                {ocrData.dayOfWeek && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">요일:</span>
                      <span className="font-medium">{ocrData.dayOfWeek}</span>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleRegisterCustomer}
                disabled={!editableData.phoneNumber}
                className="w-full"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                고객 등록하기
              </Button>
            </>
          )}

          {!ocrData && !error && (
            <div className="py-12 text-center text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>이미지를 업로드하고 데이터를 추출하세요</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                alt="확대 이미지"
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
