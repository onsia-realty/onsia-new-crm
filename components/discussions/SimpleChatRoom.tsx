'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Send, Calendar, MessageSquare, Users, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    role: string;
  };
}

export default function SimpleChatRoom() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'visit' | 'suggestion'>('visit');
  const [visitMessages, setVisitMessages] = useState<Message[]>([]);
  const [suggestionMessages, setSuggestionMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤 (사용자가 맨 아래에 있을 때만)
  // 채팅 컨테이너 내부만 스크롤 — scrollIntoView는 부모 페이지 전체를 스크롤할 수 있으므로 사용 금지
  const scrollToBottom = () => {
    if (!isUserScrolling && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  // 스크롤 위치 감지
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsUserScrolling(!isAtBottom);
    }
  };

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitMessages, suggestionMessages]);

  // 데이터 로드
  const fetchMessages = async () => {
    try {
      // 방문채팅 메시지
      const visitRes = await fetch('/api/chat/visit');
      if (visitRes.ok) {
        const result = await visitRes.json();
        if (result.success) {
          setVisitMessages(result.messages || []);
        }
      }

      // 건의사항 메시지
      const suggestionRes = await fetch('/api/chat/suggestion');
      if (suggestionRes.ok) {
        const result = await suggestionRes.json();
        if (result.success) {
          setSuggestionMessages(result.messages || []);
        }
      }

      // 접속자 수
      const onlineRes = await fetch('/api/chat/online');
      if (onlineRes.ok) {
        const result = await onlineRes.json();
        if (result.success) {
          setOnlineCount(result.count || 0);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    fetchMessages();
    // 10초마다 갱신
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, []);

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/chat/${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      });

      const result = await response.json();

      if (result.success) {
        setNewMessage('');
        setIsUserScrolling(false); // 메시지 전송 후 자동 스크롤 활성화
        fetchMessages();
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

  // 메시지 삭제
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('이 메시지를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/chat/messages/${messageId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: '성공',
          description: '메시지가 삭제되었습니다.',
        });
        fetchMessages();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: '오류',
        description: '메시지 삭제에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const currentMessages = activeTab === 'visit' ? visitMessages : suggestionMessages;

  return (
    <Card className="flex flex-col shadow-lg" style={{ height: '700px' }}>
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-indigo-700 text-lg flex items-center gap-2">
              💬 온시아 채팅
              <Badge variant="secondary" className="text-xs">실시간</Badge>
            </div>
            <p className="text-xs text-indigo-600 mt-0.5">팀원들과 자유롭게 소통하세요</p>
          </div>
          <div className="flex items-center gap-2 bg-green-100 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <Users className="w-3.5 h-3.5 text-green-700" />
            <span className="text-xs font-semibold text-green-700">{onlineCount}명</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'visit' | 'suggestion')} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-3 mb-2 grid grid-cols-2 shrink-0">
            <TabsTrigger value="visit" className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              방문채팅
              {visitMessages.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {visitMessages.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suggestion" className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              건의사항
              {suggestionMessages.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {suggestionMessages.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 flex flex-col overflow-hidden">
            <TabsContent value="visit" className="flex-1 flex flex-col m-0 overflow-hidden">
              <ChatMessages
                messages={currentMessages}
                currentUserId={session?.user?.id}
                messagesEndRef={messagesEndRef}
                scrollContainerRef={scrollContainerRef}
                handleScroll={handleScroll}
                onDeleteMessage={handleDeleteMessage}
              />
            </TabsContent>

            <TabsContent value="suggestion" className="flex-1 flex flex-col m-0 overflow-hidden">
              <ChatMessages
                messages={currentMessages}
                currentUserId={session?.user?.id}
                messagesEndRef={messagesEndRef}
                scrollContainerRef={scrollContainerRef}
                handleScroll={handleScroll}
                onDeleteMessage={handleDeleteMessage}
              />
            </TabsContent>
          </div>

          {/* 입력창 */}
          <div className="p-3 border-t bg-white shrink-0">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  activeTab === 'visit'
                    ? '방문 관련 메시지를 입력하세요...'
                    : '건의사항을 입력하세요...'
                }
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || loading}
                size="icon"
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// 메시지 리스트 컴포넌트
function ChatMessages({
  messages,
  currentUserId,
  messagesEndRef,
  scrollContainerRef,
  handleScroll,
  onDeleteMessage,
}: {
  messages: Message[];
  currentUserId?: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  onDeleteMessage: (messageId: string) => void;
}) {
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8 overflow-hidden">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">아직 메시지가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">첫 메시지를 남겨보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gradient-to-b from-gray-50 to-white"
    >
      {messages.map((message) => {
        const isMyMessage = message.user.id === currentUserId;
        const isHovered = hoveredMessageId === message.id;
        return (
          <div
            key={message.id}
            className={`flex gap-2 ${isMyMessage ? 'justify-end' : 'justify-start'}`}
            onMouseEnter={() => setHoveredMessageId(message.id)}
            onMouseLeave={() => setHoveredMessageId(null)}
          >
            <div className={`max-w-[70%] ${isMyMessage ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
              {/* 발신자 이름 */}
              <div className={`flex items-center gap-1.5 px-1 ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className={`text-sm font-medium ${isMyMessage ? 'text-gray-600' : 'text-gray-800'}`}>
                  {message.user.name}
                </span>
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                  {getRoleName(message.user.role)}
                </Badge>
              </div>

              {/* 메시지 내용과 시간 */}
              <div className={`flex items-end gap-2 ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* 삭제 버튼 (hover 시 표시) */}
                {isMyMessage && isHovered && (
                  <button
                    onClick={() => onDeleteMessage(message.id)}
                    className="mb-1 p-1 hover:bg-gray-200 rounded-full transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </button>
                )}

                {/* 시간 */}
                <span className="text-xs text-gray-400 mb-1">
                  {format(new Date(message.createdAt), 'HH:mm', { locale: ko })}
                </span>

                {/* 메시지 버블 */}
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    isMyMessage
                      ? 'bg-yellow-300 text-gray-900'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="text-base whitespace-pre-wrap break-words leading-relaxed">
                    {message.content}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

// 역할명 변환
function getRoleName(role: string): string {
  const roleMap: Record<string, string> = {
    EMPLOYEE: '직원',
    TEAM_LEADER: '팀장',
    HEAD: '본부장',
    ADMIN: '관리자',
    CEO: '대표',
  };
  return roleMap[role] || role;
}
