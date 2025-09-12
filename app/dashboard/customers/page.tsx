'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Plus, User, Phone, Calendar, MessageSquare,
  MapPin, Building, TrendingUp, Filter, Download, Upload
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  memo?: string;
  assignedUser?: { name: string };
  _count?: {
    interestCards: number;
    callLogs: number;
    visitSchedules: number;
  };
  lastContact?: string;
  nextSchedule?: string;
}

interface Statistics {
  totalCustomers: number;
  todayCallLogs: number;
  scheduledVisits: number;
  activeDeals: number;
}

export default function CustomersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({
    totalCustomers: 0,
    todayCallLogs: 0,
    scheduledVisits: 0,
    activeDeals: 0
  });

  useEffect(() => {
    fetchCustomers();
    fetchStatistics();
  }, []);

  useEffect(() => {
    const filtered = customers.filter(customer =>
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.includes(searchTerm) ||
      customer.address?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

  const fetchStatistics = async () => {
    try {
      const response = await fetch('/api/statistics');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setStatistics(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const result = await response.json();
        // API가 { success: true, data: customers } 형식으로 반환
        const customersData = result.data || [];
        setCustomers(customersData);
        setFilteredCustomers(customersData);
      } else {
        throw new Error('Failed to fetch customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: '오류',
        description: '고객 목록을 불러오는데 실패했습니다.',
        variant: 'destructive'
      });
      // 에러 시 빈 배열로 초기화
      setCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerClick = (customerId: string) => {
    router.push(`/dashboard/customers/${customerId}`);
  };

  const handleAddCustomer = () => {
    router.push('/dashboard/customers/new');
  };

  const formatPhoneNumber = (phone: string) => {
    // 010-1234-5678 형식으로 변환
    if (phone && phone.length === 11) {
      return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
    }
    return phone || '';
  };

  // 통계를 새로고침하는 함수 (통화 기록 추가 후 호출용)
  const refreshStatistics = () => {
    fetchStatistics();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">고객 관리</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                일괄 등록
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                내보내기
              </Button>
              <Button onClick={handleAddCustomer}>
                <Plus className="w-4 h-4 mr-2" />
                신규 고객
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="이름, 전화번호, 주소로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              필터
            </Button>
          </div>
        </div>

        {/* 통계 카드 - 실제 데이터 반영 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">전체 고객</p>
                  <p className="text-2xl font-bold">{statistics.totalCustomers}</p>
                </div>
                <User className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">오늘 통화</p>
                  <p className="text-2xl font-bold">{statistics.todayCallLogs}</p>
                  {statistics.todayCallLogs > 0 && (
                    <p className="text-xs text-green-600 mt-1">+{statistics.todayCallLogs} 건</p>
                  )}
                </div>
                <Phone className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">예정 방문</p>
                  <p className="text-2xl font-bold">{statistics.scheduledVisits}</p>
                </div>
                <Calendar className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">진행중 거래</p>
                  <p className="text-2xl font-bold">{statistics.activeDeals}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 고객 카드 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.isArray(filteredCustomers) && filteredCustomers.map((customer) => (
            <Card
              key={customer.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleCustomerClick(customer.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{customer.name || '이름 없음'}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {formatPhoneNumber(customer.phone)}
                      </p>
                    </div>
                  </div>
                  {customer.assignedUser && (
                    <Badge variant="outline" className="text-xs">
                      {customer.assignedUser.name}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 주소 정보 */}
                {customer.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <p className="text-sm text-gray-600 line-clamp-1">
                      {customer.address}
                    </p>
                  </div>
                )}

                {/* 활동 통계 */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    <span>관심 {customer._count?.interestCards || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>통화 {customer._count?.callLogs || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>방문 {customer._count?.visitSchedules || 0}</span>
                  </div>
                </div>

                {/* 메모 */}
                {customer.memo && (
                  <div className="pt-2 border-t">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {customer.memo}
                      </p>
                    </div>
                  </div>
                )}

                {/* 최근 활동 / 다음 일정 */}
                <div className="pt-2 border-t space-y-1">
                  {customer.lastContact && (
                    <p className="text-xs text-gray-500">
                      마지막 연락: {customer.lastContact}
                    </p>
                  )}
                  {customer.nextSchedule && (
                    <p className="text-xs text-blue-600">
                      다음 일정: {customer.nextSchedule}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 빈 상태 */}
        {(!Array.isArray(filteredCustomers) || filteredCustomers.length === 0) && (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {searchTerm ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
            </p>
            {!searchTerm && (
              <Button onClick={handleAddCustomer}>
                <Plus className="w-4 h-4 mr-2" />
                첫 고객 등록하기
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}