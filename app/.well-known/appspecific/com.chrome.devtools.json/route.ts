// app/.well-known/appspecific/com.chrome.devtools.json/route.ts
import { NextResponse } from 'next/server';

export function GET() {
  // 비어있는 JSON (200)
  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: {
        // 재요청도 빠르게 하도록 캐시
        'cache-control': 'public, max-age=31536000, immutable',
      },
    }
  );

  // 또는 내용 없이 204로 응답하고 싶다면:
  // return new NextResponse(null, { status: 204 });
}
