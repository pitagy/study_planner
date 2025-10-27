'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function PendingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goHome = () => {
    startTransition(async () => {
      try {
        // 서버에서 쿠키 기반 로그아웃 (keepalive로 신뢰성 ↑)
        await fetch('/api/auth/signout', {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
        });
      } catch {
        // 네트워크 이슈가 있어도 홈으로 이동
      } finally {
        router.replace('/');    // 홈으로
        router.refresh();
      }
    });
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-white">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 p-8 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">승인 대기 중입니다</h1>
        <p className="text-gray-700 leading-7">
          관리자의 승인이 있어야 사용이 가능합니다.
          <br />
          관리자에게 직접 요청하시거나
          <br />
          조금만 더 기다려 주시기 바랍니다.
          <br />
          감사합니다.
        </p>

        <div className="mt-6 flex gap-3">
          {/* 로그인으로 버튼 제거, 홈으로만 남김 */}
          <button
            type="button"
            onClick={goHome}
            disabled={isPending}
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-60"
          >
            {isPending ? '이동 중…' : '홈으로'}
          </button>
        </div>
      </div>
    </div>
  );
}
