import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export const metadata: Metadata = {
  title: '온시아 콜',
  description: '광고 콜 처리 전용 미니 앱',
  manifest: '/calls/manifest.webmanifest',
  applicationName: '온시아 콜',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '온시아 콜',
    startupImage: ['/calls-apple-touch-icon.png'],
  },
  icons: {
    icon: [
      { url: '/calls-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/calls-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/calls-apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0EA5E9',
};

export default async function CallsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/auth/signin?callbackUrl=/calls');
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {children}
    </div>
  );
}
