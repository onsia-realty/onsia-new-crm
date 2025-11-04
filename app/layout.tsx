import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "./providers";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import UpdateWatcher from "@/components/pwa/UpdateWatcher";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "온시아 CRM - 부동산 고객관리 시스템",
  description: "온시아 부동산 고객관리 및 매물 추적 시스템",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "온시아 CRM",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "온시아 CRM",
    title: "온시아 CRM - 부동산 고객관리 시스템",
    description: "온시아 부동산 고객관리 및 매물 추적 시스템",
  },
  twitter: {
    card: "summary",
    title: "온시아 CRM - 부동산 고객관리 시스템",
    description: "온시아 부동산 고객관리 및 매물 추적 시스템",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link href="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.10/index.global.min.css" rel="stylesheet" />
        <link href="https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.10/index.global.min.css" rel="stylesheet" />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
        <Toaster />
        <InstallPrompt />
        <UpdateWatcher />
      </body>
    </html>
  );
}