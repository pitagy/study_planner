'use client';

import { useEffect } from 'react';

export default function RootClientInit() {
  useEffect(() => {
    (async () => {
      try {
        const mod = await import('@/lib/auth/ensureValidSession');
        await mod.ensureValidSession();
      } catch (e) {
        console.error('ensureValidSession 실패', e);
      }
    })();
  }, []);

  return null;
}
