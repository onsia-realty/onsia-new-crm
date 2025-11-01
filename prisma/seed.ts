import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // CEO 계정 생성 (대표)
  const ceoHashedPassword = await bcrypt.hash('CEO!2024', 12);

  const ceo = await prisma.user.upsert({
    where: { email: 'ceo@onsia.local' },
    update: {},
    create: {
      username: 'ceo',
      email: 'ceo@onsia.local',
      name: '대표이사',
      password: ceoHashedPassword,
      phone: '01000000000',
      role: 'CEO',
      department: '대표이사실',
      position: '대표이사',
      isActive: true,
      approvedAt: new Date(),
    },
  });

  console.log('✅ CEO 계정 생성 완료:');
  console.log('아이디:', ceo.username);
  console.log('이메일:', ceo.email);
  console.log('비밀번호: CEO!2024');
  console.log('역할:', ceo.role);

  // 관리자 계정 생성
  const hashedPassword = await bcrypt.hash('#duseorua12', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@onsia.local' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@onsia.local',
      name: '시스템 관리자',
      password: hashedPassword,
      phone: '01012345678',
      role: 'ADMIN',
      department: '경영지원팀',
      position: '관리자',
      isActive: true,
      approvedAt: new Date(),
    },
  });

  console.log('✅ 관리자 계정 생성 완료:');
  console.log('아이디:', admin.username);
  console.log('이메일:', admin.email);
  console.log('비밀번호: #duseorua12');
  console.log('역할:', admin.role);

  // 권한 설정 생성
  const permissions = [
    // CEO - 최상위 권한 (모든 권한 포함, 본인 삭제 불가)
    { role: 'CEO' as Role, resource: 'users', action: 'view' },
    { role: 'CEO' as Role, resource: 'users', action: 'create' },
    { role: 'CEO' as Role, resource: 'users', action: 'update' },
    { role: 'CEO' as Role, resource: 'users', action: 'delete' },
    { role: 'CEO' as Role, resource: 'users', action: 'approve' },
    { role: 'CEO' as Role, resource: 'customers', action: 'view' },
    { role: 'CEO' as Role, resource: 'customers', action: 'create' },
    { role: 'CEO' as Role, resource: 'customers', action: 'update' },
    { role: 'CEO' as Role, resource: 'customers', action: 'delete' },
    { role: 'CEO' as Role, resource: 'customers', action: 'allocate' },
    { role: 'CEO' as Role, resource: 'customers', action: 'export' },
    { role: 'CEO' as Role, resource: 'settings', action: 'view' },
    { role: 'CEO' as Role, resource: 'settings', action: 'update' },
    { role: 'CEO' as Role, resource: 'reports', action: 'view' },
    { role: 'CEO' as Role, resource: 'reports', action: 'export' },

    // ADMIN - 모든 권한 (CEO 제외)
    { role: 'ADMIN' as Role, resource: 'users', action: 'view' },
    { role: 'ADMIN' as Role, resource: 'users', action: 'create' },
    { role: 'ADMIN' as Role, resource: 'users', action: 'update' },
    { role: 'ADMIN' as Role, resource: 'users', action: 'delete' },
    { role: 'ADMIN' as Role, resource: 'users', action: 'approve' },
    { role: 'ADMIN' as Role, resource: 'customers', action: 'view' },
    { role: 'ADMIN' as Role, resource: 'customers', action: 'create' },
    { role: 'ADMIN' as Role, resource: 'customers', action: 'update' },
    { role: 'ADMIN' as Role, resource: 'customers', action: 'delete' },
    { role: 'ADMIN' as Role, resource: 'customers', action: 'allocate' },
    { role: 'ADMIN' as Role, resource: 'customers', action: 'export' },
    { role: 'ADMIN' as Role, resource: 'settings', action: 'view' },
    { role: 'ADMIN' as Role, resource: 'settings', action: 'update' },
    { role: 'ADMIN' as Role, resource: 'reports', action: 'view' },
    { role: 'ADMIN' as Role, resource: 'reports', action: 'export' },
    
    // HEAD - 본부장 권한
    { role: 'HEAD' as Role, resource: 'users', action: 'view' },
    { role: 'HEAD' as Role, resource: 'users', action: 'update' },
    { role: 'HEAD' as Role, resource: 'customers', action: 'view' },
    { role: 'HEAD' as Role, resource: 'customers', action: 'create' },
    { role: 'HEAD' as Role, resource: 'customers', action: 'update' },
    { role: 'HEAD' as Role, resource: 'customers', action: 'allocate' },
    { role: 'HEAD' as Role, resource: 'reports', action: 'view' },
    { role: 'HEAD' as Role, resource: 'reports', action: 'export' },
    
    // TEAM_LEADER - 팀장 권한
    { role: 'TEAM_LEADER' as Role, resource: 'users', action: 'view' },
    { role: 'TEAM_LEADER' as Role, resource: 'customers', action: 'view' },
    { role: 'TEAM_LEADER' as Role, resource: 'customers', action: 'create' },
    { role: 'TEAM_LEADER' as Role, resource: 'customers', action: 'update' },
    { role: 'TEAM_LEADER' as Role, resource: 'reports', action: 'view' },
    
    // EMPLOYEE - 직원 권한
    { role: 'EMPLOYEE' as Role, resource: 'customers', action: 'view' },
    { role: 'EMPLOYEE' as Role, resource: 'customers', action: 'create' },
    { role: 'EMPLOYEE' as Role, resource: 'customers', action: 'update' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        role_resource_action: {
          role: perm.role,
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {},
      create: perm,
    });
  }

  console.log('✅ 권한 설정 완료');

  // 샘플 공지사항 생성
  await prisma.notice.create({
    data: {
      title: '온시아 CRM 시스템 오픈',
      content: '새로운 고객 관리 시스템이 오픈되었습니다. 모든 직원분들은 시스템 사용법을 숙지해주시기 바랍니다.',
      category: 'GENERAL',
      isPinned: true,
      authorId: admin.id,
    },
  });

  console.log('✅ 샘플 공지사항 생성 완료');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });