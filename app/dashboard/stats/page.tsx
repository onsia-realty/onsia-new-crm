'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Phone, Calendar, TrendingUp, ChartBar, Database, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Statistics {
  totalCustomers: number;
  todayCallLogs: number;
  scheduledVisits: number;
  monthlyContracts: number;
}

interface DetailedStats {
  customersBySite: { name: string; value: number }[];
  dbUpdateStats: {
    customers: { yesterday: number; today: number; week: number };
    calls: { yesterday: number; today: number; week: number };
  };
  monthlyTrend: { month: string; customers: number; contracts: number }[];
  contractList: { id: string; customerName: string; site: string; date: string }[];
}

export default function StatsPage() {
  const { data: session } = useSession();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // 기본 통계
        const statsResponse = await fetch('/api/statistics');
        const statsResult = await statsResponse.json();
        if (statsResult.success) {
          setStatistics(statsResult.data);
        }

        // 상세 통계 (실제 DB 데이터)
        const detailedResponse = await fetch('/api/statistics/detailed');
        const detailedResult = await detailedResponse.json();
        if (detailedResult.success) {
          setDetailedStats(detailedResult.data);
        }
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">통계 로딩 중...</p>
        </div>
      </div>
    );
  }

  const summaryStats = [
    {
      title: '전체 고객',
      value: statistics?.totalCustomers || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: '오늘 통화',
      value: statistics?.todayCallLogs || 0,
      icon: Phone,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: '예정 방문',
      value: statistics?.scheduledVisits || 0,
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: '월 계약',
      value: statistics?.monthlyContracts || 0,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <ChartBar className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">통계 대시보드</h1>
              <p className="text-sm text-gray-600">전체 영업 활동 및 성과 통계</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* 요약 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {summaryStats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-1">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold">{stat.value.toLocaleString()}</p>
                    </div>
                    <div className={`${stat.bgColor} p-3 rounded-lg`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 차트 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 현장별 고객 DB 현황 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                현장별 고객 DB 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={detailedStats?.customersBySite || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" name="고객 수" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* DB 업데이트 현황 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                DB 업데이트 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 고객 등록 현황 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">신규 고객 등록</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <p className="text-xs text-gray-500 mb-1">어제</p>
                      <p className="text-2xl font-bold text-gray-700">
                        {detailedStats?.dbUpdateStats.customers.yesterday || 0}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <p className="text-xs text-blue-600 mb-1">오늘</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {detailedStats?.dbUpdateStats.customers.today || 0}
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <p className="text-xs text-green-600 mb-1">이번주</p>
                      <p className="text-2xl font-bold text-green-700">
                        {detailedStats?.dbUpdateStats.customers.week || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 통화 기록 현황 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">통화 기록</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <p className="text-xs text-gray-500 mb-1">어제</p>
                      <p className="text-2xl font-bold text-gray-700">
                        {detailedStats?.dbUpdateStats.calls.yesterday || 0}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <p className="text-xs text-purple-600 mb-1">오늘</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {detailedStats?.dbUpdateStats.calls.today || 0}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                      <p className="text-xs text-orange-600 mb-1">이번주</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {detailedStats?.dbUpdateStats.calls.week || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 계약 현황 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              최근 계약 현황 (계약대장)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailedStats?.contractList && detailedStats.contractList.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="flex gap-3 pb-2">
                  {detailedStats.contractList.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex-shrink-0 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 min-w-[200px]"
                    >
                      <p className="font-semibold text-green-800 truncate">
                        {contract.customerName}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{contract.site}</p>
                      <p className="text-xs text-gray-500 mt-2">{contract.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>최근 계약 내역이 없습니다</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 추가 정보 */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>📊 실시간 통계:</strong> 모든 차트와 통계는 데이터베이스에서 실시간으로 조회됩니다.
            {session?.user.role === 'EMPLOYEE' && ' (현재 본인에게 배정된 고객 데이터만 표시됩니다)'}
          </p>
          <p className="text-sm text-blue-800 mt-2">
            <strong>📅 월별 추이:</strong> 최근 6개월간의 신규 고객 및 계약 데이터를 표시합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
