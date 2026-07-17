// 현장 목록 상수
export const SITES = [
  '용인경남아너스빌',
  '신광교클라우드시티',
  '평택 로제비앙',
  '왕십리 어반홈스',
  '잠실 리버리치',
  '야목역 서희스타힐스',
  '화성시 민간임대',
  '호반은계지구',
  '민간임대 3억대',
  '파크힐 동탄',
  'LMS 수기DB',
  '서희4차',
  '상도 푸르지오 클라베뉴',
  '세교우남',
  '세교삼미',
  '오산헤스티아',
  '아파트 랜덤 DB',
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
  '화성시 민간임대': {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  '호반은계지구': {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  '민간임대 3억대': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  '파크힐 동탄': {
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
  },
  'LMS 수기DB': {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  // DB Site 레코드(pink/🏙️)와 동일하게 맞춤
  '서희4차': {
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
  },
  // DB Site 레코드(cyan/🏢)와 동일하게 맞춤
  '상도 푸르지오 클라베뉴': {
    bg: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
  },
  // 아래 4개는 DB Site 레코드 없이 고객 assignedSite 값으로만 존재 — 색상은 여기서 새로 정함
  '세교우남': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  '세교삼미': {
    bg: 'bg-lime-50',
    text: 'text-lime-700',
    border: 'border-lime-200',
  },
  '오산헤스티아': {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
  },
  '아파트 랜덤 DB': {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
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
  '화성시 민간임대': '🏘️',
  '호반은계지구': '🏞️',
  '민간임대 3억대': '🏘️',
  '파크힐 동탄': '🌳',
  'LMS 수기DB': '✍️',
  '서희4차': '🏙️',
  '상도 푸르지오 클라베뉴': '🏢',
  '세교우남': '🏘️',
  '세교삼미': '🏘️',
  '오산헤스티아': '🏢',
  '아파트 랜덤 DB': '🎲',
  '미지정': '📍',
};
