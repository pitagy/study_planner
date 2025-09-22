import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';

export function getSupabasePagesClient(ctx:
  | GetServerSidePropsContext
  | { req: NextApiRequest; res: NextApiResponse }
) {
  // auth-helpers가 req/res의 쿠키를 직접 읽고/쓰도록 함
  const supabase = createPagesServerClient<Database>(ctx, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
  return supabase;
}
