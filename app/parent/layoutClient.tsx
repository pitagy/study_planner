// app/parent/layoutClient.tsx
'use client';

import UnifiedTopBar from '@/components/common/UnifiedTopBar';

export default function ParentLayoutClient({
  email,
  name,
  role,
  children,
}: {
  email: string;
  name?: string;
  role?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-gray-50">
      {/* ✅ 통합형 상단바 적용 */}
      <UnifiedTopBar role="parent" name={name} email={email} />

      <main className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
