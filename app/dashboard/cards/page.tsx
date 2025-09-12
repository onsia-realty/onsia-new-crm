'use client';

import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
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

export default function InterestCardsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // 임시 데이터
  const cards = [
    {
      id: '1',
      customerName: '김철수',
      propertyType: '아파트',
      transactionType: '매매',
      location: '강남구 삼성동',
      priceRange: '10억~15억',
      area: '34평',
      priority: 'HIGH',
      status: 'ACTIVE',
      createdAt: '2024-01-15',
    },
    {
      id: '2',
      customerName: '이영희',
      propertyType: '빌라',
      transactionType: '전세',
      location: '송파구 잠실동',
      priceRange: '3억~5억',
      area: '25평',
      priority: 'MEDIUM',
      status: 'ACTIVE',
      createdAt: '2024-01-14',
    },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">관심 카드</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> 새 카드 추가
        </Button>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="고객명, 위치로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="ACTIVE">진행중</SelectItem>
            <SelectItem value="COMPLETED">완료</SelectItem>
            <SelectItem value="CANCELLED">취소</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" /> 상세 필터
        </Button>
      </div>

      {/* 카드 목록 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{card.customerName}</CardTitle>
                <div className="flex gap-2">
                  <Badge className={getPriorityColor(card.priority)}>
                    {card.priority === 'HIGH' ? '높음' : card.priority === 'MEDIUM' ? '보통' : '낮음'}
                  </Badge>
                  <Badge className={getStatusColor(card.status)}>
                    {card.status === 'ACTIVE' ? '진행중' : card.status === 'COMPLETED' ? '완료' : '취소'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">매물 유형</span>
                <span className="font-medium">{card.propertyType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">거래 유형</span>
                <span className="font-medium">{card.transactionType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">위치</span>
                <span className="font-medium">{card.location}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">가격대</span>
                <span className="font-medium">{card.priceRange}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">면적</span>
                <span className="font-medium">{card.area}</span>
              </div>
              <div className="pt-2 border-t">
                <span className="text-xs text-muted-foreground">등록일: {card.createdAt}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}