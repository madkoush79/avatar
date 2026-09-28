import { NextResponse } from 'next/server';

const LIVE_API_BASE = process.env.CHATGPT_LIVE_API_BASE || 'http://127.0.0.1:8001';

export async function GET() {
  try {
    const t0 = Date.now();
    const res = await fetch(`${LIVE_API_BASE}/account`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const ping = Date.now() - t0;

    if (!res.ok) {
      return NextResponse.json(
        { online: false, ping, error: `HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      online: true,
      ping,
      userEmail: data.email,
      userName: data.name,
      serverUrl: LIVE_API_BASE,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      online: false,
      ping: null,
      serverUrl: LIVE_API_BASE,
      error: `عدم دسترسی به سرور لایو (${LIVE_API_BASE}): ${msg}`,
    });
  }
}
