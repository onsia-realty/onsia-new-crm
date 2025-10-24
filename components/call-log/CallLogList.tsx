'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Clock, User, Calendar, MessageSquare, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CallLog {
  id: string;
  callType: 'INBOUND' | 'OUTBOUND';
  duration?: number;
  result?: string;
  comment: string;
  nextAction?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
}

interface CallLogListProps {
  customerId?: string;
  userId?: string;
  limit?: number;
  showCustomer?: boolean;
}

export function CallLogList({
  customerId,
  userId,
  limit,
  showCustomer = true,
}: CallLogListProps) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchCallLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);
      if (userId) params.append('userId', userId);
      if (limit) params.append('limit', limit.toString());

      const response = await fetch(`/api/call-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch call logs');
      
      const data = await response.json();
      setCallLogs(data);
    } catch (error) {
      console.error('Failed to fetch call logs:', error);
    } finally {
      setLoading(false);
    }
  }, [customerId, userId, limit]);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}분 ${remainingSeconds}초`;
  };

  const toggleExpanded = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          로딩 중...
        </CardContent>
      </Card>
    );
  }

  if (callLogs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-gray-500">
          통화 기록이 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {callLogs.map((log) => {
        const isExpanded = expandedLogs.has(log.id);
        
        return (
          <Card key={log.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={log.callType === 'INBOUND' ? 'secondary' : 'default'}>
                      <Phone className="h-3 w-3 mr-1" />
                      {log.callType === 'INBOUND' ? '수신' : '발신'}
                    </Badge>
                    {log.result && (
                      <Badge variant="outline">{log.result}</Badge>
                    )}
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(log.duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    {showCustomer && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.customer.name} ({log.customer.phone})
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {log.user.name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className={`text-sm ${isExpanded ? '' : 'line-clamp-2'}`}>
                      <MessageSquare className="inline h-3 w-3 mr-1 text-gray-400" />
                      {log.comment}
                    </div>
                    
                    {log.nextAction && isExpanded && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                        <strong className="text-yellow-800">후속 조치:</strong>
                        <p className="text-yellow-700 mt-1">{log.nextAction}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded(log.id)}
                  className="ml-2"
                >
                  <ChevronRight 
                    className={`h-4 w-4 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}