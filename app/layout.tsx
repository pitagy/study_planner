// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import AuthListener from './providers/AuthListener'; // ✅ 추가

export const metadata: Metadata = {
  title: 'Study Planner',
  description: '학습 플래너',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white text-gray-900">
        {/* ✅ 로그인/로그아웃/토큰갱신 이벤트 → 서버 쿠키 동기화 */}
        <AuthListener />
        {children}
      </body>
    </html>
  );
}
