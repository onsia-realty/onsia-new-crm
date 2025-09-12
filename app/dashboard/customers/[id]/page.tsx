'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  User, Phone, Mail, MapPin, Calendar, Clock, MessageSquare,
  Building, Home, DollarSign, TrendingUp, FileText, ChevronLeft,
  Edit2, Save, X, Plus, PhoneCall, CalendarPlus
} from 'lucide-react';

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  memo?: string;
  interestCards: InterestCard[];
  callLogs: CallLog[];
  visitSchedules: VisitSchedule[];
}

interface InterestCard {
  id: string;
  propertyType: string;
  transactionType: string;
  location: string;
  priceRange?: string;
  area?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  memo?: string;
}

interface CallLog {
  id: string;
  callType: 'INBOUND' | 'OUTBOUND';
  duration?: number;
  result?: string;
  comment: string;
  nextAction?: string;
  createdAt: string;
  user: { name: string };
}

interface VisitSchedule {
  id: string;
  visitDate: string;
  visitType: string;
  location: string;
  status: string;
  memo?: string;
  user: { name: string };
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  
  // 편집 상태
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    memo: ''
  });
  
  // 새 통화 기록
  const [newCallLog, setNewCallLog] = useState({
    callType: 'OUTBOUND',
    duration: '',
    result: '',
    comment: '',
    nextAction: ''
  });
  
  // 새 방문 일정
  const [newVisit, setNewVisit] = useState({
    visitDate: '',
    visitType: 'PROPERTY_VIEWING',
    location: '',
    memo: ''
  });

  useEffect(() => {
    fetchCustomerData();
  }, [params.id]);

  const fetchCustomerData = async () => {
    try {
      const response = await fetch(`/api/customers/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setCustomer(data);
        setEditData({
          name: data.name,
          phone: data.phone,
          email: data.email || '',
          address: data.address || '',
          memo: data.memo || ''
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '고객 정보를 불러오는데 실패했습니다.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      
      if (response.ok) {
        await fetchCustomerData();
        setIsEditing(false);
        toast({
          title: '성공',
          description: '고객 정보가 수정되었습니다.'
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '수정에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleAddCallLog = async () => {
    if (!newCallLog.comment) {
      toast({
        title: '오류',
        description: '통화 내용을 입력해주세요.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch('/api/call-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: params.id,
          ...newCallLog,
          duration: newCallLog.duration ? parseInt(newCallLog.duration) : null
        })
      });
      
      if (response.ok) {
        await fetchCustomerData();
        setNewCallLog({
          callType: 'OUTBOUND',
          duration: '',
          result: '',
          comment: '',
          nextAction: ''
        });
        toast({
          title: '성공',
          description: '통화 기록이 추가되었습니다.'
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '통화 기록 추가에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  const handleAddVisit = async () => {
    if (!newVisit.visitDate || !newVisit.location) {
      toast({
        title: '오류',
        description: '방문 일정과 장소를 입력해주세요.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch('/api/visit-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: params.id,
          ...newVisit
        })
      });
      
      if (response.ok) {
        await fetchCustomerData();
        setNewVisit({
          visitDate: '',
          visitType: 'PROPERTY_VIEWING',
          location: '',
          memo: ''
        });
        toast({
          title: '성공',
          description: '방문 일정이 추가되었습니다.'
        });
      }
    } catch (error) {
      toast({
        title: '오류',
        description: '방문 일정 추가에 실패했습니다.',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>고객 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPropertyTypeIcon = (type: string) => {
    switch (type) {
      case 'APARTMENT': return <Building className="w-4 h-4" />;
      case 'HOUSE': return <Home className="w-4 h-4" />;
      default: return <Building className="w-4 h-4" />;
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
              <h1 className="text-2xl font-bold">고객 상세 정보</h1>
            </div>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                수정
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleSaveCustomer}>
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  취소
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 고객 기본 정보 카드 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>고객 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <Label htmlFor="name">이름</Label>
                      <Input
                        id="name"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">전화번호</Label>
                      <Input
                        id="phone"
                        value={editData.phone}
                        onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">이메일</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">주소</Label>
                      <Input
                        id="address"
                        value={editData.address}
                        onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="memo">메모</Label>
                      <Textarea
                        id="memo"
                        value={editData.memo}
                        onChange={(e) => setEditData({ ...editData, memo: e.target.value })}
                        rows={4}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">이름</p>
                        <p className="font-medium">{customer.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">전화번호</p>
                        <p className="font-medium">{customer.phone}</p>
                      </div>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">이메일</p>
                          <p className="font-medium">{customer.email}</p>
                        </div>
                      </div>
                    )}
                    {customer.address && (
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">주소</p>
                          <p className="font-medium">{customer.address}</p>
                        </div>
                      </div>
                    )}
                    {customer.memo && (
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">메모</p>
                          <p className="text-sm">{customer.memo}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* 관심 카드 */}
            {customer.interestCards.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>관심 매물</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {customer.interestCards.map((card) => (
                    <div key={card.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getPropertyTypeIcon(card.propertyType)}
                          <span className="font-medium text-sm">
                            {card.propertyType === 'APARTMENT' ? '아파트' : 
                             card.propertyType === 'HOUSE' ? '주택' : card.propertyType}
                          </span>
                        </div>
                        <Badge className={getPriorityColor(card.priority)}>
                          {card.priority === 'HIGH' ? '높음' : 
                           card.priority === 'MEDIUM' ? '보통' : '낮음'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {card.transactionType === 'SALE' ? '매매' : 
                         card.transactionType === 'RENT' ? '월세' : '전세'}
                      </p>
                      <p className="text-sm font-medium">{card.location}</p>
                      {card.priceRange && (
                        <p className="text-sm text-gray-600">{card.priceRange}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* 오른쪽: 활동 기록 */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="calls">통화 기록</TabsTrigger>
                <TabsTrigger value="visits">방문 일정</TabsTrigger>
              </TabsList>

              {/* 통화 기록 탭 */}
              <TabsContent value="calls" className="space-y-4">
                {/* 새 통화 기록 추가 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">새 통화 기록</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>통화 유형</Label>
                        <Select
                          value={newCallLog.callType}
                          onValueChange={(value) => setNewCallLog({ ...newCallLog, callType: value as 'INBOUND' | 'OUTBOUND' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INBOUND">수신</SelectItem>
                            <SelectItem value="OUTBOUND">발신</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>통화 시간(초)</Label>
                        <Input
                          type="number"
                          placeholder="예: 120"
                          value={newCallLog.duration}
                          onChange={(e) => setNewCallLog({ ...newCallLog, duration: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>통화 결과</Label>
                      <Input
                        placeholder="예: 상담 완료, 부재중, 다시 연락 요청"
                        value={newCallLog.result}
                        onChange={(e) => setNewCallLog({ ...newCallLog, result: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>통화 내용 *</Label>
                      <Textarea
                        placeholder="통화 내용을 자세히 기록해주세요"
                        value={newCallLog.comment}
                        onChange={(e) => setNewCallLog({ ...newCallLog, comment: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label>후속 조치</Label>
                      <Input
                        placeholder="예: 내일 오후 2시 재통화, 방문 일정 조율"
                        value={newCallLog.nextAction}
                        onChange={(e) => setNewCallLog({ ...newCallLog, nextAction: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddCallLog} className="w-full">
                      <PhoneCall className="w-4 h-4 mr-2" />
                      통화 기록 추가
                    </Button>
                  </CardContent>
                </Card>

                {/* 통화 기록 목록 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">통화 기록</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {customer.callLogs.length > 0 ? (
                      <div className="space-y-4">
                        {customer.callLogs.map((log) => (
                          <div key={log.id} className="border-l-4 border-blue-500 pl-4 py-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Badge variant={log.callType === 'INBOUND' ? 'secondary' : 'default'}>
                                  {log.callType === 'INBOUND' ? '수신' : '발신'}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                  {format(new Date(log.createdAt), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                                </span>
                                {log.duration && (
                                  <span className="text-sm text-gray-500">
                                    {Math.floor(log.duration / 60)}분 {log.duration % 60}초
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">{log.user.name}</span>
                            </div>
                            {log.result && (
                              <p className="text-sm font-medium mb-1">결과: {log.result}</p>
                            )}
                            <p className="text-sm text-gray-700">{log.comment}</p>
                            {log.nextAction && (
                              <p className="text-sm text-blue-600 mt-2">→ {log.nextAction}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8">통화 기록이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 방문 일정 탭 */}
              <TabsContent value="visits" className="space-y-4">
                {/* 새 방문 일정 추가 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">새 방문 일정</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>방문 일시 *</Label>
                        <Input
                          type="datetime-local"
                          value={newVisit.visitDate}
                          onChange={(e) => setNewVisit({ ...newVisit, visitDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>방문 유형</Label>
                        <Select
                          value={newVisit.visitType}
                          onValueChange={(value) => setNewVisit({ ...newVisit, visitType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PROPERTY_VIEWING">매물 방문</SelectItem>
                            <SelectItem value="CONTRACT_MEETING">계약 미팅</SelectItem>
                            <SelectItem value="CONSULTATION">상담</SelectItem>
                            <SelectItem value="OTHER">기타</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>방문 장소 *</Label>
                      <Input
                        placeholder="예: 강남구 역삼동 123-45 아파트"
                        value={newVisit.location}
                        onChange={(e) => setNewVisit({ ...newVisit, location: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>메모</Label>
                      <Textarea
                        placeholder="방문 관련 메모를 입력해주세요"
                        value={newVisit.memo}
                        onChange={(e) => setNewVisit({ ...newVisit, memo: e.target.value })}
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleAddVisit} className="w-full">
                      <CalendarPlus className="w-4 h-4 mr-2" />
                      방문 일정 추가
                    </Button>
                  </CardContent>
                </Card>

                {/* 방문 일정 목록 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">방문 일정</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {customer.visitSchedules.length > 0 ? (
                      <div className="space-y-4">
                        {customer.visitSchedules.map((visit) => (
                          <div key={visit.id} className="border-l-4 border-green-500 pl-4 py-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">
                                  {format(new Date(visit.visitDate), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })}
                                </span>
                                <Badge>
                                  {visit.visitType === 'PROPERTY_VIEWING' ? '매물 방문' :
                                   visit.visitType === 'CONTRACT_MEETING' ? '계약 미팅' :
                                   visit.visitType === 'CONSULTATION' ? '상담' : '기타'}
                                </Badge>
                              </div>
                              <span className="text-sm text-gray-500">{visit.user.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <MapPin className="w-4 h-4" />
                              {visit.location}
                            </div>
                            {visit.memo && (
                              <p className="text-sm text-gray-600 mt-2">{visit.memo}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8">방문 일정이 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}