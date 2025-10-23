'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, Save, Edit2, Trash2, Send, X, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  name: string;
  phone: string;
  memo: string | null;
  nextVisitDate: string | null;
  assignedSite: string | null;
  gender: string | null;
  ageRange: string | null;
  residenceArea: string | null;
  familyRelation: string | null;
  occupation: string | null;
  source: string | null;
  grade: string;
  investmentStyle: string | null;
  expectedBudget: number | null;
  ownedProperties: string | null;
  recentVisitedMH: string | null;
  visitSchedules: Array<{
    id: string;
    visitDate: string;
    visitType: string;
    location: string;
    status: string;
  }>;
}

interface CallLog {
  id: string;
  content: string;
  note: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
  };
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newCallLog, setNewCallLog] = useState('');
  const [editingCallLogId, setEditingCallLogId] = useState<string | null>(null);
  const [editingCallLogContent, setEditingCallLogContent] = useState('');

  // 폼 데이터 (수정 모드용)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    memo: '',
    nextVisitDate: undefined as Date | undefined,
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

  useEffect(() => {
    fetchCustomer();
    fetchCallLogs();
  }, [customerId]);

  const fetchCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}`);
      const result = await response.json();

      if (result.success) {
        setCustomer(result.data);
        // 폼 데이터 초기화
        const c = result.data;
        setFormData({
          name: c.name,
          phone: c.phone,
          memo: c.memo || '',
          nextVisitDate: c.nextVisitDate ? new Date(c.nextVisitDate) : undefined,
          assignedSite: c.assignedSite || '',
          gender: c.gender || '',
          ageRange: c.ageRange || '',
          residenceArea: c.residenceArea || '',
          familyRelation: c.familyRelation || '',
          occupation: c.occupation || '',
          source: c.source || '',
          grade: c.grade || 'C',
          investmentStyle: c.investmentStyle ? JSON.parse(c.investmentStyle) : {
            timeProfit: false,
            monthlyIncome: false,
            residence: false
          },
          expectedBudget: c.expectedBudget ? String(c.expectedBudget) : '',
          ownedProperties: c.ownedProperties ? JSON.parse(c.ownedProperties) : {
            apt: false,
            officetel: false,
            commercial: false,
            building: false
          },
          recentVisitedMH: c.recentVisitedMH || ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch customer:', error);
      toast({
        title: '오류',
        description: '고객 정보를 불러오는데 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCallLogs = async () => {
    try {
      const response = await fetch(`/api/call-logs?customerId=${customerId}`);
      const result = await response.json();

      if (result.success) {
        setCallLogs(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch call logs:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
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
          grade: formData.grade,
          investmentStyle: JSON.stringify(formData.investmentStyle),
          expectedBudget: formData.expectedBudget ? parseInt(formData.expectedBudget) : undefined,
          ownedProperties: JSON.stringify(formData.ownedProperties),
          recentVisitedMH: formData.recentVisitedMH || undefined
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: '성공',
          description: '고객 정보가 수정되었습니다.'
        });
        setIsEditing(false);
        fetchCustomer();
      } else {
        throw new Error(result.error || '수정 실패');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '고객 정보 수정에 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCallLog = async () => {
    if (!newCallLog.trim()) return;

    try {
      const response = await fetch('/api/call-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId,
          content: newCallLog
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '성공',
          description: '통화 기록이 등록되었습니다.'
        });
        setNewCallLog('');
        fetchCallLogs();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error adding call log:', error);
      toast({
        title: '오류',
        description: '통화 기록 등록에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateCallLog = async (id: string) => {
    try {
      const response = await fetch(`/api/call-logs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editingCallLogContent
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '성공',
          description: '통화 기록이 수정되었습니다.'
        });
        setEditingCallLogId(null);
        setEditingCallLogContent('');
        fetchCallLogs();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error updating call log:', error);
      toast({
        title: '오류',
        description: '통화 기록 수정에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteCallLog = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/call-logs/${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '성공',
          description: '통화 기록이 삭제되었습니다.'
        });
        fetchCallLogs();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error deleting call log:', error);
      toast({
        title: '오류',
        description: '통화 기록 삭제에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleInvestmentStyleChange = (field: keyof typeof formData.investmentStyle) => {
    setFormData(prev => ({
      ...prev,
      investmentStyle: {
        ...prev.investmentStyle,
        [field]: !prev.investmentStyle[field]
      }
    }));
  };

  const handleOwnedPropertiesChange = (field: keyof typeof formData.ownedProperties) => {
    setFormData(prev => ({
      ...prev,
      ownedProperties: {
        ...prev.ownedProperties,
        [field]: !prev.ownedProperties[field]
      }
    }));
  };

  const formatPhoneDisplay = (phone: string) => {
    if (phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }
    return phone;
  };

  const parseProperties = (json: string | null) => {
    if (!json) return '없음';
    try {
      const props = JSON.parse(json);
      const types = [];
      if (props.apt) types.push('아파트');
      if (props.officetel) types.push('오피스텔');
      if (props.commercial) types.push('상가');
      if (props.building) types.push('빌딩');
      return types.length > 0 ? types.join(', ') : '없음';
    } catch {
      return '없음';
    }
  };

  const parseInvestmentStyle = (json: string | null) => {
    if (!json) return '없음';
    try {
      const style = JSON.parse(json);
      const types = [];
      if (style.timeProfit) types.push('시세차익');
      if (style.monthlyIncome) types.push('월수익');
      if (style.residence) types.push('실거주');
      return types.length > 0 ? types.join(', ') : '없음';
    } catch {
      return '없음';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">고객을 찾을 수 없습니다.</div>
      </div>
    );
  }

  // 수정 모드 렌더링
  if (isEditing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  취소
                </Button>
                <h1 className="text-2xl font-bold">고객 정보 수정</h1>
              </div>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                저장
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">전화번호</Label>
                  <Input
                    id="phone"
                    value={formatPhoneDisplay(formData.phone)}
                    onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="memo">메모</Label>
                <Textarea
                  id="memo"
                  value={formData.memo}
                  onChange={(e) => handleInputChange('memo', e.target.value)}
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
                  />
                </div>
                <div>
                  <Label htmlFor="familyRelation">가족관계</Label>
                  <Input
                    id="familyRelation"
                    value={formData.familyRelation}
                    onChange={(e) => handleInputChange('familyRelation', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="occupation">직업</Label>
                <Input
                  id="occupation"
                  value={formData.occupation}
                  onChange={(e) => handleInputChange('occupation', e.target.value)}
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
                      <SelectItem value="A">A등급 (VIP)</SelectItem>
                      <SelectItem value="B">B등급</SelectItem>
                      <SelectItem value="C">C등급</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>투자 성향</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="timeProfit"
                      checked={formData.investmentStyle.timeProfit}
                      onCheckedChange={() => handleInvestmentStyleChange('timeProfit')}
                    />
                    <label htmlFor="timeProfit" className="text-sm">시세차익</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="monthlyIncome"
                      checked={formData.investmentStyle.monthlyIncome}
                      onCheckedChange={() => handleInvestmentStyleChange('monthlyIncome')}
                    />
                    <label htmlFor="monthlyIncome" className="text-sm">월수익</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="residence"
                      checked={formData.investmentStyle.residence}
                      onCheckedChange={() => handleInvestmentStyleChange('residence')}
                    />
                    <label htmlFor="residence" className="text-sm">실거주</label>
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
                />
              </div>

              <div>
                <Label>관심 부동산</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="apt"
                      checked={formData.ownedProperties.apt}
                      onCheckedChange={() => handleOwnedPropertiesChange('apt')}
                    />
                    <label htmlFor="apt" className="text-sm">아파트</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="officetel"
                      checked={formData.ownedProperties.officetel}
                      onCheckedChange={() => handleOwnedPropertiesChange('officetel')}
                    />
                    <label htmlFor="officetel" className="text-sm">오피스텔</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="commercial"
                      checked={formData.ownedProperties.commercial}
                      onCheckedChange={() => handleOwnedPropertiesChange('commercial')}
                    />
                    <label htmlFor="commercial" className="text-sm">상가</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="building"
                      checked={formData.ownedProperties.building}
                      onCheckedChange={() => handleOwnedPropertiesChange('building')}
                    />
                    <label htmlFor="building" className="text-sm">빌딩</label>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="recentVisitedMH">최근 방문 모델하우스</Label>
                <Input
                  id="recentVisitedMH"
                  value={formData.recentVisitedMH}
                  onChange={(e) => handleInputChange('recentVisitedMH', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // 보기 모드 렌더링
  return (
    <div className="min-h-screen bg-gray-50">
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
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              {customer.grade === 'A' && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                  A등급 VIP
                </span>
              )}
            </div>
            <Button onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              수정
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">이름</span>
                <span className="font-medium">{customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">전화번호</span>
                <span className="font-medium">{formatPhoneDisplay(customer.phone)}</span>
              </div>
              {customer.memo && (
                <div>
                  <div className="text-muted-foreground mb-1">메모</div>
                  <div className="text-sm bg-gray-50 p-2 rounded">{customer.memo}</div>
                </div>
              )}

              <div className="pt-3 border-t space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">방문 예정일</span>
                  <span className="font-medium">
                    {customer.nextVisitDate ? format(new Date(customer.nextVisitDate), 'yyyy년 MM월 dd일', { locale: ko }) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">현장명</span>
                  <span className="font-medium">{customer.assignedSite || '-'}</span>
                </div>
              </div>

              {/* 방문일정 (주소 밑에 표시) */}
              {customer.visitSchedules && customer.visitSchedules.length > 0 && (
                <div className="pt-3 border-t">
                  <div className="text-sm font-medium mb-2">다음 방문 일정</div>
                  {customer.visitSchedules.slice(0, 3).map((visit) => (
                    <div key={visit.id} className="text-sm bg-blue-50 p-2 rounded mb-2">
                      <div className="font-medium">{format(new Date(visit.visitDate), 'yyyy-MM-dd HH:mm')}</div>
                      <div className="text-muted-foreground">{visit.location}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 개인 정보 */}
          <Card>
            <CardHeader>
              <CardTitle>개인 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">성별</span>
                <span className="font-medium">
                  {customer.gender === 'MALE' ? '남성' : customer.gender === 'FEMALE' ? '여성' : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">나이대</span>
                <span className="font-medium">
                  {customer.ageRange === 'TWENTIES' ? '20대' :
                   customer.ageRange === 'THIRTIES' ? '30대' :
                   customer.ageRange === 'FORTIES' ? '40대' :
                   customer.ageRange === 'FIFTIES' ? '50대' :
                   customer.ageRange === 'SIXTIES_PLUS' ? '60대 이상' : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">거주지역</span>
                <span className="font-medium">{customer.residenceArea || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">가족관계</span>
                <span className="font-medium">{customer.familyRelation || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">직업</span>
                <span className="font-medium">{customer.occupation || '-'}</span>
              </div>
            </CardContent>
          </Card>

          {/* 영업 정보 */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>영업 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">고객 출처</span>
                <span className="font-medium">
                  {customer.source === 'AD' ? '광고' :
                   customer.source === 'TM' ? 'TM' :
                   customer.source === 'FIELD' ? '필드' :
                   customer.source === 'REFERRAL' ? '소개' : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">고객 등급</span>
                <span className="font-medium">{customer.grade}등급</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">투자 성향</span>
                <span className="font-medium">{parseInvestmentStyle(customer.investmentStyle)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">예상 투자금액</span>
                <span className="font-medium">
                  {customer.expectedBudget ? `${customer.expectedBudget.toLocaleString()}만원` : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">관심 부동산</span>
                <span className="font-medium">{parseProperties(customer.ownedProperties)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">최근 방문 MH</span>
                <span className="font-medium">{customer.recentVisitedMH || '-'}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 통화 기록 */}
        <Card>
          <CardHeader>
            <CardTitle>통화 기록</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 새 통화 기록 입력 */}
            <div className="flex gap-2">
              <Input
                placeholder="통화 내용을 입력하세요..."
                value={newCallLog}
                onChange={(e) => setNewCallLog(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddCallLog();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={handleAddCallLog} disabled={!newCallLog.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* 통화 기록 리스트 */}
            <div className="space-y-3">
              {callLogs.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  통화 기록이 없습니다.
                </div>
              ) : (
                callLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 bg-white">
                    {editingCallLogId === log.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editingCallLogContent}
                          onChange={(e) => setEditingCallLogContent(e.target.value)}
                          className="flex-1"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCallLogId(null);
                              setEditingCallLogContent('');
                            }}
                          >
                            <X className="w-3 h-3 mr-1" />
                            취소
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUpdateCallLog(log.id)}
                          >
                            <Save className="w-3 h-3 mr-1" />
                            저장
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-sm text-muted-foreground">
                            {log.user.name} • {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm')}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCallLogId(log.id);
                                setEditingCallLogContent(log.content);
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCallLog(log.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm">{log.content}</div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
