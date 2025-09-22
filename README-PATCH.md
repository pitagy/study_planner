# Study Planner Patch – Login Redirect & Middleware Fix

## 포함 파일
- `app/login/page.tsx`: 로그인 후 세션 강제 동기화 + 안전한 redirect 처리 + 역할 라우팅
- `middleware.ts`: `@supabase/ssr` 기반 세션 검사 미들웨어

## 적용 방법
1. 이 파일들을 프로젝트 루트에 동일 경로로 덮어씌웁니다.
2. 패키지(없으면 설치)
   ```bash
   npm i @supabase/ssr @supabase/supabase-js
   ```
3. `.env.local`에 다음 값이 있어야 합니다.
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. 개발 서버 재시작: `npm run dev`
