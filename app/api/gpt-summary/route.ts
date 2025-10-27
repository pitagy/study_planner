// app/api/gpt-summary/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '너는 학생의 학습 데이터를 따뜻하게 요약하는 교육 분석 AI야.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
    }),
  });

  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content || '요약 생성 실패';

  return NextResponse.json({ summary });
}
