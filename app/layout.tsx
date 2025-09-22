// app/layout.tsx
import './globals.css';                 // ✅ 전역 스타일 불러오기
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Planner',
  description: '학습 플래너',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
