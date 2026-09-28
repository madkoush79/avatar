import { NextRequest, NextResponse } from 'next/server';
import { synthesizeGeminiTTS } from '@/lib/gemini-tts';

export const dynamic = 'force-dynamic';

const PERSION_TTS_URL = 'https://persion-tts.vercel.app/tts';
const DEFAULT_PERSION_VOICE = 'fa-IR-DilaraNeural';
const DEFAULT_PERSION_RATE = '-10%';
const DEFAULT_PERSION_PITCH = '+10Hz';

export async function POST(req: NextRequest) {
  try {
    const { text, voice, rate, pitch, model } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'متن برای خواندن الزامی است' }, { status: 400 });
    }

    const clean = text.trim();

    // 1. Primary Engine: High-Fidelity Gemini TTS via GapGPT API
    try {
      const geminiResult = await synthesizeGeminiTTS(clean, {
        voiceName: voice,
        model: model,
      });

      if (geminiResult && geminiResult.audioBase64) {
        return NextResponse.json({
          audioBase64: geminiResult.audioBase64,
          mimeType: geminiResult.mimeType || 'audio/wav',
          provider: geminiResult.provider,
          voice: geminiResult.voice,
          model: geminiResult.model,
          rate,
          pitch,
        });
      }
    } catch (geminiErr) {
      console.warn(
        'Gemini TTS via GapGPT error, falling back to secondary TTS:',
        geminiErr instanceof Error ? geminiErr.message : geminiErr
      );
    }

    // 2. Secondary Engine: Edge-TTS Persian fallback
    const voiceName = voice || DEFAULT_PERSION_VOICE;

    // Format rate
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

    // Format pitch
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
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(PERSION_TTS_URL, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9,fa;q=0.8',
        'content-type': 'application/json',
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

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const audioBase64 = buffer.toString('base64');
      const mimeType = response.headers.get('content-type') || 'audio/mpeg';

      return NextResponse.json({
        audioBase64,
        mimeType,
        provider: 'edge-tts-fallback',
        voice: voiceName,
        rate: rateStr,
        pitch: pitchStr,
      });
    }

    return NextResponse.json(
      {
        fallback: true,
        error: `خطای سرور پشتیبان (${response.status})`,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('TTS request error, falling back:', errorMsg);
    return NextResponse.json(
      {
        fallback: true,
        error: errorMsg,
      },
      { status: 200 }
    );
  }
}
