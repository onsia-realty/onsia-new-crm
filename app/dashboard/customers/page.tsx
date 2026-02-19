'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { maskPhonePartial } from '@/lib/utils/phone';
import {
  Search, Plus, User, Phone, PhoneOff, Calendar, MessageSquare,
  MapPin, Building, Filter, Download, Upload,
  ChevronLeft, ChevronRight, LayoutGrid, List, ArrowUpDown, Ban, Globe, Database, Trash2
} from 'lucide-react';
import { DateFilterCalendar } from '@/components/customers/DateFilterCalendar';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  memo?: string;
  assignedUser?: { name: string };
  isDuplicate?: boolean;
  duplicateWith?: Array<{
    id: string;
    name: string | null;
    phone: string;
    assignedUser: {
      id: string;
      name: string;
    } | null;
  }>;
  isBlacklisted?: boolean;
  blacklistInfo?: {
    reason: string;
    registeredBy: { name: string } | null;
  };
  createdAt: string;
  updatedAt: string;
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
  absenceCustomers: number;
  todayCallLogs: number;
  scheduledVisits: number;
  duplicateCustomers: number;
}

interface UserWithCount {
  id: string;
  name: string;
  email: string;
  role: string;
  _count?: {
    customers: number;
  };
}

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // 관리자 여부 확인 (ADMIN만 중복 상세정보 볼 수 있음)
  const isAdmin = session?.user?.role === 'ADMIN';

  // URL 파라미터에서 상태 읽기
  const userId = searchParams.get('userId');
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const selectedSite = searchParams.get('site') || '전체';
  const viewAll = searchParams.get('viewAll') === 'true';
  const showDuplicatesOnly = searchParams.get('duplicates') === 'true';
  const showAbsenceOnly = searchParams.get('absence') === 'true'; // 부재 고객만 보기
  const isPublicDb = searchParams.get('publicDb') === 'true'; // 공개DB 모드
  const isAdminDb = searchParams.get('adminDb') === 'true'; // 관리자 DB 모드
  const isReclaimAbsence = searchParams.get('reclaimAbsence') === 'true'; // 부재 고객 회수 모드
  const callFilter = (searchParams.get('callFilter') as 'all' | 'called' | 'not_called') || 'all';
  const dateFilter = searchParams.get('date') || '';
  const sortLocked = searchParams.get('sortLocked') !== 'false'; // 기본값: true
  const viewMode = (searchParams.get('viewMode') as 'card' | 'list') || 'list';
  const debouncedSearchTerm = searchParams.get('q') || '';
  const debouncedNameTerm = searchParams.get('name') || ''; // 이름 검색

  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(debouncedSearchTerm); // URL의 검색어로 초기화
  const [nameTerm, setNameTerm] = useState(debouncedNameTerm); // 이름 검색어
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [callFilterCounts, setCallFilterCounts] = useState({ all: 0, called: 0, not_called: 0 }); // 각 필터의 카운트
  const [isMobile, setIsMobile] = useState(false);
  const [statistics, setStatistics] = useState<Statistics>({
    totalCustomers: 0,
    absenceCustomers: 0,
    todayCallLogs: 0,
    scheduledVisits: 0,
    duplicateCustomers: 0
  });
  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [showUserCards, setShowUserCards] = useState(false); // 직원별 카드 표시 여부
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]); // 체크박스로 선택된 고객 ID들
  const [allCustomerIds, setAllCustomerIds] = useState<string[]>([]); // 전체 고객 ID (네비게이션용)
  const [publicCustomerCount, setPublicCustomerCount] = useState(0); // 공개DB 고객 수
  const [markingPublic, setMarkingPublic] = useState(false); // 공개DB 전환 로딩
  const [deleting, setDeleting] = useState(false); // 삭제 로딩
  const [siteCounts, setSiteCounts] = useState<Record<string, number>>({}); // 현장별 고객 수
  const [siteList, setSiteList] = useState<string[]>([]); // 현장 목록 (동적)
  const excludeDuplicates = searchParams.get('excludeDup') !== 'false'; // 관리자 DB 기본: 중복 제외 ON

  // URL 파라미터 업데이트 함수 (히스토리 스택 방지를 위해 replace 사용)
  const updateUrlParams = useCallback((updates: Record<string, string | number | boolean | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '' || value === false ||
          (key === 'page' && value === 1) ||
          (key === 'site' && value === '전체') ||
          (key === 'callFilter' && value === 'all') ||
          (key === 'sortLocked' && value === true) ||
          (key === 'viewMode' && value === 'list')) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/dashboard/customers${newUrl}`, { scroll: false });
  }, [router, searchParams]);

  // 페이지당 아이템 수 (PC: 70, 모바일: 30)
  const itemsPerPage = isMobile ? 30 : 70;

  const fetchStatistics = useCallback(async () => {
    try {
      // adminDb 모드이면 관리자 본인 통계, userId가 있으면 해당 직원 통계, 없으면 전체 통계
      const statsUserId = isAdminDb && session?.user?.id ? session.user.id : userId;
      const url = statsUserId ? `/api/statistics?userId=${statsUserId}` : '/api/statistics';
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
  }, [userId, isAdminDb, session?.user?.id]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        // 직원만 필터링 (EMPLOYEE, TEAM_LEADER, HEAD)
        const employees = data
          .filter((u: UserWithCount) => ['EMPLOYEE', 'TEAM_LEADER', 'HEAD'].includes(u.role))
          .map((u: UserWithCount) => ({
            ...u,
            _count: u._count || { customers: 0 }
          }));
        setUsers(employees);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, []);

  // 각 필터의 카운트를 가져오는 함수
  const fetchCallFilterCounts = useCallback(async () => {
    try {
      // 기본 URL 파라미터 구성
      let baseParams = '';
      if (isPublicDb) {
        baseParams += `&isPublic=true`;
      }
      if (isReclaimAbsence) {
        baseParams += `&viewAll=true&showAbsenceOnly=true`;
      } else if (isAdminDb && session?.user?.id) {
        baseParams += `&userId=${session.user.id}`;
        if (excludeDuplicates) {
          baseParams += `&excludeDuplicates=true`;
        }
      } else if (userId) {
        baseParams += `&userId=${userId}`;
      } else if (viewAll) {
        baseParams += `&viewAll=true`;
      }
      if (debouncedSearchTerm) {
        baseParams += `&query=${encodeURIComponent(debouncedSearchTerm)}`;
      }
      if (debouncedNameTerm) {
        baseParams += `&name=${encodeURIComponent(debouncedNameTerm)}`;
      }
      if (selectedSite && selectedSite !== '전체') {
        if (selectedSite === '미지정') {
          baseParams += `&site=null`;
        } else {
          baseParams += `&site=${encodeURIComponent(selectedSite)}`;
        }
      }

      // 각 필터별 카운트를 병렬로 가져오기
      const [allRes, calledRes, notCalledRes] = await Promise.all([
        fetch(`/api/customers?page=1&limit=1${baseParams}`),
        fetch(`/api/customers?page=1&limit=1&callFilter=called${baseParams}`),
        fetch(`/api/customers?page=1&limit=1&callFilter=not_called${baseParams}`)
      ]);

      const [allData, calledData, notCalledData] = await Promise.all([
        allRes.json(),
        calledRes.json(),
        notCalledRes.json()
      ]);

      setCallFilterCounts({
        all: allData.pagination?.total || 0,
        called: calledData.pagination?.total || 0,
        not_called: notCalledData.pagination?.total || 0
      });
    } catch (error) {
      console.error('Error fetching call filter counts:', error);
    }
  }, [userId, viewAll, debouncedSearchTerm, debouncedNameTerm, selectedSite, isPublicDb, isAdminDb, isReclaimAbsence, session?.user?.id, excludeDuplicates]);

  // 전체 고객 ID 조회 (네비게이션용)
  const fetchAllCustomerIds = useCallback(async () => {
    try {
      let url = '/api/customers?idsOnly=true';

      if (isPublicDb) {
        url += `&isPublic=true`;
      }

      if (isReclaimAbsence) {
        url += `&viewAll=true&showAbsenceOnly=true`;
      } else if (isAdminDb && session?.user?.id) {
        url += `&userId=${session.user.id}`;
        if (excludeDuplicates) {
          url += `&excludeDuplicates=true`;
        }
      } else if (userId) {
        url += `&userId=${userId}`;
      } else if (viewAll) {
        url += `&viewAll=true`;
      }

      if (debouncedSearchTerm) {
        url += `&query=${encodeURIComponent(debouncedSearchTerm)}`;
      }

      if (debouncedNameTerm) {
        url += `&name=${encodeURIComponent(debouncedNameTerm)}`;
      }

      if (selectedSite && selectedSite !== '전체') {
        if (selectedSite === '미지정') {
          url += `&site=null`;
        } else {
          url += `&site=${encodeURIComponent(selectedSite)}`;
        }
      }

      if (callFilter !== 'all') {
        url += `&callFilter=${callFilter}`;
      }

      if (dateFilter) {
        url += `&date=${dateFilter}`;
      }

      // 부재 고객 필터 추가
      if (showAbsenceOnly) {
        url += `&showAbsenceOnly=true`;
      }

      // 중복 고객 필터 추가
      if (showDuplicatesOnly) {
        url += `&showDuplicatesOnly=true`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setAllCustomerIds(result.ids || []);
      }
    } catch (error) {
      console.error('Error fetching all customer IDs:', error);
    }
  }, [userId, viewAll, debouncedSearchTerm, debouncedNameTerm, selectedSite, callFilter, dateFilter, showAbsenceOnly, showDuplicatesOnly, isPublicDb, isAdminDb, isReclaimAbsence, session?.user?.id, excludeDuplicates]);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      // 중복 필터가 활성화되면 페이징 없이 전체 데이터 가져오기
      const effectiveLimit = showDuplicatesOnly ? 0 : itemsPerPage;
      const effectivePage = showDuplicatesOnly ? 1 : currentPage;

      let url = `/api/customers?page=${effectivePage}&limit=${effectiveLimit}`;

      // 공개DB 모드
      if (isPublicDb) {
        url += `&isPublic=true`;
      }

      // 부재 고객 회수 모드: 전체 직원의 부재 고객
      if (isReclaimAbsence) {
        url += `&viewAll=true&showAbsenceOnly=true`;
      }
      // 관리자 DB 모드: 본인 고객만 필터 + 중복 제외
      else if (isAdminDb && session?.user?.id) {
        url += `&userId=${session.user.id}`;
        if (excludeDuplicates) {
          url += `&excludeDuplicates=true`;
        }
      } else if (userId) {
        url += `&userId=${userId}`;
      } else if (viewAll) {
        url += `&viewAll=true`;
      }

      if (debouncedSearchTerm) {
        url += `&query=${encodeURIComponent(debouncedSearchTerm)}`;
      }

      // 이름 검색 추가
      if (debouncedNameTerm) {
        url += `&name=${encodeURIComponent(debouncedNameTerm)}`;
      }

      // 현장 필터 추가
      if (selectedSite && selectedSite !== '전체') {
        if (selectedSite === '미지정') {
          url += `&site=null`;
        } else {
          url += `&site=${encodeURIComponent(selectedSite)}`;
        }
      }

      // 통화 여부 필터 추가 (서버 사이드)
      if (callFilter !== 'all') {
        url += `&callFilter=${callFilter}`;
      }

      // 날짜 필터 추가
      if (dateFilter) {
        url += `&date=${dateFilter}`;
      }

      // 부재 고객 필터 추가
      if (showAbsenceOnly) {
        url += `&showAbsenceOnly=true`;
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
  }, [toast, userId, currentPage, itemsPerPage, debouncedSearchTerm, debouncedNameTerm, viewAll, selectedSite, callFilter, dateFilter, showDuplicatesOnly, showAbsenceOnly, isPublicDb, isAdminDb, isReclaimAbsence, session?.user?.id, excludeDuplicates]);

  // 화면 크기 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 검색 실행 함수 (Enter 키로 호출)
  const handleSearch = () => {
    updateUrlParams({ q: searchTerm || null, page: 1 });
  };

  // 이름 검색 실행 함수
  const handleNameSearch = () => {
    updateUrlParams({ name: nameTerm || null, page: 1 });
  };

  // 중복 필터링 + 정렬 + 클라이언트 사이드 페이지네이션
  useEffect(() => {
    let filtered = [...customers];

    // 중복 필터링
    if (showDuplicatesOnly) {
      filtered = filtered.filter(c => c.isDuplicate);

      // 클라이언트 사이드 페이지네이션
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const paginatedFiltered = filtered.slice(start, end);

      // 리스트형일 때만 정렬 (정렬 고정이 꺼져있을 때만)
      if (viewMode === 'list' && !sortLocked) {
        paginatedFiltered.sort((a, b) => {
          const aHasContact = (a._count?.callLogs || 0) > 0 || (a.memo && a.memo.trim().length > 0);
          const bHasContact = (b._count?.callLogs || 0) > 0 || (b.memo && b.memo.trim().length > 0);

          // 통화/메모 없는 고객을 상위로
          if (!aHasContact && bHasContact) return -1;
          if (aHasContact && !bHasContact) return 1;

          // 같은 그룹 내에서는 생성일 기준 내림차순 (최신순)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }

      setFilteredCustomers(paginatedFiltered);
      // 중복 필터링 시 총 페이지 수 재계산
      setTotalPages(Math.ceil(filtered.length / itemsPerPage));
      setTotalCount(filtered.length);
    } else {
      // 리스트형일 때만 정렬 (정렬 고정이 꺼져있을 때만)
      if (viewMode === 'list' && !sortLocked) {
        filtered.sort((a, b) => {
          const aHasContact = (a._count?.callLogs || 0) > 0 || (a.memo && a.memo.trim().length > 0);
          const bHasContact = (b._count?.callLogs || 0) > 0 || (b.memo && b.memo.trim().length > 0);

          // 통화/메모 없는 고객을 상위로
          if (!aHasContact && bHasContact) return -1;
          if (aHasContact && !bHasContact) return 1;

          // 같은 그룹 내에서는 생성일 기준 내림차순 (최신순)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }

      setFilteredCustomers(filtered);
    }
  }, [showDuplicatesOnly, viewMode, customers, sortLocked, currentPage, itemsPerPage]);

  // 공개DB 고객 수 가져오기
  const fetchPublicCount = useCallback(async () => {
    try {
      const res = await fetch('/api/customers?isPublic=true&page=1&limit=1');
      if (res.ok) {
        const data = await res.json();
        setPublicCustomerCount(data.pagination?.total || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  // 현장별 고객 수 가져오기
  const fetchSiteCounts = useCallback(async () => {
    try {
      let url = '/api/customers/site-counts?';
      if (isPublicDb) url += 'isPublic=true&';
      if (isAdminDb && session?.user?.id) {
        url += `userId=${session.user.id}&`;
      } else if (userId) {
        url += `userId=${userId}&`;
      } else if (viewAll) {
        url += 'viewAll=true&';
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSiteCounts(data.counts || {});
          if (data.sites) setSiteList(data.sites);
        }
      }
    } catch {
      // ignore
    }
  }, [userId, viewAll, isPublicDb, isAdminDb, session?.user?.id]);

  // 공개DB 전환 핸들러 (관리자용)
  const handleMarkPublic = async (makePublic: boolean) => {
    if (selectedCustomerIds.length === 0) {
      toast({ title: '알림', description: '선택된 고객이 없습니다.' });
      return;
    }

    const action = makePublic ? '공개DB로 전환' : '공개DB에서 해제';
    const count = selectedCustomerIds.length;
    const confirmMsg = count > 100
      ? `⚠️ 대량 작업\n\n선택한 ${count.toLocaleString()}명의 고객을 ${action}합니다.\n담당자 배분이 해제되며 모든 직원이 열람 가능해집니다.\n\n계속하시겠습니까?`
      : `선택한 ${count.toLocaleString()}명의 고객을 ${action}하시겠습니까?`;
    if (!confirm(confirmMsg)) {
      return;
    }

    setMarkingPublic(true);
    try {
      const res = await fetch('/api/customers/mark-public', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: selectedCustomerIds, isPublic: makePublic }),
      });
      const data = await res.json();

      if (res.ok) {
        toast({ title: '성공', description: data.message });
        setSelectedCustomerIds([]);
        fetchCustomers();
        fetchPublicCount();
      } else {
        throw new Error(data.error || `${action} 실패`);
      }
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : `${action}에 실패했습니다.`,
        variant: 'destructive',
      });
    } finally {
      setMarkingPublic(false);
    }
  };

  // 일괄 삭제 핸들러 (관리자 DB 전용)
  const handleBulkDelete = async () => {
    if (selectedCustomerIds.length === 0) {
      toast({ title: '알림', description: '선택된 고객이 없습니다.' });
      return;
    }

    const count = selectedCustomerIds.length;
    const confirmMsg = count > 100
      ? `⚠️ 대량 삭제\n\n선택한 ${count.toLocaleString()}명의 고객을 삭제합니다.\n삭제된 고객은 목록에서 제거됩니다.\n\n정말 삭제하시겠습니까?`
      : `선택한 ${count.toLocaleString()}명의 고객을 삭제하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/customers/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: selectedCustomerIds }),
      });
      const data = await res.json();

      if (res.ok) {
        toast({ title: '성공', description: data.message });
        setSelectedCustomerIds([]);
        fetchCustomers();
        fetchStatistics();
        fetchAllCustomerIds();
      } else {
        throw new Error(data.error || '삭제 실패');
      }
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '고객 삭제에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // 부재 고객 관리자 DB로 회수 핸들러
  const [reclaiming, setReclaiming] = useState(false);
  const handleReclaimToAdmin = async () => {
    if (selectedCustomerIds.length === 0) {
      toast({ title: '알림', description: '선택된 고객이 없습니다.' });
      return;
    }

    const count = selectedCustomerIds.length;
    if (!confirm(`선택한 ${count.toLocaleString()}명의 부재 고객을 관리자 DB로 회수하시겠습니까?\n\n회수된 고객은 관리자 DB에서 공개DB로 전환할 수 있습니다.`)) return;

    setReclaiming(true);
    try {
      const res = await fetch('/api/customers/transfer-to-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: selectedCustomerIds }),
      });
      const data = await res.json();

      if (res.ok) {
        toast({ title: '성공', description: `${data.count.toLocaleString()}명의 고객을 관리자 DB로 회수했습니다.` });
        setSelectedCustomerIds([]);
        fetchCustomers();
        fetchAllCustomerIds();
        fetchStatistics();
      } else {
        throw new Error(data.error || '회수 실패');
      }
    } catch (error) {
      toast({
        title: '오류',
        description: error instanceof Error ? error.message : '부재 고객 회수에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setReclaiming(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchStatistics();
    fetchCallFilterCounts();
    fetchUsers();
    fetchAllCustomerIds(); // 전체 고객 ID 조회 (네비게이션용)
    fetchPublicCount(); // 공개DB 고객 수 조회
    fetchSiteCounts(); // 현장별 고객 수 조회
  }, [fetchCustomers, fetchStatistics, fetchCallFilterCounts, fetchUsers, fetchAllCustomerIds, fetchPublicCount, fetchSiteCounts]);

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

  const handleCustomerClick = (customerId: string, currentIndex?: number) => {
    // 이전/다음 고객 네비게이션을 위한 정보 저장 (전체 고객 ID 사용)
    // 현재 페이지 기준 인덱스를 전체 인덱스로 변환
    const pageOffset = (currentPage - 1) * itemsPerPage;
    const globalIndex = allCustomerIds.indexOf(customerId);

    const navigationData = {
      customerIds: allCustomerIds, // 전체 고객 ID 사용
      currentIndex: globalIndex !== -1 ? globalIndex : (currentIndex !== undefined ? pageOffset + currentIndex : 0)
    };
    sessionStorage.setItem('customerNavigation', JSON.stringify(navigationData));

    router.push(`/dashboard/customers/${customerId}`);
  };

  // 고객 번호 계산 (페이지 기준)
  const getCustomerNumber = (index: number) => {
    return (currentPage - 1) * itemsPerPage + index + 1;
  };

  const handleAddCustomer = () => {
    router.push('/dashboard/customers/new');
  };

  const formatPhoneNumber = (phone: string) => {
    // 010-**77-6922 형식으로 마스킹 (중간 번호 앞 2자리 가림)
    return maskPhonePartial(phone);
  };

  // 체크박스 토글 (현재 페이지 전체 선택/해제)
  const handleToggleAll = () => {
    if (selectedCustomerIds.length === filteredCustomers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map(c => c.id));
    }
  };

  // 모든 페이지의 필터 결과 전체 선택
  const handleSelectAllPages = () => {
    setSelectedCustomerIds([...allCustomerIds]);
  };

  // 체크박스 토글 (개별)
  const handleToggleCustomer = (customerId: string) => {
    if (selectedCustomerIds.includes(customerId)) {
      setSelectedCustomerIds(selectedCustomerIds.filter(id => id !== customerId));
    } else {
      setSelectedCustomerIds([...selectedCustomerIds, customerId]);
    }
  };

  // 관리자에게 보내기 기능 (선택된 고객들)
  const handleSendToAdmin = async () => {
    if (selectedCustomerIds.length === 0) {
      toast({
        title: '알림',
        description: '선택된 고객이 없습니다.',
      });
      return;
    }

    if (!confirm(`선택한 ${selectedCustomerIds.length}명의 고객을 관리자에게 재배분하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch('/api/customers/transfer-to-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: selectedCustomerIds })
      });

      if (response.ok) {
        toast({
          title: '성공',
          description: `${selectedCustomerIds.length}명의 고객을 관리자에게 재배분했습니다.`,
        });
        setSelectedCustomerIds([]);
        fetchCustomers();
      } else {
        throw new Error('Failed to transfer customers');
      }
    } catch (error) {
      console.error('Error transferring customers:', error);
      toast({
        title: '오류',
        description: '고객 재배분에 실패했습니다.',
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
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                {isReclaimAbsence ? (
                  <>
                    <PhoneOff className="w-6 h-6 text-orange-600" />
                    부재 고객 회수
                  </>
                ) : isAdminDb ? (
                  <>
                    <Database className="w-6 h-6 text-indigo-600" />
                    관리자 DB
                  </>
                ) : isPublicDb ? '공개DB' : '고객 관리'}
              </h1>
              {isReclaimAbsence && (
                <p className="text-sm text-gray-600 mt-1">
                  직원 보유 부재 고객을 관리자 DB로 회수 → 공개DB로 전환 가능
                </p>
              )}
              {isAdminDb && (
                <p className="text-sm text-gray-600 mt-1">
                  내가 보유한 고객 DB - 선택 후 공개DB로 전환 가능
                </p>
              )}
              {!isAdminDb && userId && selectedUserName && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedUserName}의 고객 목록
                </p>
              )}
              {!isAdminDb && viewAll && (
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
            {/* 부재 고객 회수 모드 필터 */}
            {isReclaimAbsence && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/customers')}
                  className="text-xs"
                >
                  고객 목록
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/customers?adminDb=true')}
                  className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <Database className="w-3.5 h-3.5 mr-1" />
                  관리자 DB
                </Button>
              </>
            )}

            {/* 관리자 DB 모드에서는 고객 목록 / 공개DB 전환 버튼 + 중복 제외 토글 */}
            {isAdminDb && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/customers')}
                  className="text-xs"
                >
                  고객 목록
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/dashboard/customers?publicDb=true')}
                  className="text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  <Globe className="w-3.5 h-3.5 mr-1" />
                  공개DB ({publicCustomerCount})
                </Button>
                {/* 중복/블랙 제외 토글 */}
                <Button
                  variant={excludeDuplicates ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateUrlParams({ excludeDup: excludeDuplicates ? 'false' : null, page: 1 })}
                  className={`text-xs ${excludeDuplicates ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                >
                  {excludeDuplicates ? '중복/블랙 제외 ON' : '중복/블랙 제외 OFF'}
                </Button>
              </>
            )}

            {/* 일반 모드 탭들 (관리자 DB 모드가 아닐 때만) */}
            {!isAdminDb && (
              <>
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
                    onClick={() => updateUrlParams({ viewAll: true, page: 1 })}
                    className="text-xs"
                  >
                    전체 고객
                  </Button>
                )}
                {viewAll && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateUrlParams({ viewAll: false, page: 1 })}
                    className="text-xs"
                  >
                    내 고객
                  </Button>
                )}

                {/* 공개DB 탭 */}
                {!isPublicDb ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard/customers?publicDb=true')}
                    className="text-xs text-purple-600 border-purple-200 hover:bg-purple-50"
                  >
                    <Globe className="w-3.5 h-3.5 mr-1" />
                    공개DB ({publicCustomerCount})
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard/customers')}
                    className="text-xs"
                  >
                    내 고객
                  </Button>
                )}
              </>
            )}

            {/* 중복 필터 - 부재 회수 모드에서는 숨김 */}
            {!isReclaimAbsence && (
              <Button
                variant={showDuplicatesOnly ? "destructive" : "outline"}
                size="sm"
                onClick={() => updateUrlParams({ duplicates: !showDuplicatesOnly, page: 1 })}
                className="text-xs"
              >
                {showDuplicatesOnly ? "중복만 보기 (해제)" : "중복 고객만 보기"}
              </Button>
            )}

            {/* 통화 여부 필터 - 부재 회수 모드에서는 숨김 */}
            {!isReclaimAbsence && (
              <div className="flex border rounded-md">
                <Button
                  variant={callFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateUrlParams({ callFilter: 'all', page: 1 })}
                  className="text-xs rounded-r-none border-r"
                >
                  전체 ({callFilterCounts.all})
                </Button>
                <Button
                  variant={callFilter === 'not_called' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateUrlParams({ callFilter: 'not_called', page: 1 })}
                  className="text-xs rounded-none border-r"
                >
                  미통화 ({callFilterCounts.not_called})
                </Button>
                <Button
                  variant={callFilter === 'called' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => updateUrlParams({ callFilter: 'called', page: 1 })}
                  className="text-xs rounded-l-none"
                >
                  통화완료 ({callFilterCounts.called})
                </Button>
              </div>
            )}

            {/* 현장 필터 */}
            <select
              value={isPublicDb ? '공개DB' : selectedSite}
              onChange={(e) => {
                if (e.target.value === '공개DB') {
                  router.push('/dashboard/customers?publicDb=true');
                } else if (isPublicDb) {
                  router.push(`/dashboard/customers${e.target.value !== '전체' ? `?site=${encodeURIComponent(e.target.value)}` : ''}`);
                } else {
                  updateUrlParams({ site: e.target.value, page: 1 });
                }
              }}
              className="px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="전체">전체 현장 ({(siteCounts['전체'] || 0).toLocaleString()})</option>
              {siteList.filter(s => s !== '미지정').map(site => (
                <option key={site} value={site}>{site} ({(siteCounts[site] || 0).toLocaleString()})</option>
              ))}
              <option value="공개DB">공개DB ({(siteCounts['공개DB'] || 0).toLocaleString()})</option>
              {siteList.includes('미지정') && (
                <option value="미지정">미지정 ({(siteCounts['미지정'] || 0).toLocaleString()})</option>
              )}
            </select>

            {/* 카드형/리스트형 토글 */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => updateUrlParams({ viewMode: 'card' })}
                className="rounded-r-none text-xs md:text-sm"
              >
                <LayoutGrid className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">카드형</span>
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => updateUrlParams({ viewMode: 'list' })}
                className="rounded-l-none text-xs md:text-sm"
              >
                <List className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">리스트형</span>
              </Button>
            </div>

            {/* 정렬 고정 토글 (리스트형일 때만 표시) */}
            {viewMode === 'list' && (
              <Button
                variant={sortLocked ? 'outline' : 'default'}
                size="sm"
                onClick={() => updateUrlParams({ sortLocked: !sortLocked })}
                className="text-xs"
                title={sortLocked ? '등록순 정렬 (서버 기본)' : '미통화 우선 정렬 (자동)'}
              >
                <ArrowUpDown className="w-4 h-4 md:mr-1" />
                <span className="hidden md:inline">{sortLocked ? '등록순' : '미통화 우선'}</span>
              </Button>
            )}
          </div>

          {/* 선택된 고객 관리 버튼 */}
          {/* 부재 고객 회수 모드: 선택 전에도 전체 선택 안내 표시 */}
          {isReclaimAbsence && selectedCustomerIds.length === 0 && totalCount > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <p className="text-sm text-gray-500">부재 고객을 선택한 후 관리자 DB로 회수할 수 있습니다.</p>
              {allCustomerIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllPages}
                  className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  <PhoneOff className="w-3.5 h-3.5 mr-1" />
                  전체 {allCustomerIds.length.toLocaleString()}명 선택
                </Button>
              )}
            </div>
          )}

          {/* 관리자 DB 모드: 선택 전에도 전체 선택 안내 표시 */}
          {isAdminDb && selectedCustomerIds.length === 0 && totalCount > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <p className="text-sm text-gray-500">고객을 선택한 후 공개DB 전환 또는 삭제할 수 있습니다.</p>
              {allCustomerIds.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllPages}
                  className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <Database className="w-3.5 h-3.5 mr-1" />
                  전체 {allCustomerIds.length.toLocaleString()}명 선택
                </Button>
              )}
            </div>
          )}

          {selectedCustomerIds.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="px-3 py-1">
                {selectedCustomerIds.length.toLocaleString()}명 선택됨
              </Badge>
              {/* 부재 고객 회수 모드: 전체 페이지 선택 + 관리자 DB로 회수 */}
              {isReclaimAbsence && selectedCustomerIds.length < allCustomerIds.length && allCustomerIds.length > filteredCustomers.length && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllPages}
                  className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  <PhoneOff className="w-3.5 h-3.5 mr-1" />
                  전체 {allCustomerIds.length.toLocaleString()}명 선택
                </Button>
              )}
              {isReclaimAbsence && (
                <Button
                  size="sm"
                  onClick={handleReclaimToAdmin}
                  disabled={reclaiming}
                  className="text-xs bg-orange-600 hover:bg-orange-700"
                >
                  <Database className="w-3.5 h-3.5 mr-1" />
                  {reclaiming ? '회수 중...' : `관리자 DB로 회수 (${selectedCustomerIds.length.toLocaleString()}명)`}
                </Button>
              )}
              {/* 관리자 DB 모드 또는 관리자 본인 고객 조회 시: 전체 페이지 선택 */}
              {isAdmin && (isAdminDb || userId === session?.user?.id) && selectedCustomerIds.length < allCustomerIds.length && allCustomerIds.length > filteredCustomers.length && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectAllPages}
                  className="text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <Database className="w-3.5 h-3.5 mr-1" />
                  전체 {allCustomerIds.length.toLocaleString()}명 선택
                </Button>
              )}
              {!isPublicDb && !isAdminDb && !isReclaimAbsence && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleSendToAdmin}
                  className="text-xs"
                >
                  선택한 고객 관리자에게 재배분
                </Button>
              )}
              {/* 관리자 DB 모드 또는 관리자 본인 고객 목록에서: 공개DB 전환 */}
              {isAdmin && (isAdminDb || !isPublicDb) && !isPublicDb && (
                <Button
                  size="sm"
                  onClick={() => handleMarkPublic(true)}
                  disabled={markingPublic}
                  className="text-xs bg-purple-600 hover:bg-purple-700"
                >
                  <Globe className="w-3.5 h-3.5 mr-1" />
                  {markingPublic ? '처리 중...' : `공개DB로 전환 (${selectedCustomerIds.length.toLocaleString()}명)`}
                </Button>
              )}
              {/* 공개DB 해제 (공개DB 모드에서만) */}
              {isAdmin && isPublicDb && (
                <Button
                  size="sm"
                  onClick={() => handleMarkPublic(false)}
                  disabled={markingPublic}
                  className="text-xs bg-purple-600 hover:bg-purple-700"
                >
                  <Globe className="w-3.5 h-3.5 mr-1" />
                  {markingPublic ? '처리 중...' : `공개DB 해제 (${selectedCustomerIds.length.toLocaleString()}명)`}
                </Button>
              )}
              {/* 관리자 DB 모드: 일괄 삭제 */}
              {isAdmin && isAdminDb && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {deleting ? '삭제 중...' : `삭제 (${selectedCustomerIds.length.toLocaleString()}명)`}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedCustomerIds([])}
                className="text-xs"
              >
                선택 취소
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 검색 영역 */}
      <div className="container mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow-sm p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            {/* 이름 검색 */}
            <div className="flex-1 relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <Input
                type="text"
                placeholder="이름 검색 (Enter)"
                value={nameTerm}
                onChange={(e) => setNameTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNameSearch();
                  }
                }}
                className="pl-9 md:pl-10 text-sm md:text-base"
              />
            </div>
            {/* 전화번호 검색 */}
            <div className="flex-1 relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <Input
                type="text"
                placeholder="전화번호 검색 (Enter)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                className="pl-9 md:pl-10 text-sm md:text-base"
              />
            </div>
            {/* 날짜별 등록 고객확인 */}
            <DateFilterCalendar
              selectedDate={dateFilter || null}
              onDateSelect={(date) => updateUrlParams({ date: date || null, page: 1 })}
              userId={userId}
              viewAll={viewAll}
              buttonText="날짜별 등록 고객확인"
            />
            {/* 검색 초기화 버튼 */}
            {(debouncedSearchTerm || debouncedNameTerm || dateFilter) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setNameTerm('');
                  updateUrlParams({ q: null, name: null, date: null, page: 1 });
                }}
                className="text-sm"
              >
                초기화
              </Button>
            )}
          </div>
          {/* 현재 검색 조건 표시 */}
          {(debouncedSearchTerm || debouncedNameTerm) && (
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {debouncedNameTerm && (
                <Badge variant="secondary">
                  이름: {debouncedNameTerm}
                </Badge>
              )}
              {debouncedSearchTerm && (
                <Badge variant="secondary">
                  전화번호: {debouncedSearchTerm}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* 통계 카드 - 모바일: 2개, PC: 4개 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">전체 고객</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg md:text-2xl font-bold">{statistics.totalCustomers.toLocaleString()}</p>
                    {statistics.duplicateCustomers > 0 && (
                      <span className="text-xs md:text-sm text-red-500 font-medium">
                        / 중복 {statistics.duplicateCustomers.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <User className="w-6 h-6 md:w-8 md:h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          {/* 부재 고객 - 전체 고객 바로 옆 */}
          <Card
            className={`cursor-pointer hover:shadow-md transition-shadow ${showAbsenceOnly ? 'ring-2 ring-orange-500' : ''}`}
            onClick={() => updateUrlParams({ absence: !showAbsenceOnly, page: 1 })}
          >
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-gray-500">부재 고객</p>
                  <p className="text-lg md:text-2xl font-bold">{statistics.absenceCustomers}</p>
                </div>
                <PhoneOff className="w-6 h-6 md:w-8 md:h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          {/* PC에서만 표시 */}
          <Card className="hidden md:block">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">오늘 통화</p>
                  <p className="text-2xl font-bold">{statistics.todayCallLogs}</p>
                </div>
                <Phone className="w-8 h-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="hidden md:block">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">예정 방문</p>
                  <p className="text-2xl font-bold">{statistics.scheduledVisits}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 관리자 DB 통계 카드 */}
        {isAdminDb && (
          <div className="mb-4 md:mb-6">
            <Card className="border-indigo-200 bg-indigo-50">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="w-6 h-6 md:w-8 md:h-8 text-indigo-600" />
                    <div>
                      <p className="text-sm font-medium text-indigo-800">관리자 보유 DB</p>
                      <p className="text-xs text-indigo-600">선택 후 공개DB 전환 또는 삭제 가능 {excludeDuplicates && '(중복/블랙리스트 제외됨)'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-700">{totalCount.toLocaleString()}명</p>
                    <p className="text-xs text-indigo-500">공개DB: {publicCustomerCount.toLocaleString()}명</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 공개DB 통계 카드 (공개DB 모드일 때만 강조 표시) */}
        {isPublicDb && (
          <div className="mb-4 md:mb-6">
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-6 h-6 md:w-8 md:h-8 text-purple-600" />
                    <div>
                      <p className="text-sm font-medium text-purple-800">공개DB 고객</p>
                      <p className="text-xs text-purple-600">모든 직원이 열람 가능 - 통화 후 &quot;내 DB로 가져오기&quot; 가능</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">{publicCustomerCount.toLocaleString()}명</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 부재 고객 회수 통계 카드 */}
        {isReclaimAbsence && (
          <div className="mb-4 md:mb-6">
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-3 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PhoneOff className="w-6 h-6 md:w-8 md:h-8 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">직원 보유 부재 고객</p>
                      <p className="text-xs text-orange-600">선택 후 관리자 DB로 회수 → 공개DB 전환 가능</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-orange-700">{totalCount.toLocaleString()}명</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 직원별 필터 카드 - PC에서만 (관리자 DB 모드에서는 숨김) */}
        {users.length > 0 && !isAdminDb && !isReclaimAbsence && (
          <div className="mb-4 md:mb-6 hidden md:block">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUserCards(!showUserCards)}
                className="text-sm text-gray-600"
              >
                {showUserCards ? '직원별 목록 접기 ▲' : '직원별 목록 펼치기 ▼'}
              </Button>
            </div>
            {showUserCards && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {users.map(user => (
                  <Card
                    key={user.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${userId === user.id ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={() => {
                      if (userId === user.id) {
                        router.push('/dashboard/customers');
                      } else {
                        router.push(`/dashboard/customers?userId=${user.id}`);
                      }
                    }}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.role === 'TEAM_LEADER' ? '팀장' : user.role === 'HEAD' ? '본부장' : '직원'}</p>
                        </div>
                        <div className="text-right ml-2">
                          <p className="text-xl font-bold text-blue-600">{user._count?.customers || 0}</p>
                          <p className="text-xs text-gray-500">명</p>
                        </div>
                      </div>
                      {userId === user.id && (
                        <Badge className="mt-2 text-xs w-full justify-center">선택됨</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 고객 목록 - 카드형 또는 리스트형 */}
        {viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {Array.isArray(filteredCustomers) && filteredCustomers.map((customer, index) => (
            <Card
              key={customer.id}
              className={`hover:shadow-lg transition-shadow cursor-pointer ${customer.isBlacklisted ? 'border-red-500 border-2 bg-red-50' : ''}`}
              onClick={() => handleCustomerClick(customer.id, index)}
            >
              {/* 블랙리스트 경고 배너 */}
              {customer.isBlacklisted && (
                <div className="bg-red-600 text-white px-3 py-2 text-sm font-medium flex items-center gap-2 rounded-t-lg">
                  <Ban className="w-4 h-4" />
                  블랙리스트 - {customer.blacklistInfo?.reason} ({customer.blacklistInfo?.registeredBy?.name || '등록자 미상'})
                </div>
              )}
              <CardHeader className="pb-3 p-3 md:p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 md:gap-3 flex-1">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0 relative ${customer.isBlacklisted ? 'bg-red-200' : 'bg-blue-100'}`}>
                      {customer.isBlacklisted ? (
                        <Ban className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
                      ) : (
                        <User className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                      )}
                      <span className="absolute -top-1 -left-1 bg-gray-700 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {getCustomerNumber(index)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base md:text-lg truncate flex items-center gap-2">
                        <span>{customer.name || '이름 없음'}</span>
                        {((customer._count?.callLogs || 0) > 0 || (customer.memo && customer.memo.trim().length > 0)) && (
                          <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                            (활성화)
                          </span>
                        )}
                        {customer.isDuplicate && customer.duplicateWith && customer.duplicateWith.length > 0 && (
                          <span
                            className="text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded whitespace-nowrap cursor-help"
                            title={isAdmin
                              ? `중복: ${customer.duplicateWith.map((d: { name: string | null; assignedUser: { name: string } | null }) =>
                                  `${d.name || '이름없음'} (${d.assignedUser?.name || '미배분'})`
                                ).join(', ')}`
                              : '다른 직원과 중복된 고객입니다'
                            }
                          >
                            중복 {isAdmin && customer.duplicateWith.length > 0 && (
                              <span className="text-amber-600">
                                ({customer.duplicateWith.map((d: { name: string | null; assignedUser: { name: string } | null }) =>
                                  d.assignedUser?.name || '미배분'
                                ).join(', ')})
                              </span>
                            )}
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
                  {isPublicDb ? (
                    <Badge className="text-xs flex-shrink-0 bg-purple-100 text-purple-700 border-purple-300">공개DB</Badge>
                  ) : customer.assignedUser ? (
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {customer.assignedUser.name}
                    </Badge>
                  ) : null}
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
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0}
                        onChange={handleToggleAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                      번호
                    </th>
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
                      {isPublicDb ? '상태' : '담당자'}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관심/통화/방문
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      등록일
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      최신 작성일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Array.isArray(filteredCustomers) && filteredCustomers.map((customer, index) => (
                    <tr
                      key={customer.id}
                      className={`hover:bg-gray-50 transition-colors ${customer.isBlacklisted ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-3 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedCustomerIds.includes(customer.id)}
                          onChange={() => handleToggleCustomer(customer.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center cursor-pointer" onClick={() => handleCustomerClick(customer.id, index)}>
                        <span className="text-sm font-bold text-gray-700">
                          {getCustomerNumber(index)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleCustomerClick(customer.id, index)}>
                        <div className="flex items-center gap-2">
                          {customer.isBlacklisted && (
                            <Ban className="w-4 h-4 text-red-600 flex-shrink-0" />
                          )}
                          <span className={`font-medium ${customer.isBlacklisted ? 'text-red-600' : 'text-gray-900'}`}>
                            {customer.name || '이름 없음'}
                          </span>
                          {customer.isBlacklisted && (
                            <Badge
                              variant="destructive"
                              className="text-xs cursor-help"
                              title={`사유: ${customer.blacklistInfo?.reason} / 등록: ${customer.blacklistInfo?.registeredBy?.name || '미상'}`}
                            >
                              🚫 블랙
                            </Badge>
                          )}
                          {((customer._count?.callLogs || 0) > 0 || (customer.memo && customer.memo.trim().length > 0)) && (
                            <span className="text-xs font-medium text-green-600">
                              (활성화)
                            </span>
                          )}
                          {customer.isDuplicate && customer.duplicateWith && customer.duplicateWith.length > 0 && (
                            <span
                              className="text-xs font-medium text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded cursor-help"
                              title={isAdmin
                                ? `중복: ${customer.duplicateWith.map((d: { name: string | null; assignedUser: { name: string } | null }) =>
                                    `${d.name || '이름없음'} (${d.assignedUser?.name || '미배분'})`
                                  ).join(', ')}`
                                : '다른 직원과 중복된 고객입니다'
                              }
                            >
                              중복 {isAdmin && customer.duplicateWith.length > 0 && (
                                <span className="text-amber-600">
                                  ({customer.duplicateWith.map((d: { name: string | null; assignedUser: { name: string } | null }) =>
                                    d.assignedUser?.name || '미배분'
                                  ).join(', ')})
                                </span>
                              )}
                            </span>
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
                      <td className="px-4 py-4 cursor-pointer" onClick={() => handleCustomerClick(customer.id, index)}>
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
                      <td className="px-4 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleCustomerClick(customer.id, index)}>
                        {isPublicDb ? (
                          <Badge className="bg-purple-100 text-purple-700 border-purple-300">공개DB</Badge>
                        ) : customer.assignedUser ? (
                          <Badge variant="outline">{customer.assignedUser.name}</Badge>
                        ) : (
                          <span className="text-sm text-gray-400">미배정</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap cursor-pointer" onClick={() => handleCustomerClick(customer.id, index)}>
                        <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
                          <span>{customer._count?.interestCards || 0}</span>
                          <span>/</span>
                          <span>{customer._count?.callLogs || 0}</span>
                          <span>/</span>
                          <span>{customer._count?.visitSchedules || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer" onClick={() => handleCustomerClick(customer.id, index)}>
                        {new Date(customer.createdAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm cursor-pointer" onClick={() => handleCustomerClick(customer.id, index)}>
                        {customer.updatedAt && customer.updatedAt !== customer.createdAt ? (
                          <span className="text-blue-600">
                            {new Date(customer.updatedAt).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
                onClick={() => updateUrlParams({ page: Math.max(1, currentPage - 1) })}
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
                    onClick={() => updateUrlParams({ page: pageNum })}
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
                onClick={() => updateUrlParams({ page: Math.min(totalPages, currentPage + 1) })}
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