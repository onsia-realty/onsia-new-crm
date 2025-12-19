'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Send, Calendar, MessageSquare, Users } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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

  const currentMessages = activeTab === 'visit' ? visitMessages : suggestionMessages;

  return (
    <Card className="h-full flex flex-col shadow-lg">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-indigo-700 text-base flex items-center gap-2">
              💬 팀 채팅
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

      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'visit' | 'suggestion')} className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-3 mb-2 grid grid-cols-2">
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

          <div className="flex-1 flex flex-col min-h-0">
            <TabsContent value="visit" className="flex-1 flex flex-col m-0">
              <ChatMessages
                messages={currentMessages}
                currentUserId={session?.user?.id}
                messagesEndRef={messagesEndRef}
              />
            </TabsContent>

            <TabsContent value="suggestion" className="flex-1 flex flex-col m-0">
              <ChatMessages
                messages={currentMessages}
                currentUserId={session?.user?.id}
                messagesEndRef={messagesEndRef}
              />
            </TabsContent>
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
}: {
  messages: Message[];
  currentUserId?: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">아직 메시지가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">첫 메시지를 남겨보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50 to-white">
      {messages.map((message) => {
        const isMyMessage = message.user.id === currentUserId;
        return (
          <div key={message.id} className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] ${isMyMessage ? 'items-end' : 'items-start'} flex flex-col`}>
              {!isMyMessage && (
                <div className="text-xs font-medium mb-1 px-1 flex items-center gap-1.5">
                  <span className="text-gray-700">{message.user.name}</span>
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {getRoleName(message.user.role)}
                  </Badge>
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                  isMyMessage
                    ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white'
                    : 'bg-white border border-gray-200'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {message.content}
                </div>
                <div
                  className={`text-xs mt-1.5 ${
                    isMyMessage ? 'text-indigo-100' : 'text-gray-400'
                  }`}
                >
                  {format(new Date(message.createdAt), 'HH:mm', { locale: ko })}
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
