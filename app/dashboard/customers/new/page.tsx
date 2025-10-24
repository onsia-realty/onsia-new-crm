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
import { ChevronLeft, ChevronRight, Save, AlertCircle, CalendarIcon, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DuplicatePhoneModal } from '@/components/modals/DuplicatePhoneModal';

interface FormData {
  // 기본 정보
  name: string;
  phone: string;

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

  // 추가 정보
  nextVisitDate: Date | undefined;
  assignedSite: string;
  recentVisitedMH: string;
  memo: string;
}

const STEPS = [
  { id: 1, title: '기본 정보', description: '전화번호 (이름은 선택사항)' },
  { id: 2, title: '개인 정보', description: '성별, 나이, 거주지' },
  { id: 3, title: '영업 정보', description: '투자성향, 예산' },
  { id: 4, title: '추가 정보', description: '방문일정, 메모' },
  { id: 5, title: '최종 확인', description: '입력 내용 확인' }
];

interface DuplicateCustomer {
  id: string;
  name?: string | null;
  phone: string;
  email?: string | null;
  createdAt: string;
  assignedUser?: {
    id: string;
    name: string;
    role: string;
    teamId?: string;
  } | null;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [duplicatePhoneModal, setDuplicatePhoneModal] = useState({
    isOpen: false,
    phone: '',
    duplicates: [] as DuplicateCustomer[],
    isLoading: false
  });

  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
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
    nextVisitDate: undefined,
    assignedSite: '',
    recentVisitedMH: '',
    memo: ''
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
    const numbersOnly = value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, phone: numbersOnly }));
    setDuplicatePhoneModal(prev => ({ ...prev, isOpen: false }));
  };

  const formatPhoneDisplay = (phone: string) => {
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }
    if (phone.length === 10) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
  };

  const validateStep = (step: number) => {
    if (step === 1) {
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
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    // 1단계에서 전화번호 중복 체크
    if (currentStep === 1 && formData.phone) {
      try {
        const checkResponse = await fetch(`/api/customers/check-duplicate?phone=${formData.phone}`);
        if (checkResponse.ok) {
          const checkResult = await checkResponse.json();
          if (checkResult.exists && checkResult.customers && checkResult.customers.length > 0) {
            setDuplicatePhoneModal({
              isOpen: true,
              phone: formData.phone,
              duplicates: checkResult.customers,
              isLoading: false
            });
            return;
          }
        }
      } catch (error) {
        console.error('Error checking duplicate:', error);
      }
    }

    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };

  const handleDuplicateContinue = () => {
    setDuplicatePhoneModal(prev => ({ ...prev, isOpen: false }));
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  };

  const handleDuplicateCancel = () => {
    setDuplicatePhoneModal(prev => ({ ...prev, isOpen: false }));
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
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


  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">
                  이름 <span className="text-gray-500 text-xs">(선택사항 - 입력하지 않으면 자동 생성됨)</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="홍길동 (선택사항)"
                  className="text-lg"
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
                  className="text-lg"
                />
                <p className="text-xs text-gray-500 mt-1">숫자만 입력해주세요 (자동으로 형식이 적용됩니다)</p>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
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
        );

      case 3:
        return (
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
                      <SelectItem value="A">A등급 (VIP)</SelectItem>
                      <SelectItem value="B">B등급</SelectItem>
                      <SelectItem value="C">C등급</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">A등급 고객은 관심카드에 표시됩니다</p>
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
                <Label>관심 부동산 유형 (복수 선택 가능)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
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
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>추가 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div>
                <Label htmlFor="recentVisitedMH">최근 방문 모델하우스</Label>
                <Input
                  id="recentVisitedMH"
                  value={formData.recentVisitedMH}
                  onChange={(e) => handleInputChange('recentVisitedMH', e.target.value)}
                  placeholder="예: 힐스테이트 강남 모델하우스"
                />
              </div>

              <div>
                <Label htmlFor="memo">메모</Label>
                <Textarea
                  id="memo"
                  value={formData.memo}
                  onChange={(e) => handleInputChange('memo', e.target.value)}
                  placeholder="고객에 대한 특이사항이나 메모를 입력하세요"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        );

      case 5:
        return (
          <Card>
            <CardHeader>
              <CardTitle>최종 확인</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-gray-500 mb-2">기본 정보</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p><span className="font-medium">이름:</span> {formData.name ? formData.name : `(자동생성: 고객_${formatPhoneDisplay(formData.phone).slice(-4)})`}</p>
                    <p><span className="font-medium">전화번호:</span> {formatPhoneDisplay(formData.phone)}</p>
                  </div>
                </div>

                {(formData.gender || formData.ageRange || formData.residenceArea || formData.familyRelation || formData.occupation) && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500 mb-2">개인 정보</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      {formData.gender && <p><span className="font-medium">성별:</span> {formData.gender === 'MALE' ? '남성' : '여성'}</p>}
                      {formData.ageRange && <p><span className="font-medium">나이대:</span> {
                        formData.ageRange === 'TWENTIES' ? '20대' :
                        formData.ageRange === 'THIRTIES' ? '30대' :
                        formData.ageRange === 'FORTIES' ? '40대' :
                        formData.ageRange === 'FIFTIES' ? '50대' :
                        '60대 이상'
                      }</p>}
                      {formData.residenceArea && <p><span className="font-medium">거주지역:</span> {formData.residenceArea}</p>}
                      {formData.familyRelation && <p><span className="font-medium">가족관계:</span> {formData.familyRelation}</p>}
                      {formData.occupation && <p><span className="font-medium">직업:</span> {formData.occupation}</p>}
                    </div>
                  </div>
                )}

                {(formData.source || formData.grade || formData.expectedBudget) && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500 mb-2">영업 정보</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      {formData.source && <p><span className="font-medium">고객 출처:</span> {
                        formData.source === 'AD' ? '광고' :
                        formData.source === 'TM' ? 'TM' :
                        formData.source === 'FIELD' ? '필드' :
                        '소개'
                      }</p>}
                      {formData.grade && <p><span className="font-medium">고객 등급:</span> {formData.grade}등급</p>}
                      {(formData.investmentStyle.timeProfit || formData.investmentStyle.monthlyIncome || formData.investmentStyle.residence) && (
                        <p><span className="font-medium">투자 성향:</span> {
                          [
                            formData.investmentStyle.timeProfit && '시세차익',
                            formData.investmentStyle.monthlyIncome && '월수익',
                            formData.investmentStyle.residence && '실거주'
                          ].filter(Boolean).join(', ')
                        }</p>
                      )}
                      {formData.expectedBudget && <p><span className="font-medium">예상 투자 가능 금액:</span> {parseInt(formData.expectedBudget).toLocaleString()}만원</p>}
                      {(formData.ownedProperties.apt || formData.ownedProperties.officetel || formData.ownedProperties.commercial || formData.ownedProperties.building) && (
                        <p><span className="font-medium">관심 부동산:</span> {
                          [
                            formData.ownedProperties.apt && '아파트',
                            formData.ownedProperties.officetel && '오피스텔',
                            formData.ownedProperties.commercial && '상가',
                            formData.ownedProperties.building && '빌딩'
                          ].filter(Boolean).join(', ')
                        }</p>
                      )}
                    </div>
                  </div>
                )}

                {(formData.nextVisitDate || formData.assignedSite || formData.recentVisitedMH || formData.memo) && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-500 mb-2">추가 정보</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      {formData.nextVisitDate && <p><span className="font-medium">방문 예정일:</span> {format(formData.nextVisitDate, 'PPP', { locale: ko })}</p>}
                      {formData.assignedSite && <p><span className="font-medium">현장명:</span> {formData.assignedSite}</p>}
                      {formData.recentVisitedMH && <p><span className="font-medium">최근 방문 MH:</span> {formData.recentVisitedMH}</p>}
                      {formData.memo && <p><span className="font-medium">메모:</span> {formData.memo}</p>}
                    </div>
                  </div>
                )}
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  위 정보로 고객을 등록하시겠습니까? 등록 후에도 수정이 가능합니다.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DuplicatePhoneModal
        isOpen={duplicatePhoneModal.isOpen}
        phone={duplicatePhoneModal.phone}
        duplicates={duplicatePhoneModal.duplicates}
        onContinue={handleDuplicateContinue}
        onCancel={handleDuplicateCancel}
        isLoading={duplicatePhoneModal.isLoading}
      />

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

      {/* 진행 표시기 */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors',
                      currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    )}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="mt-2 text-center">
                    <p className={cn(
                      'text-sm font-medium',
                      currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'
                    )}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'h-1 flex-1 mx-2 transition-colors',
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 폼 컨텐츠 */}
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {renderStepContent()}

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1 || loading}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            이전
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={loading}
            >
              다음
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? '등록 중...' : '고객 등록'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
