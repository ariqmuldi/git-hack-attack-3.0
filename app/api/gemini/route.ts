import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API_KEY_MISSING: GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    const errorMessage = (data as { error?: { message?: string } }).error?.message ?? JSON.stringify(data);
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      return NextResponse.json({ error: `API_KEY_INVALID:${res.status}: ${errorMessage}` }, { status: res.status });
    }
    if (res.status === 429) {
      return NextResponse.json({ error: `RATE_LIMIT:429: ${errorMessage}` }, { status: 429 });
    }
    return NextResponse.json({ error: `API_ERROR:${res.status}: ${errorMessage}` }, { status: res.status });
  }

  return NextResponse.json(data);
}
