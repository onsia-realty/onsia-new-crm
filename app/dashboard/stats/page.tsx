'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Phone, Calendar, TrendingUp, ChartBar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Statistics {
  totalCustomers: number;
  todayCallLogs: number;
  scheduledVisits: number;
  monthlyContracts: number;
}

interface DetailedStats {
  customersBySource: { name: string; value: number }[];
  customersByGrade: { name: string; value: number }[];
  monthlyTrend: { month: string; customers: number; contracts: number }[];
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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

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
          {/* 고객 출처별 분포 */}
          <Card>
            <CardHeader>
              <CardTitle>고객 출처별 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={detailedStats?.customersBySource || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {detailedStats?.customersBySource.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 고객 등급별 분포 */}
          <Card>
            <CardHeader>
              <CardTitle>고객 등급별 분포</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={detailedStats?.customersByGrade || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" name="고객 수" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* 월별 추이 */}
        <Card>
          <CardHeader>
            <CardTitle>월별 고객 및 계약 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={detailedStats?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="customers"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="신규 고객"
                />
                <Line
                  type="monotone"
                  dataKey="contracts"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  name="계약 건수"
                />
              </LineChart>
            </ResponsiveContainer>
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
