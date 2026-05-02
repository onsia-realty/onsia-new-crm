// 현장 목록 상수
export const SITES = [
  '용인경남아너스빌',
  '신광교클라우드시티',
  '평택 로제비앙',
  '왕십리 어반홈스',
  '잠실 리버리치',
  '야목역 서희스타힐스',
] as const;

export type Site = typeof SITES[number];

// 현장 색상 매핑 (UI용)
export const SITE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '용인경남아너스빌': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  '신광교클라우드시티': {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  '평택 로제비앙': {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  '왕십리 어반홈스': {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  '잠실 리버리치': {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
  },
  '야목역 서희스타힐스': {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  '미지정': {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
};

// 현장별 아이콘 (선택사항)
export const SITE_ICONS: Record<string, string> = {
  '용인경남아너스빌': '🏢',
  '신광교클라우드시티': '🏙️',
  '평택 로제비앙': '🏘️',
  '왕십리 어반홈스': '🏗️',
  '잠실 리버리치': '🌊',
  '야목역 서희스타힐스': '🚉',
  '미지정': '📍',
};
