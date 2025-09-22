// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// 브라우저 저장소 기반 세션(순수 supabase-js 사용)에서는
// 서버 미들웨어가 세션을 확인할 수 없습니다.
// 보호는 클라이언트 RequireAuth로 맡기고, 미들웨어는 통과만 시킵니다.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
