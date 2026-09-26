import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PERSION_TTS_URL = 'https://persion-tts.vercel.app/tts';
const DEFAULT_PERSION_VOICE = 'fa-IR-DilaraNeural';
const DEFAULT_PERSION_RATE = '-10%';
const DEFAULT_PERSION_PITCH = '+10Hz';

export async function POST(req: NextRequest) {
  try {
    const { text, voice, rate, pitch } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'متن برای خواندن الزامی است' }, { status: 400 });
    }

    const clean = text.trim();
    const voiceName = voice || DEFAULT_PERSION_VOICE;

    // Format rate: Edge-TTS backend requires signed percentage like '-10%', '+0%', '+15%'
    let rateStr = DEFAULT_PERSION_RATE;
    if (typeof rate === 'string' && rate.trim()) {
      let r = rate.trim();
      if (!r.endsWith('%')) r = `${r}%`;
      if (!r.startsWith('+') && !r.startsWith('-')) r = `+${r}`;
      rateStr = r;
    } else if (typeof rate === 'number') {
      const pct = Math.round((rate - 1.0) * 100);
      rateStr = pct >= 0 ? `+${pct}%` : `${pct}%`;
    }

    // Format pitch: Edge-TTS backend requires signed Hz like '+10Hz', '+0Hz', '-5Hz'
    let pitchStr = DEFAULT_PERSION_PITCH;
    if (typeof pitch === 'string' && pitch.trim()) {
      let p = pitch.trim();
      if (!p.toLowerCase().endsWith('hz')) p = `${p}Hz`;
      if (!p.startsWith('+') && !p.startsWith('-')) p = `+${p}`;
      pitchStr = p;
    } else if (typeof pitch === 'number') {
      const hz = Math.round((pitch - 1.0) * 50);
      pitchStr = hz >= 0 ? `+${hz}Hz` : `${hz}Hz`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(PERSION_TTS_URL, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9,fa;q=0.8',
        'content-type': 'application/json',
        'dnt': '1',
        'origin': 'https://persion-tts.vercel.app',
        'priority': 'u=1, i',
        'referer': 'https://persion-tts.vercel.app/static/index.html',
        'sec-ch-ua': '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        text: clean,
        voice: voiceName,
        rate: rateStr,
        pitch: pitchStr,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`Persion TTS failed (${response.status}):`, errText);
      return NextResponse.json(
        {
          fallback: true,
          error: `خطای سرور تبدیل گفتار (${response.status})`,
        },
        { status: 200 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'audio/mpeg';

    return NextResponse.json({
      audioBase64,
      mimeType,
      voice: voiceName,
      rate: rateStr,
      pitch: pitchStr,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('Persion TTS request error, falling back:', errorMsg);
    return NextResponse.json(
      {
        fallback: true,
        error: errorMsg,
      },
      { status: 200 }
    );
  }
}

