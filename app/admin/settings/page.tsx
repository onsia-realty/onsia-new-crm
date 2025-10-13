'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Shield, Users, Database, Bell, Lock, Save, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Permission {
  id: string;
  role: string;
  resource: string;
  action: string;
  isAllowed: boolean;
}

interface SystemSettings {
  allowRegistration: boolean;
  requireApproval: boolean;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  dataRetentionDays: number;
  enableAuditLog: boolean;
  maintenanceMode: boolean;
}

const resources = ['users', 'customers', 'settings', 'reports'];
const actions = ['view', 'create', 'update', 'delete', 'approve', 'allocate', 'export'];
const roles = ['EMPLOYEE', 'TEAM_LEADER', 'HEAD', 'ADMIN'];

export default function SettingsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    allowRegistration: true,
    requireApproval: true,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    enableEmailNotifications: true,
    enableSmsNotifications: false,
    dataRetentionDays: 365,
    enableAuditLog: true,
    maintenanceMode: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissions();
    fetchSettings();
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/admin/permissions');
      if (!response.ok) throw new Error('Failed to fetch permissions');
      const data = await response.json();
      setPermissions(data);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      toast({
        title: '오류',
        description: '권한 설정을 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      // 실제로는 API에서 가져옴
      // const response = await fetch('/api/admin/settings');
      // const data = await response.json();
      // setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      toast({
        title: '오류',
        description: '시스템 설정을 불러오는데 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handlePermissionToggle = async (permissionId: string, isAllowed: boolean) => {
    try {
      const response = await fetch(`/api/admin/permissions/${permissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAllowed }),
      });

      if (!response.ok) throw new Error('Failed to update permission');

      setPermissions(prev =>
        prev.map(p => (p.id === permissionId ? { ...p, isAllowed } : p))
      );

      toast({
        title: '성공',
        description: '권한이 업데이트되었습니다.',
      });
    } catch (error) {
      toast({
        title: '오류',
        description: '권한 업데이트에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // 실제로는 API로 저장
      // const response = await fetch('/api/admin/settings', {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(settings),
      // });

      await new Promise(resolve => setTimeout(resolve, 1000)); // 시뮬레이션

      toast({
        title: '성공',
        description: '시스템 설정이 저장되었습니다.',
      });
    } catch (error) {
      toast({
        title: '오류',
        description: '설정 저장에 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getPermissionKey = (role: string, resource: string, action: string) => {
    return `${role}-${resource}-${action}`;
  };

  const isPermissionAllowed = (role: string, resource: string, action: string) => {
    const permission = permissions.find(
      p => p.role === role && p.resource === resource && p.action === action
    );
    return permission?.isAllowed ?? false;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          시스템 설정
        </h1>
        <p className="text-gray-600 mt-2">
          CRM 시스템의 전반적인 설정과 권한을 관리합니다.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">일반 설정</TabsTrigger>
          <TabsTrigger value="permissions">권한 관리</TabsTrigger>
          <TabsTrigger value="security">보안 설정</TabsTrigger>
          <TabsTrigger value="notifications">알림 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>일반 설정</CardTitle>
              <CardDescription>
                시스템의 기본 동작을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>회원가입 허용</Label>
                  <p className="text-sm text-gray-600">
                    새로운 사용자의 회원가입을 허용합니다.
                  </p>
                </div>
                <Switch
                  checked={settings.allowRegistration}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, allowRegistration: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>가입 승인 필요</Label>
                  <p className="text-sm text-gray-600">
                    관리자의 승인 후 계정이 활성화됩니다.
                  </p>
                </div>
                <Switch
                  checked={settings.requireApproval}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, requireApproval: checked })
                  }
                />
              </div>

              <div>
                <Label>데이터 보관 기간 (일)</Label>
                <Input
                  type="number"
                  value={settings.dataRetentionDays}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      dataRetentionDays: parseInt(e.target.value),
                    })
                  }
                  className="w-32"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>유지보수 모드</Label>
                  <p className="text-sm text-gray-600">
                    시스템 점검 시 사용자 접근을 제한합니다.
                  </p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, maintenanceMode: checked })
                  }
                />
              </div>

              <Button onClick={handleSaveSettings} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '저장 중...' : '설정 저장'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>권한 관리</CardTitle>
              <CardDescription>
                역할별 리소스 접근 권한을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">리소스</TableHead>
                      <TableHead className="w-32">작업</TableHead>
                      {roles.map(role => (
                        <TableHead key={role} className="text-center">
                          {role === 'EMPLOYEE' && '직원'}
                          {role === 'TEAM_LEADER' && '팀장'}
                          {role === 'HEAD' && '본부장'}
                          {role === 'ADMIN' && '관리자'}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resources.map(resource => (
                      actions.map(action => (
                        <TableRow key={`${resource}-${action}`}>
                          <TableCell className="font-medium">
                            {resource === 'users' && '사용자'}
                            {resource === 'customers' && '고객'}
                            {resource === 'settings' && '설정'}
                            {resource === 'reports' && '보고서'}
                          </TableCell>
                          <TableCell>
                            {action === 'view' && '조회'}
                            {action === 'create' && '생성'}
                            {action === 'update' && '수정'}
                            {action === 'delete' && '삭제'}
                            {action === 'approve' && '승인'}
                            {action === 'allocate' && '배분'}
                            {action === 'export' && '내보내기'}
                          </TableCell>
                          {roles.map(role => {
                            const isAllowed = isPermissionAllowed(role, resource, action);
                            const permission = permissions.find(
                              p => p.role === role && p.resource === resource && p.action === action
                            );
                            
                            return (
                              <TableCell key={role} className="text-center">
                                <Switch
                                  checked={isAllowed}
                                  onCheckedChange={(checked) =>
                                    permission && handlePermissionToggle(permission.id, checked)
                                  }
                                  disabled={role === 'ADMIN'} // 관리자는 모든 권한 고정
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>보안 설정</CardTitle>
              <CardDescription>
                시스템 보안 관련 설정을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>세션 타임아웃 (분)</Label>
                <Input
                  type="number"
                  value={settings.sessionTimeout}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      sessionTimeout: parseInt(e.target.value),
                    })
                  }
                  className="w-32"
                />
              </div>

              <div>
                <Label>최대 로그인 시도 횟수</Label>
                <Input
                  type="number"
                  value={settings.maxLoginAttempts}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      maxLoginAttempts: parseInt(e.target.value),
                    })
                  }
                  className="w-32"
                />
              </div>

              <div>
                <Label>최소 비밀번호 길이</Label>
                <Input
                  type="number"
                  value={settings.passwordMinLength}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      passwordMinLength: parseInt(e.target.value),
                    })
                  }
                  className="w-32"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>감사 로그 활성화</Label>
                  <p className="text-sm text-gray-600">
                    모든 사용자 활동을 기록합니다.
                  </p>
                </div>
                <Switch
                  checked={settings.enableAuditLog}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enableAuditLog: checked })
                  }
                />
              </div>

              <Button onClick={handleSaveSettings} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '저장 중...' : '설정 저장'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>알림 설정</CardTitle>
              <CardDescription>
                시스템 알림 방식을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>이메일 알림</Label>
                  <p className="text-sm text-gray-600">
                    중요 이벤트를 이메일로 알립니다.
                  </p>
                </div>
                <Switch
                  checked={settings.enableEmailNotifications}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enableEmailNotifications: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS 알림</Label>
                  <p className="text-sm text-gray-600">
                    긴급 알림을 SMS로 전송합니다.
                  </p>
                </div>
                <Switch
                  checked={settings.enableSmsNotifications}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enableSmsNotifications: checked })
                  }
                />
              </div>

              <Button onClick={handleSaveSettings} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? '저장 중...' : '설정 저장'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}