'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Save, AlertCircle, CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface FormData {
  // 기본 정보
  name: string;
  phone: string;
  memo: string;
  nextVisitDate: Date | undefined;
  assignedSite: string;

  // 개인 정보
  gender: string;
  ageRange: string;
  residenceArea: string;
  familyRelation: string;
  occupation: string;

  // 영업 정보
  source: string;
  grade: string;
  investmentStyle: {
    timeProfit: boolean;
    monthlyIncome: boolean;
    residence: boolean;
  };
  expectedBudget: string;
  ownedProperties: {
    apt: boolean;
    officetel: boolean;
    commercial: boolean;
    building: boolean;
  };
  recentVisitedMH: string;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ customerId: string; name: string } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    memo: '',
    nextVisitDate: undefined,
    assignedSite: '',
    gender: '',
    ageRange: '',
    residenceArea: '',
    familyRelation: '',
    occupation: '',
    source: '',
    grade: 'C',
    investmentStyle: {
      timeProfit: false,
      monthlyIncome: false,
      residence: false
    },
    expectedBudget: '',
    ownedProperties: {
      apt: false,
      officetel: false,
      commercial: false,
      building: false
    },
    recentVisitedMH: ''
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleInvestmentStyleChange = (field: keyof FormData['investmentStyle']) => {
    setFormData(prev => ({
      ...prev,
      investmentStyle: {
        ...prev.investmentStyle,
        [field]: !prev.investmentStyle[field]
      }
    }));
  };

  const handleOwnedPropertiesChange = (field: keyof FormData['ownedProperties']) => {
    setFormData(prev => ({
      ...prev,
      ownedProperties: {
        ...prev.ownedProperties,
        [field]: !prev.ownedProperties[field]
      }
    }));
  };

  const handlePhoneChange = (value: string) => {
    // 숫자만 추출
    const numbersOnly = value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, phone: numbersOnly }));
    setDuplicateWarning(null); // 전화번호 변경 시 중복 경고 초기화
  };

  const formatPhoneDisplay = (phone: string) => {
    // 010-1234-5678 형식으로 표시
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }
    return phone;
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: '필수 항목 누락',
        description: '이름을 입력해주세요.',
        variant: 'destructive'
      });
      return false;
    }

    if (!formData.phone.trim()) {
      toast({
        title: '필수 항목 누락',
        description: '전화번호를 입력해주세요.',
        variant: 'destructive'
      });
      return false;
    }

    if (formData.phone.length < 10 || formData.phone.length > 11) {
      toast({
        title: '전화번호 형식 오류',
        description: '올바른 전화번호를 입력해주세요. (10-11자리)',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // 중복 체크
      const checkResponse = await fetch(`/api/customers/check-duplicate?phone=${formData.phone}`);
      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        if (checkResult.exists) {
          setDuplicateWarning({
            customerId: checkResult.customer.id,
            name: checkResult.customer.name
          });
          setLoading(false);
          return;
        }
      }

      // 고객 생성
      const parsedBudget = formData.expectedBudget ? parseInt(formData.expectedBudget, 10) : undefined;
      const validBudget = parsedBudget && !isNaN(parsedBudget) ? parsedBudget : undefined;

      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          memo: formData.memo || undefined,
          nextVisitDate: formData.nextVisitDate ? formData.nextVisitDate.toISOString() : undefined,
          assignedSite: formData.assignedSite || undefined,
          gender: formData.gender || undefined,
          ageRange: formData.ageRange || undefined,
          residenceArea: formData.residenceArea || undefined,
          familyRelation: formData.familyRelation || undefined,
          occupation: formData.occupation || undefined,
          source: formData.source || undefined,
          grade: formData.grade || undefined,
          investmentStyle: JSON.stringify(formData.investmentStyle),
          expectedBudget: validBudget,
          ownedProperties: JSON.stringify(formData.ownedProperties),
          recentVisitedMH: formData.recentVisitedMH || undefined
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '성공',
          description: '고객이 등록되었습니다.'
        });
        router.push(`/dashboard/customers/${result.data.id}`);
      } else {
        throw new Error(result.error || '고객 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '고객 등록에 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDuplicate = () => {
    if (duplicateWarning) {
      router.push(`/dashboard/customers/${duplicateWarning.customerId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/customers')}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                목록으로
              </Button>
              <h1 className="text-2xl font-bold">신규 고객 등록</h1>
            </div>
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 중복 경고 */}
          {duplicateWarning && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  동일한 전화번호({formatPhoneDisplay(formData.phone)})의 고객이 이미 존재합니다: <strong>{duplicateWarning.name}</strong>
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleViewDuplicate}
                  >
                    기존 고객 보기
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDuplicateWarning(null)}
                  >
                    무시하고 계속
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">
                    이름 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="홍길동"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">
                    전화번호 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    value={formatPhoneDisplay(formData.phone)}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="010-1234-5678"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="memo">메모</Label>
                <Textarea
                  id="memo"
                  value={formData.memo}
                  onChange={(e) => handleInputChange('memo', e.target.value)}
                  placeholder="고객에 대한 특이사항이나 메모를 입력하세요"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>방문 예정일</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !formData.nextVisitDate && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.nextVisitDate ? (
                          format(formData.nextVisitDate, 'PPP', { locale: ko })
                        ) : (
                          <span>날짜를 선택하세요</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.nextVisitDate}
                        onSelect={(date) => setFormData(prev => ({ ...prev, nextVisitDate: date }))}
                        locale={ko}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="assignedSite">현장명</Label>
                  <Select value={formData.assignedSite} onValueChange={(value) => handleInputChange('assignedSite', value)}>
                    <SelectTrigger id="assignedSite">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="용인경남아너스빌">용인경남아너스빌</SelectItem>
                      <SelectItem value="신광교클라우드시티">신광교클라우드시티</SelectItem>
                      <SelectItem value="평택 로제비앙">평택 로제비앙</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 개인 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>개인 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gender">성별</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">남성</SelectItem>
                      <SelectItem value="FEMALE">여성</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ageRange">나이대</Label>
                  <Select value={formData.ageRange} onValueChange={(value) => handleInputChange('ageRange', value)}>
                    <SelectTrigger id="ageRange">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TWENTIES">20대</SelectItem>
                      <SelectItem value="THIRTIES">30대</SelectItem>
                      <SelectItem value="FORTIES">40대</SelectItem>
                      <SelectItem value="FIFTIES">50대</SelectItem>
                      <SelectItem value="SIXTIES_PLUS">60대 이상</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="residenceArea">거주지역</Label>
                  <Input
                    id="residenceArea"
                    value={formData.residenceArea}
                    onChange={(e) => handleInputChange('residenceArea', e.target.value)}
                    placeholder="예: 강남구, 송파구"
                  />
                </div>
                <div>
                  <Label htmlFor="familyRelation">가족관계</Label>
                  <Input
                    id="familyRelation"
                    value={formData.familyRelation}
                    onChange={(e) => handleInputChange('familyRelation', e.target.value)}
                    placeholder="예: 기혼, 미혼, 자녀 2명"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="occupation">직업</Label>
                <Input
                  id="occupation"
                  value={formData.occupation}
                  onChange={(e) => handleInputChange('occupation', e.target.value)}
                  placeholder="예: 회사원, 자영업"
                />
              </div>
            </CardContent>
          </Card>

          {/* 영업 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>영업 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="source">고객 출처</Label>
                  <Select value={formData.source} onValueChange={(value) => handleInputChange('source', value)}>
                    <SelectTrigger id="source">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AD">광고</SelectItem>
                      <SelectItem value="TM">TM</SelectItem>
                      <SelectItem value="FIELD">필드</SelectItem>
                      <SelectItem value="REFERRAL">소개</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="grade">고객 등급</Label>
                  <Select value={formData.grade} onValueChange={(value) => handleInputChange('grade', value)}>
                    <SelectTrigger id="grade">
                      <SelectValue placeholder="선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A등급 (VIP - 관심카드 표시)</SelectItem>
                      <SelectItem value="B">B등급</SelectItem>
                      <SelectItem value="C">C등급</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">A등급 고객은 관심카드 페이지에 표시됩니다</p>
                </div>
              </div>

              <div>
                <Label>투자 성향 (복수 선택 가능)</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="timeProfit"
                      checked={formData.investmentStyle.timeProfit}
                      onCheckedChange={() => handleInvestmentStyleChange('timeProfit')}
                    />
                    <label htmlFor="timeProfit" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      시세차익
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="monthlyIncome"
                      checked={formData.investmentStyle.monthlyIncome}
                      onCheckedChange={() => handleInvestmentStyleChange('monthlyIncome')}
                    />
                    <label htmlFor="monthlyIncome" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      월수익
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="residence"
                      checked={formData.investmentStyle.residence}
                      onCheckedChange={() => handleInvestmentStyleChange('residence')}
                    />
                    <label htmlFor="residence" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      실거주
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="expectedBudget">예상 투자 가능 금액 (만원)</Label>
                <Input
                  id="expectedBudget"
                  type="number"
                  value={formData.expectedBudget}
                  onChange={(e) => handleInputChange('expectedBudget', e.target.value)}
                  placeholder="예: 10000 (1억원)"
                />
                <p className="text-xs text-gray-500 mt-1">계약금 기준으로 입력해주세요</p>
              </div>

              <div>
                <Label>관심 부동산 (복수 선택 가능)</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="apt"
                      checked={formData.ownedProperties.apt}
                      onCheckedChange={() => handleOwnedPropertiesChange('apt')}
                    />
                    <label htmlFor="apt" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      아파트
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="officetel"
                      checked={formData.ownedProperties.officetel}
                      onCheckedChange={() => handleOwnedPropertiesChange('officetel')}
                    />
                    <label htmlFor="officetel" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      오피스텔
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="commercial"
                      checked={formData.ownedProperties.commercial}
                      onCheckedChange={() => handleOwnedPropertiesChange('commercial')}
                    />
                    <label htmlFor="commercial" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      상가
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="building"
                      checked={formData.ownedProperties.building}
                      onCheckedChange={() => handleOwnedPropertiesChange('building')}
                    />
                    <label htmlFor="building" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      빌딩
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="recentVisitedMH">최근 방문 모델하우스</Label>
                <Input
                  id="recentVisitedMH"
                  value={formData.recentVisitedMH}
                  onChange={(e) => handleInputChange('recentVisitedMH', e.target.value)}
                  placeholder="예: 힐스테이트 강남 모델하우스"
                />
              </div>
            </CardContent>
          </Card>

          {/* 제출 버튼 */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/customers')}
              disabled={loading}
            >
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? '등록 중...' : '고객 등록'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
