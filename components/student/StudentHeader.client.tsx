// components/student/StudentHeader.client.tsx
"use client";

import { useSearchParams } from "next/navigation";
import ViewerAwareNav from "@/components/student/ViewerAwareNav";
import UserTopBar from "@/components/common/UserTopBar";

export default function StudentHeaderClient() {
  const sp = useSearchParams();
  const isViewerMode = !!sp.get("viewer");

  if (!isViewerMode) {
    // 학생 본인이 보는 화면: 공용 UserTopBar + 학생 네비
    return (
      <>
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
          <div className="mx-auto max-w-6xl px-4">
            <UserTopBar />
          </div>
        </div>
        
      </>
    );
  }

  // 관리자/선생님이 새창으로 연 뷰어 모드: ViewerAwareNav만 표시
  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <ViewerAwareNav />
      </div>
    </div>
  );
}
