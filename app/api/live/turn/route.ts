import { NextRequest, NextResponse } from 'next/server';

const LIVE_API_BASE = process.env.CHATGPT_LIVE_API_BASE || 'http://127.0.0.1:8001';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, voice = 'sky' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'متن پرامپت الزامی است' }, { status: 400 });
    }

    const res = await fetch(`${LIVE_API_BASE}/chatgpt/live_turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ prompt, voice }),
    });

    if (!res.ok) {
      let errText = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        errText = errJson.detail || errJson.message || errText;
      } catch {
        errText = await res.text();
      }
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `خطا در برقراری ارتباط با سرور ChatGPT لایو (127.0.0.1:8001): ${msg}` },
      { status: 502 }
    );
  }
}
