# Patch (fixed routes)

- Removed any route-group variant for auth (e.g. `app/(auth)/login`) to avoid the
  Next.js error "two parallel pages that resolve to the same path".
- Keep **only** `app/login/page.tsx` and `app/signup/page.tsx`.
- `middleware.ts` protects `/app`, `/admin`, `/teacher` by checking `sb-access-token` cookie.
- Client never writes to `profiles`; DB trigger creates/updates it.
- Signup success message handled via `/login?pending=1`.

## Files
- middleware.ts
- lib/supabaseClient.ts
- lib/getProfile.ts
- app/login/page.tsx
- app/signup/page.tsx
