'use client';

import { useSearchParams } from 'next/navigation';
import ViewerDashboard from '@/components/dashboard/ViewerDashboard';

/**
 * 학부모용 대시보드 페이지
 * URL 예: /parent/dashboard?viewer=<자녀UUID>&name=<자녀이름>
 */
export default function ParentDashboardPage() {
  const params = useSearchParams();
  const viewer = params.get('viewer');
  const name = params.get('name');

  if (!viewer)
    return (
      <main className="p-6 text-gray-700">
        ❌ 자녀 정보가 없습니다. <br />
        자녀 연동 코드 등록 후 다시 시도해 주세요.
      </main>
    );

  return (
    <ViewerDashboard
      viewerId={viewer}
      viewerName={name ?? '자녀'}
      isViewer={true}
    />
  );
}
