'use client';

import { useSearchParams } from 'next/navigation';
import ViewerDashboard from '@/components/dashboard/ViewerDashboard';

/**
 * 선생님용 대시보드 페이지
 * URL 예: /teacher/dashboard?viewer=<학생UUID>&name=<학생이름>
 */
export default function TeacherDashboardPage() {
  const params = useSearchParams();
  const viewer = params.get('viewer');
  const name = params.get('name');

  if (!viewer)
    return (
      <main className="p-6 text-gray-700">
        ❌ 학생 정보가 없습니다. <br />
        학생 목록에서 선택 후 대시보드를 열람해 주세요.
      </main>
    );

  return (
    <ViewerDashboard
      viewerId={viewer}
      viewerName={name ?? '학생'}
      isViewer={true}
    />
  );
}
