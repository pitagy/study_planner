import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// 인증이 필요하지 않은 공개 경로
const PUBLIC_PATHS = [
  '/', '/login', '/signup', '/pending',
];

// 미들웨어가 건드리지 말아야 하는 prefix
const PUBLIC_PREFIX = [
  '/api', '/_next', '/favicon', '/assets', '/public', '/images',
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIX.some(p => pathname.startsWith(p));
}

function hasSupabaseSessionCookie(req: NextRequest) {
  // @supabase/auth-helpers-nextjs 기본 쿠키들
  // 'sb-access-token', 'sb-refresh-token'
  const at = req.cookies.get('sb-access-token')?.value;
  const rt = req.cookies.get('sb-refresh-token')?.value;

  // (환경에 따라 접두사가 붙는 경우가 있으므로 느슨하게 한 번 더 확인)
  const anySb = [...req.cookies.getAll()].some(c =>
    c.name.includes('sb-') && c.value && c.value.length > 0
  );

  return Boolean(at || rt || anySb);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isPublic = isPublicPath(pathname);

  const session = hasSupabaseSessionCookie(req);

  // 로그인 상태에서 /login 들어오면 기본 대시보드로
  if (session && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/student';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // 공개 경로/자산/API는 통과
  if (isPublic) {
    return NextResponse.next();
  }

  // 보호 경로인데 세션 없으면 로그인으로
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    // 원래 가려던 경로를 보존 (로그인 후 클라이언트에서 사용할 수 있음)
    url.searchParams.set('redirectedFrom', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  // 그 외 통과
  return NextResponse.next();
}

// _next, 파일 확장자, api 등 제외
export const config = {
  matcher: ['/((?!_next|.*\\..*|api).*)'],
};
