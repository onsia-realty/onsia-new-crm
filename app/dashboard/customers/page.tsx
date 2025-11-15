'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { maskPhonePartial } from '@/lib/utils/phone';
import {
  Search, Plus, User, Phone, Calendar, MessageSquare,
  MapPin, Building, TrendingUp, Filter, Download, Upload,
  ChevronLeft, ChevronRight, LayoutGrid, List
} from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  memo?: string;
  assignedUser?: { name: string };
  isDuplicate?: boolean;
  createdAt: string;
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

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const siteParam = searchParams.get('site');
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>(siteParam || '전체');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [viewAll, setViewAll] = useState(false); // 전체 보기 모드
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false); // 중복만 보기 모드
  const [callFilter, setCallFilter] = useState<'all' | 'called' | 'not_called'>('all'); // 통화 여부 필터
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card'); // 카드형/리스트형
  const [statistics, setStatistics] = useState<Statistics>({
    totalCustomers: 0,
    todayCallLogs: 0,
    scheduledVisits: 0,
    activeDeals: 0
  });

  // 페이지당 아이템 수 (PC: 70, 모바일: 30)
  const itemsPerPage = isMobile ? 30 : 70;

  const fetchStatistics = useCallback(async () => {
    try {
      // userId가 있으면 해당 직원의 통계만, 없으면 전체 통계
      const url = userId ? `/api/statistics?userId=${userId}` : '/api/statistics';
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setStatistics(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [userId]);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      let url = `/api/customers?page=${currentPage}&limit=${itemsPerPage}`;

      if (userId) {
        url += `&userId=${userId}`;
      } else if (viewAll) {
        url += `&viewAll=true`;
      }

      if (debouncedSearchTerm) {
        url += `&query=${encodeURIComponent(debouncedSearchTerm)}`;
      }

      // 현장 필터 추가
      if (selectedSite && selectedSite !== '전체') {
        if (selectedSite === '미지정') {
          url += `&site=null`;
        } else {
          url += `&site=${encodeURIComponent(selectedSite)}`;
        }
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        const customersData = result.data || [];
        setCustomers(customersData);
        // 중복 필터링은 useEffect에서 처리하므로 여기서는 customers만 설정
        if (!showDuplicatesOnly) {
          setFilteredCustomers(customersData);
        }
        setTotalPages(result.pagination?.totalPages || 1);
        setTotalCount(result.pagination?.total || 0);

        // 직원 이름 저장 (첫 번째 고객의 assignedUser 정보 사용)
        if (userId && customersData.length > 0 && customersData[0].assignedUser) {
          setSelectedUserName(customersData[0].assignedUser.name);
        }
      } else {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to fetch customers: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: '오류',
        description: '고객 목록을 불러오는데 실패했습니다.',
        variant: 'destructive'
      });
      setCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [toast, userId, currentPage, itemsPerPage, debouncedSearchTerm, viewAll, selectedSite]);

  // 화면 크기 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 검색어 디바운싱 (500ms 후 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 중복 및 통화 여부 필터링 + 정렬
  useEffect(() => {
    let filtered = [...customers];

    // 중복 필터링
    if (showDuplicatesOnly) {
      filtered = filtered.filter(c => c.isDuplicate);
    }

    // 통화 여부 필터링
    if (callFilter === 'called') {
      filtered = filtered.filter(c => c._count && c._count.callLogs > 0);
    } else if (callFilter === 'not_called') {
      filtered = filtered.filter(c => !c._count || c._count.callLogs === 0);
    }

    // 리스트형일 때만 정렬 (통화 안한 고객 상위)
    if (viewMode === 'list') {
      filtered.sort((a, b) => {
        const aCallCount = a._count?.callLogs || 0;
        const bCallCount = b._count?.callLogs || 0;

        // 통화 안한 고객(0건)을 상위로
        if (aCallCount === 0 && bCallCount > 0) return -1;
        if (aCallCount > 0 && bCallCount === 0) return 1;

        // 같은 그룹 내에서는 생성일 기준 내림차순 (최신순)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    setFilteredCustomers(filtered);
  }, [showDuplicatesOnly, callFilter, viewMode, customers]);

  useEffect(() => {
    fetchCustomers();
    fetchStatistics();
  }, [fetchCustomers, fetchStatistics]);

  // 검색어 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, viewAll]);

  // 페이지 번호 배열 생성 (현재 페이지 기준 ±2)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);

      if (currentPage <= 3) {
        end = maxVisible;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - maxVisible + 1;
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const handleCustomerClick = (customerId: string) => {
    router.push(`/dashboard/customers/${customerId}`);
  };

  const handleAddCustomer = () => {
    router.push('/dashboard/customers/new');
  };

  const formatPhoneNumber = (phone: string) => {
    // 010-**77-6922 형식으로 마스킹 (중간 번호 앞 2자리 가림)
    return maskPhonePartial(phone);
  };

  // 관리자에게 보내기 기능 (담당자 없는 고객들)
  const handleSendToAdmin = async () => {
    const unmanagedCustomers = filteredCustomers.filter(c => !c.assignedUser);

    if (unmanagedCustomers.length === 0) {
      toast({
        title: '알림',
        description: '담당자 없는 고객이 없습니다.',
      });
      return;
    }

    if (!confirm(`담당자 없는 ${unmanagedCustomers.length}명의 고객을 관리자에게 전송하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch('/api/customers/transfer-to-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: unmanagedCustomers.map(c => c.id) })
      });

      if (response.ok) {
        toast({
          title: '성공',
          description: `${unmanagedCustomers.length}명의 고객을 관리자에게 전송했습니다.`,
        });
        fetchCustomers();
      } else {
        throw new Error('Failed to transfer customers');
      }
    } catch (error) {
      console.error('Error transferring customers:', error);
      toast({
        title: '오류',
        description: '고객 전송에 실패했습니다.',
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

  const unmanagedCount = filteredCustomers.filter(c => !c.assignedUser).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          {/* 제목 */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">고객 관리</h1>
              {userId && selectedUserName && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedUserName}의 고객 목록
                </p>
              )}
              {viewAll && (
                <p className="text-sm text-gray-600 mt-1">
                  전체 고객 목록
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {/* PC에서만 표시되는 버튼들 */}
              <Button variant="outline" size="sm" className="hidden md:flex" onClick={() => router.push('/dashboard/customers/bulk-import')}>
                <Upload className="w-4 h-4 mr-2" />
                일괄 등록
              </Button>
              <Button onClick={handleAddCustomer} className="hidden md:flex" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                고객 등록
              </Button>
              {/* 모바일 - 고객 등록만 표시 */}
              <Button onClick={handleAddCustomer} className="md:hidden" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 필터 영역 */}
          <div className="flex flex-wrap gap-2">
            {/* 내 고객 / 전체 고객 토글 */}
            {userId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard/customers')}
                className="text-xs"
              >
                내 고객
              </Button>
            )}
            {!userId && !viewAll && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewAll(true)}
                className="text-xs"
              >
                전체 고객
              </Button>
            )}
            {viewAll && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewAll(false)}
                className="text-xs"
              >
                내 고객
              </Button>
            )}

            {/* 중복 필터 - 모바일에서는 간결하게 */}
            <Button
              variant={showDuplicatesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
              className="text-xs"
            >
              {showDuplicatesOnly ? "전체" : "중복"}
            </Button>

            {/* 통화 여부 필터 */}
            <div className="flex border rounded-md">
              <Button
                variant={callFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCallFilter('all')}
                className="text-xs rounded-r-none border-r"
              >
                전체
              </Button>
              <Button
                variant={callFilter === 'not_called' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCallFilter('not_called')}
                className="text-xs rounded-none border-r"
              >
                미통화
              </Button>
              <Button
                variant={callFilter === 'called' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCallFilter('called')}
                className="text-xs rounded-l-none"
              >
                통화완료
              </Button>
            </div>

            {/* 현장 필터 */}
            <select
              value={selectedSite}
              onChange={(e) => {
                setSelectedSite(e.target.value);
                setCurrentPage(1);
              }}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="전체">전체 현장</option>
              <option value="용인경남아너스빌">용인경남아너스빌</option>
              <option value="신광교클라우드시티">신광교클라우드시티</option>
              <option value="평택 로제비앙">평택 로제비앙</option>
              <option value="미지정">미지정</option>
            </select>

            {/* 카드형/리스트형 토글 - PC에서만 */}
            <div className="hidden md:flex border rounded-md">
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('card')}
                className="rounded-r-none"
              >
                <LayoutGrid className="w-4 h-4 mr-1" />
                카드형
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <List className="w-4 h-4 mr-1" />
                리스트형
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 영역 */}
      <div className="container mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex gap-2 md:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <Input
                type="text"
                placeholder="이름, 전화번호 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 md:pl-10 text-sm md:text-base"
              />
            </div>
            {/* PC에서만 필터 버튼 표시 */}
            <Button variant="outline" className="hidden md:flex">
              <Filter className="w-4 h-4 mr-2" />
              필터
            </Button>
          </div>
        </div>

        {/* 통계 카드 - 모바일: 2개, PC: 4개 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">전체 고객</p>
                  <p className="text-lg md:text-2xl font-bold">{statistics.totalCustomers}</p>
                </div>
                <User className="w-6 h-6 md:w-8 md:h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">오늘 통화</p>
                  <p className="text-lg md:text-2xl font-bold">{statistics.todayCallLogs}</p>
                  {statistics.todayCallLogs > 0 && (
                    <p className="text-xs text-green-600 mt-1">+{statistics.todayCallLogs} 건</p>
                  )}
                </div>
                <Phone className="w-6 h-6 md:w-8 md:h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          {/* PC에서만 표시 */}
          <Card className="hidden md:block">
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
          <Card className="hidden md:block">
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

        {/* 고객 목록 - 카드형 또는 리스트형 */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {Array.isArray(filteredCustomers) && filteredCustomers.map((customer) => (
            <Card
              key={customer.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleCustomerClick(customer.id)}
            >
              <CardHeader className="pb-3 p-3 md:p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 md:gap-3 flex-1">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base md:text-lg truncate flex items-center gap-2">
                        <span>{customer.name || '이름 없음'}</span>
                        {customer.isDuplicate && (
                          <span className="text-xs font-semibold text-white bg-red-600 px-2 py-1 rounded whitespace-nowrap">
                            ⚠️ 중복
                          </span>
                        )}
                      </CardTitle>
                      <a
                        href={`tel:${customer.phone}`}
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-3 h-3 md:w-4 md:h-4" />
                        {formatPhoneNumber(customer.phone)}
                      </a>
                    </div>
                  </div>
                  {customer.assignedUser && (
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {customer.assignedUser.name}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 md:space-y-3 p-3 md:p-6 pt-0">
                {/* 주소 정보 */}
                {customer.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs md:text-sm text-gray-600 line-clamp-1">
                      {customer.address}
                    </p>
                  </div>
                )}

                {/* 활동 통계 */}
                <div className="flex items-center gap-3 md:gap-4 text-xs text-gray-500">
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

                {/* 메모 - PC에서만 표시 */}
                {customer.memo && (
                  <div className="pt-2 border-t hidden md:block">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5" />
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {customer.memo}
                      </p>
                    </div>
                  </div>
                )}

                {/* 최근 활동 / 다음 일정 - PC에서만 표시 */}
                <div className="pt-2 border-t space-y-1 hidden md:block">
                  <p className="text-xs text-gray-500">
                    등록일: {new Date(customer.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
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
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      고객명
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      전화번호
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      주소
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      담당자
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관심/통화/방문
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      등록일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.isArray(filteredCustomers) && filteredCustomers.map((customer) => (
                    <tr
                      key={customer.id}
                      onClick={() => handleCustomerClick(customer.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {customer.name || '이름 없음'}
                          </span>
                          {customer.isDuplicate && (
                            <Badge variant="destructive" className="text-xs">⚠️ 중복</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <a
                          href={`tel:${customer.phone}`}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="w-4 h-4" />
                          {formatPhoneNumber(customer.phone)}
                        </a>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1 max-w-xs">
                          {customer.address ? (
                            <>
                              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-600 truncate">{customer.address}</span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {customer.assignedUser ? (
                          <Badge variant="outline">{customer.assignedUser.name}</Badge>
                        ) : (
                          <span className="text-sm text-gray-400">미배정</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
                          <span>{customer._count?.interestCards || 0}</span>
                          <span>/</span>
                          <span>{customer._count?.callLogs || 0}</span>
                          <span>/</span>
                          <span>{customer._count?.visitSchedules || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(customer.createdAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {(!Array.isArray(filteredCustomers) || filteredCustomers.length === 0) && (
          <div className="text-center py-8 md:py-12">
            <User className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-sm md:text-base text-gray-500 mb-4">
              {searchTerm ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
            </p>
            {!searchTerm && (
              <Button onClick={handleAddCustomer} size="sm" className="md:size-default">
                <Plus className="w-4 h-4 mr-2" />
                첫 고객 등록하기
              </Button>
            )}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* 페이지 정보 */}
            <div className="text-sm text-gray-600">
              전체 {totalCount.toLocaleString()}건 (페이지 {currentPage} / {totalPages})
            </div>

            {/* 페이지 버튼 */}
            <div className="flex items-center gap-2">
              {/* 이전 버튼 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="h-9 px-3"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">이전</span>
              </Button>

              {/* 페이지 번호 */}
              <div className="flex items-center gap-1">
                {getPageNumbers().map((pageNum) => (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="h-9 w-9 p-0"
                  >
                    {pageNum}
                  </Button>
                ))}
              </div>

              {/* 다음 버튼 */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="h-9 px-3"
              >
                <span className="hidden sm:inline mr-1">다음</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CustomersPageContent />
    </Suspense>
  );
}