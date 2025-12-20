'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Send, Calendar, MessageSquare, Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Discussion {
  id: string;
  type: 'VISIT_SCHEDULE' | 'SUGGESTION';
  title: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  visitSchedule?: {
    id: string;
    visitDate: string;
    visitType: string;
    location: string;
    customer: {
      id: string;
      name: string;
      phone: string;
    };
    user: {
      id: string;
      name: string;
    };
  };
  messages: Array<{
    id: string;
    content: string;
    isSystemMsg: boolean;
    createdAt: string;
    user: {
      id: string;
      name: string;
      role: string;
    };
  }>;
  _count: {
    messages: number;
  };
  createdAt: string;
}

export default function DiscussionChat() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'visit' | 'suggestion'>('visit');
  const [visitDiscussions, setVisitDiscussions] = useState<Discussion[]>([]);
  const [suggestionDiscussions, setSuggestionDiscussions] = useState<Discussion[]>([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewSuggestionDialog, setShowNewSuggestionDialog] = useState(false);
  const [newSuggestion, setNewSuggestion] = useState({
    title: '',
    content: '',
    priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedDiscussion?.messages]);

  // 데이터 로드
  const fetchDiscussions = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // 오늘 방문 일정
      const visitRes = await fetch(`/api/discussions?type=VISIT_SCHEDULE&date=${today}`);
      if (visitRes.ok) {
        const result = await visitRes.json();
        if (result.success) {
          setVisitDiscussions(result.data || []);
        }
      }

      // 건의사항
      const suggestionRes = await fetch(`/api/discussions?type=SUGGESTION`);
      if (suggestionRes.ok) {
        const result = await suggestionRes.json();
        if (result.success) {
          setSuggestionDiscussions(result.data || []);
        }
      }
    } catch (error) {
      console.error('Error fetching discussions:', error);
    }
  };

  useEffect(() => {
    fetchDiscussions();
    // 30초마다 갱신
    const interval = setInterval(fetchDiscussions, 30000);
    return () => clearInterval(interval);
  }, []);

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedDiscussion) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/discussions/${selectedDiscussion.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });

      const result = await response.json();

      if (result.success) {
        setNewMessage('');
        fetchDiscussions();
        // 선택된 토론 업데이트
        if (selectedDiscussion) {
          const updated = activeTab === 'visit'
            ? visitDiscussions.find(d => d.id === selectedDiscussion.id)
            : suggestionDiscussions.find(d => d.id === selectedDiscussion.id);
          if (updated) {
            setSelectedDiscussion(updated);
          }
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: '오류',
        description: '메시지 전송에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 새 건의사항 등록
  const handleCreateSuggestion = async () => {
    if (!newSuggestion.title.trim() || !newSuggestion.content.trim()) {
      toast({
        title: '입력 오류',
        description: '제목과 내용을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSuggestion),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '등록 완료',
          description: '건의사항이 등록되었습니다.',
        });
        setShowNewSuggestionDialog(false);
        setNewSuggestion({ title: '', content: '', priority: 'MEDIUM' });
        fetchDiscussions();
        setActiveTab('suggestion');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error creating suggestion:', error);
      toast({
        title: '오류',
        description: '건의사항 등록에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      PENDING: { label: '대기중', color: 'bg-gray-100 text-gray-700' },
      IN_PROGRESS: { label: '검토중', color: 'bg-blue-100 text-blue-700' },
      COMPLETED: { label: '완료', color: 'bg-green-100 text-green-700' },
      REJECTED: { label: '반려', color: 'bg-red-100 text-red-700' },
    };
    const info = statusMap[status as keyof typeof statusMap] || statusMap.PENDING;
    return <Badge className={info.color}>{info.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap = {
      HIGH: { label: '높음', color: 'bg-red-100 text-red-700' },
      MEDIUM: { label: '보통', color: 'bg-yellow-100 text-yellow-700' },
      LOW: { label: '낮음', color: 'bg-gray-100 text-gray-700' },
    };
    const info = priorityMap[priority as keyof typeof priorityMap] || priorityMap.MEDIUM;
    return <Badge className={info.color}>{info.label}</Badge>;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-blue-700 text-sm">💬 팀 채팅</div>
            <p className="text-xs text-blue-600 font-medium">(실시간)</p>
          </div>
          {activeTab === 'suggestion' && (
            <Button size="sm" onClick={() => setShowNewSuggestionDialog(true)} className="h-7">
              <Plus className="w-3.5 h-3.5 mr-1" />
              건의사항 작성
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'visit' | 'suggestion')} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mb-2">
            <TabsTrigger value="visit" className="flex-1">
              <Calendar className="w-4 h-4 mr-1.5" />
              오늘 방문 ({visitDiscussions.length})
            </TabsTrigger>
            <TabsTrigger value="suggestion" className="flex-1">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              건의사항 ({suggestionDiscussions.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 flex flex-col min-h-0">
            <TabsContent value="visit" className="flex-1 flex m-0">
              <DiscussionList
                discussions={visitDiscussions}
                selectedId={selectedDiscussion?.id}
                onSelect={setSelectedDiscussion}
                type="visit"
              />
              <MessageArea
                discussion={selectedDiscussion}
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                onSend={handleSendMessage}
                loading={loading}
                messagesEndRef={messagesEndRef}
                getStatusBadge={getStatusBadge}
                getPriorityBadge={getPriorityBadge}
              />
            </TabsContent>

            <TabsContent value="suggestion" className="flex-1 flex m-0">
              <DiscussionList
                discussions={suggestionDiscussions}
                selectedId={selectedDiscussion?.id}
                onSelect={setSelectedDiscussion}
                type="suggestion"
              />
              <MessageArea
                discussion={selectedDiscussion}
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                onSend={handleSendMessage}
                loading={loading}
                messagesEndRef={messagesEndRef}
                getStatusBadge={getStatusBadge}
                getPriorityBadge={getPriorityBadge}
              />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>

      {/* 새 건의사항 등록 다이얼로그 */}
      <Dialog open={showNewSuggestionDialog} onOpenChange={setShowNewSuggestionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>건의사항 작성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">제목 *</Label>
              <Input
                id="title"
                value={newSuggestion.title}
                onChange={(e) => setNewSuggestion({ ...newSuggestion, title: e.target.value })}
                placeholder="건의사항 제목을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="priority">우선순위</Label>
              <Select
                value={newSuggestion.priority}
                onValueChange={(value: 'HIGH' | 'MEDIUM' | 'LOW') =>
                  setNewSuggestion({ ...newSuggestion, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">높음</SelectItem>
                  <SelectItem value="MEDIUM">보통</SelectItem>
                  <SelectItem value="LOW">낮음</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="content">내용 *</Label>
              <Textarea
                id="content"
                value={newSuggestion.content}
                onChange={(e) => setNewSuggestion({ ...newSuggestion, content: e.target.value })}
                placeholder="건의사항을 자세히 작성해주세요..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSuggestionDialog(false)}>
              취소
            </Button>
            <Button onClick={handleCreateSuggestion} disabled={loading}>
              {loading ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// 토론 목록 컴포넌트
function DiscussionList({
  discussions,
  selectedId,
  onSelect,
  type,
}: {
  discussions: Discussion[];
  selectedId?: string;
  onSelect: (discussion: Discussion) => void;
  type: 'visit' | 'suggestion';
}) {
  if (discussions.length === 0) {
    return (
      <div className="w-1/3 border-r bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center text-gray-500 text-sm">
          {type === 'visit' ? '오늘 방문 일정이 없습니다' : '등록된 건의사항이 없습니다'}
        </div>
      </div>
    );
  }

  return (
    <div className="w-1/3 border-r bg-gray-50 overflow-y-auto">
      {discussions.map((discussion) => (
        <div
          key={discussion.id}
          onClick={() => onSelect(discussion)}
          className={`p-3 border-b cursor-pointer hover:bg-white transition-colors ${
            selectedId === discussion.id ? 'bg-white border-l-4 border-l-blue-500' : ''
          }`}
        >
          {type === 'visit' && discussion.visitSchedule && (
            <>
              <div className="font-medium text-sm mb-1">
                {discussion.visitSchedule.customer.name || '이름 없음'}
              </div>
              <div className="text-xs text-gray-600 space-y-0.5">
                <div>{format(new Date(discussion.visitSchedule.visitDate), 'HH:mm', { locale: ko })}</div>
                <div className="text-gray-500">{discussion.visitSchedule.location}</div>
                <div className="text-blue-600">{discussion.visitSchedule.user.name}</div>
              </div>
            </>
          )}
          {type === 'suggestion' && (
            <>
              <div className="font-medium text-sm mb-1 line-clamp-1">{discussion.title}</div>
              <div className="flex items-center gap-1 mb-1">
                {discussion.status && getStatusBadgeInline(discussion.status)}
                {discussion.priority && getPriorityBadgeInline(discussion.priority)}
              </div>
            </>
          )}
          <div className="text-xs text-gray-500 flex items-center justify-between mt-1">
            <span>{discussion._count.messages}개 메시지</span>
            <span>{format(new Date(discussion.createdAt), 'MM/dd', { locale: ko })}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 메시지 영역 컴포넌트
function MessageArea({
  discussion,
  newMessage,
  setNewMessage,
  onSend,
  loading,
  messagesEndRef,
  getStatusBadge,
  getPriorityBadge,
}: {
  discussion: Discussion | null;
  newMessage: string;
  setNewMessage: (value: string) => void;
  onSend: () => void;
  loading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  getStatusBadge: (status: string) => React.ReactNode;
  getPriorityBadge: (priority: string) => React.ReactNode;
}) {
  const { data: session } = useSession();

  // 선택된 토론이 변경될 때 메시지 영역 스크롤 리셋
  useEffect(() => {
    if (discussion) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [discussion, messagesEndRef]);

  if (!discussion) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500 text-sm">
          토론을 선택하세요
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b bg-white">
        {discussion.type === 'VISIT_SCHEDULE' && discussion.visitSchedule && (
          <div>
            <div className="font-semibold mb-1">
              {discussion.visitSchedule.customer.name} - {discussion.visitSchedule.location}
            </div>
            <div className="text-sm text-gray-600">
              {format(new Date(discussion.visitSchedule.visitDate), 'yyyy년 MM월 dd일 (EEE) HH:mm', { locale: ko })}
            </div>
          </div>
        )}
        {discussion.type === 'SUGGESTION' && (
          <div>
            <div className="font-semibold mb-2">{discussion.title}</div>
            <div className="flex gap-2">
              {discussion.status && getStatusBadge(discussion.status)}
              {discussion.priority && getPriorityBadge(discussion.priority)}
            </div>
          </div>
        )}
      </div>

      {/* 메시지 리스트 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {discussion.messages.map((message) => {
          const isMyMessage = message.user.id === session?.user?.id;
          return (
            <div key={message.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${isMyMessage ? 'bg-blue-500 text-white' : 'bg-white'} rounded-lg p-3 shadow-sm`}>
                {!isMyMessage && (
                  <div className="text-xs font-medium mb-1 text-gray-600">{message.user.name}</div>
                )}
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                <div className={`text-xs mt-1 ${isMyMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                  {format(new Date(message.createdAt), 'HH:mm', { locale: ko })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력창 */}
      <div className="p-4 border-t bg-white">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="메시지를 입력하세요..."
            disabled={loading}
          />
          <Button onClick={onSend} disabled={!newMessage.trim() || loading} size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// 인라인 배지 함수들
function getStatusBadgeInline(status: string) {
  const statusMap = {
    PENDING: { label: '대기중', Icon: Clock, color: 'text-gray-600' },
    IN_PROGRESS: { label: '검토중', Icon: AlertCircle, color: 'text-blue-600' },
    COMPLETED: { label: '완료', Icon: CheckCircle, color: 'text-green-600' },
    REJECTED: { label: '반려', Icon: AlertCircle, color: 'text-red-600' },
  };
  const info = statusMap[status as keyof typeof statusMap] || statusMap.PENDING;
  const { Icon } = info;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${info.color}`}>
      <Icon className="w-3 h-3" />
      {info.label}
    </span>
  );
}

function getPriorityBadgeInline(priority: string) {
  const priorityMap = {
    HIGH: '높음',
    MEDIUM: '보통',
    LOW: '낮음',
  };
  return (
    <span className="text-xs text-gray-600">
      {priorityMap[priority as keyof typeof priorityMap] || '보통'}
    </span>
  );
}
