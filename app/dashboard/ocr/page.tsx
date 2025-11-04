'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle2, XCircle, ImageIcon, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

interface ImageWithOCR {
  file: File
  previewUrl: string
  ocrData: OCRData | null
  error: string | null
  isProcessing: boolean
  selected: boolean
}

export default function OCRPage() {
  const router = useRouter()
  const [images, setImages] = useState<ImageWithOCR[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploadCount, setUploadCount] = useState({ today: 0, limit: 50 })

  // 업로드 건수 조회
  useEffect(() => {
    const fetchUploadCount = async () => {
      try {
        const response = await fetch('/api/ocr/stats')
        if (response.ok) {
          const data = await response.json()
          setUploadCount({ today: data.todayCount || 0, limit: data.limit || 50 })
        }
      } catch (error) {
        console.error('Failed to fetch upload count:', error)
      }
    }
    fetchUploadCount()
  }, [])

  // 파일 추가
  const handleFilesAdded = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    const newImages: ImageWithOCR[] = Array.from(files).map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      ocrData: null,
      error: null,
      isProcessing: false,
      selected: false,
    }))

    setImages(prev => [...prev, ...newImages])
  }, [])

  // 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesAdded(e.target.files)
  }

  // 드래그 앤 드롭
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFilesAdded(e.dataTransfer.files)
  }, [handleFilesAdded])

  // 개별 이미지 삭제
  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].previewUrl)
      newImages.splice(index, 1)
      return newImages
    })
  }

  // 모든 이미지 삭제
  const handleClearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl))
    setImages([])
  }

  // OCR 처리
  const handleExtractData = async (index: number) => {
    const image = images[index]
    if (!image || image.isProcessing) return

    // 상태 업데이트: 처리 시작
    setImages(prev => {
      const newImages = [...prev]
      newImages[index] = { ...newImages[index], isProcessing: true, error: null }
      return newImages
    })

    try {
      const formData = new FormData()
      formData.append('image', image.file)

      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setImages(prev => {
          const newImages = [...prev]
          newImages[index] = {
            ...newImages[index],
            ocrData: result.data,
            isProcessing: false,
            error: null,
          }
          return newImages
        })
        toast.success(`${image.file.name} 추출 완료`)
      } else {
        setImages(prev => {
          const newImages = [...prev]
          newImages[index] = {
            ...newImages[index],
            error: result.error || '추출 실패',
            isProcessing: false,
          }
          return newImages
        })
        toast.error(`${image.file.name} 추출 실패`)
      }
    } catch (err: unknown) {
      setImages(prev => {
        const newImages = [...prev]
        newImages[index] = {
          ...newImages[index],
          error: err instanceof Error ? err.message : '오류 발생',
          isProcessing: false,
        }
        return newImages
      })
      toast.error(`${image.file.name} 처리 중 오류`)
    }
  }

  // 모든 이미지 OCR 처리
  const handleExtractAll = async () => {
    for (let i = 0; i < images.length; i++) {
      if (!images[i].ocrData && !images[i].isProcessing) {
        await handleExtractData(i)
      }
    }
  }

  // 체크박스 토글
  const handleToggleSelect = (index: number) => {
    setImages(prev => {
      const newImages = [...prev]
      newImages[index] = { ...newImages[index], selected: !newImages[index].selected }
      return newImages
    })
  }

  // 전체 선택/해제
  const handleToggleSelectAll = () => {
    const allSelected = images.every(img => img.selected)
    setImages(prev => prev.map(img => ({ ...img, selected: !allSelected })))
  }

  // 선택된 항목 일괄 등록
  const handleBulkRegister = async () => {
    const selectedImages = images.filter(img => img.selected && img.ocrData && img.ocrData.phoneNumber)

    if (selectedImages.length === 0) {
      toast.error('등록할 고객이 없습니다. 전화번호가 있는 항목을 선택하세요.')
      return
    }

    // 고객 데이터 준비
    const customers = selectedImages.map(img => {
      const phoneOnly = img.ocrData!.phoneNumber!.replace(/\D/g, '')
      const lastName4 = phoneOnly.slice(-4)
      return {
        name: `${lastName4} (OCR)`,
        phone: phoneOnly,
        residenceArea: img.ocrData!.address || '',
        source: 'OCR',
      }
    })

    try {
      const response = await fetch('/api/customers/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`${result.created}건 등록 완료, ${result.skipped}건 중복 건너뜀`)
        // 등록된 이미지 제거
        setImages(prev => prev.filter(img => !img.selected || !img.ocrData || !img.ocrData.phoneNumber))
      } else {
        toast.error(result.error || '일괄 등록 실패')
      }
    } catch (error) {
      console.error('Bulk register error:', error)
      toast.error('일괄 등록 중 오류가 발생했습니다')
    }
  }

  const selectedCount = images.filter(img => img.selected).length
  const processedCount = images.filter(img => img.ocrData).length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">이미지 OCR (다중 처리)</h1>
          <p className="text-muted-foreground mt-2">
            여러 이미지를 한번에 업로드하여 고객 정보를 추출하고 일괄 등록하세요
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">오늘 업로드</div>
          <div className="text-2xl font-bold">
            {uploadCount.today}/{uploadCount.limit}
          </div>
          <div className="text-xs text-muted-foreground">건</div>
        </div>
      </div>

      {/* 드래그 앤 드롭 영역 */}
      <Card>
        <CardHeader>
          <CardTitle>이미지 업로드</CardTitle>
          <CardDescription>
            여러 이미지를 드래그하거나 선택하여 업로드하세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
            `}
          >
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              이미지를 여기에 드래그하거나 클릭하여 선택하세요
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              PNG, JPG, JPEG 형식 지원 (여러 파일 가능)
            </p>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="multi-file-input"
            />
            <Label htmlFor="multi-file-input">
              <Button type="button" variant="outline" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  파일 선택
                </span>
              </Button>
            </Label>
          </div>

          {images.length > 0 && (
            <div className="mt-4 flex gap-2">
              <Button onClick={handleExtractAll} disabled={processedCount === images.length}>
                <Upload className="mr-2 h-4 w-4" />
                전체 OCR 처리 ({processedCount}/{images.length})
              </Button>
              <Button variant="outline" onClick={handleClearAll}>
                <Trash2 className="mr-2 h-4 w-4" />
                전체 삭제
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* OCR 결과 테이블 */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>OCR 추출 결과</CardTitle>
                <CardDescription>
                  추출된 정보를 확인하고 선택하여 일괄 등록하세요
                </CardDescription>
              </div>
              {selectedCount > 0 && (
                <Button onClick={handleBulkRegister}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  선택 항목 일괄 등록 ({selectedCount}건)
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={images.length > 0 && images.every(img => img.selected)}
                      onCheckedChange={handleToggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>이미지</TableHead>
                  <TableHead>파일명</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead>날짜</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="w-24">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {images.map((image, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Checkbox
                        checked={image.selected}
                        onCheckedChange={() => handleToggleSelect(index)}
                        disabled={!image.ocrData || !image.ocrData.phoneNumber}
                      />
                    </TableCell>
                    <TableCell>
                      <img
                        src={image.previewUrl}
                        alt={`미리보기 ${index + 1}`}
                        className="w-16 h-16 object-cover rounded"
                      />
                    </TableCell>
                    <TableCell className="text-sm">{image.file.name}</TableCell>
                    <TableCell>
                      {image.isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : image.ocrData ? (
                        <span className="font-medium">{image.ocrData.phoneNumber || '-'}</span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {image.ocrData?.address || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {image.ocrData?.date || '-'}
                    </TableCell>
                    <TableCell>
                      {image.isProcessing ? (
                        <span className="flex items-center text-blue-600 text-sm">
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          처리중
                        </span>
                      ) : image.error ? (
                        <span className="flex items-center text-red-600 text-sm">
                          <XCircle className="mr-1 h-3 w-3" />
                          실패
                        </span>
                      ) : image.ocrData ? (
                        <span className="flex items-center text-green-600 text-sm">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          완료
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">대기</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!image.ocrData && !image.isProcessing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExtractData(index)}
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
