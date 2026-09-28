import { NextResponse } from 'next/server';

const LIVE_API_BASE = process.env.CHATGPT_LIVE_API_BASE || 'http://127.0.0.1:8001';

export async function GET() {
  try {
    const res = await fetch(`${LIVE_API_BASE}/chatgpt/voices`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `خطا در دریافت صداها از سرور لایو: ${msg}` },
      { status: 502 }
    );
  }
}
