'use client';

import { useCallback, useEffect, useState } from 'react';
import { SITES, SITE_COLORS, SITE_ICONS } from '@/lib/constants/sites';

export interface SiteItem {
  id?: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
}

// 상수 기반 fallback — API 장애 시 사용
const FALLBACK_SITES: SiteItem[] = SITES.map((name, i) => ({
  name,
  color: SITE_COLORS[name]?.bg.replace('bg-', '').replace('-50', '') || 'gray',
  icon: SITE_ICONS[name] || '🏢',
  sortOrder: (i + 1) * 10,
}));

type Listener = (data: SiteItem[]) => void;

// 모듈 레벨 싱글톤 캐시 (페이지 이동해도 유지)
let cache: SiteItem[] | null = null;
let inFlight: Promise<SiteItem[]> | null = null;
const listeners = new Set<Listener>();

async function fetchSites(): Promise<SiteItem[]> {
  try {
    const res = await fetch('/api/sites', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.success || !Array.isArray(json.data)) {
      throw new Error('Invalid response');
    }
    return json.data as SiteItem[];
  } catch (err) {
    console.warn('[useSites] API 실패, 상수 fallback 사용:', err);
    return FALLBACK_SITES;
  }
}

function notify(data: SiteItem[]) {
  cache = data;
  listeners.forEach((l) => l(data));
}

export async function refreshSites(): Promise<SiteItem[]> {
  inFlight = fetchSites();
  const data = await inFlight;
  inFlight = null;
  notify(data);
  return data;
}

export function useSites() {
  const [data, setData] = useState<SiteItem[]>(() => cache ?? FALLBACK_SITES);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    const listener: Listener = (next) => setData(next);
    listeners.add(listener);

    if (cache === null && !inFlight) {
      setLoading(true);
      refreshSites().finally(() => setLoading(false));
    } else if (inFlight) {
      setLoading(true);
      inFlight.finally(() => setLoading(false));
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await refreshSites();
    } finally {
      setLoading(false);
    }
  }, []);

  return { sites: data, loading, refresh };
}
