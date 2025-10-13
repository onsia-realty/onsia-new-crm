'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface InterestCard {
  id: string;
  name: string;
  phone: string;
  residenceArea: string | null;
  expectedBudget: number | null;
  ownedProperties: string | null;
  assignedUser: {
    id: string;
    name: string;
  } | null;
  visitSchedules: Array<{
    id: string;
    visitDate: string;
    visitType: string;
    location: string;
  }>;
  createdAt: string;
}

export default function InterestCardsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [cards, setCards] = useState<InterestCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await fetch('/api/interest-cards');
      const result = await response.json();

      if (result.success) {
        setCards(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch interest cards:', error);
    } finally {
      setLoading(false);
    }
  };

  // 관심 부동산 파싱
  const parseOwnedProperties = (json: string | null) => {
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

  // 방문일정 포맷
  const formatVisitSchedule = (schedules: InterestCard['visitSchedules']) => {
    if (schedules.length === 0) return '예정 없음';
    const schedule = schedules[0];
    const date = new Date(schedule.visitDate);
    return `${date.getMonth() + 1}/${date.getDate()} ${schedule.location}`;
  };

  // 필터링
  const filteredCards = cards.filter((card) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      card.name.toLowerCase().includes(search) ||
      card.residenceArea?.toLowerCase().includes(search) ||
      card.phone.includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">관심 카드 (A등급 고객)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A등급으로 지정된 VIP 고객 목록입니다
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/customers')}>
          <User className="mr-2 h-4 w-4" /> 고객 관리
        </Button>
      </div>

      {/* 검색 */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="고객명, 거주지역, 전화번호로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* 통계 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 A등급 고객</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cards.length}명</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">방문 예정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cards.filter(c => c.visitSchedules.length > 0).length}명
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 투자금액</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cards.length > 0
                ? Math.round(
                    cards.reduce((sum, c) => sum + (c.expectedBudget || 0), 0) / cards.length
                  ).toLocaleString()
                : 0}
              만원
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 카드 목록 */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
      ) : filteredCards.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm ? '검색 결과가 없습니다.' : 'A등급 고객이 없습니다.'}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((card) => (
            <Card
              key={card.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/dashboard/customers/${card.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{card.name}</CardTitle>
                  <Badge className="bg-red-100 text-red-800">A등급</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">관심 부동산</span>
                  <span className="font-medium">{parseOwnedProperties(card.ownedProperties)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">거주지역</span>
                  <span className="font-medium">{card.residenceArea || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">예상투자금액</span>
                  <span className="font-medium">
                    {card.expectedBudget ? `${card.expectedBudget.toLocaleString()}만원` : '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">방문일정</span>
                  <span className="font-medium text-blue-600">
                    {formatVisitSchedule(card.visitSchedules)}
                  </span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    담당: {card.assignedUser?.name || '미배정'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {card.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
