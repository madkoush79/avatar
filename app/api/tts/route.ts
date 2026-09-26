import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'متن برای خواندن الزامی است' }, { status: 400 });
    }

    const clean = text.trim();
    const voiceName = voice || 'Zephyr';

    // Model selection with automatic fallback:
    // First try gemini-3.8-flash-tts (high clarity, separate quota pool),
    // then gemini-3.8-flash-lite-tts
    const candidateModels = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];

    let lastError: unknown = null;
    let audioBase64: string | undefined = undefined;
    let mimeType = 'audio/wav';

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: clean,
                  speechMetadata: {
                    style: 'Clear, articulate, natural Persian speech with authentic accent',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
          audioBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || 'audio/wav';
          break;
        }
      } catch (err: unknown) {
        lastError = err;
        console.warn(`Model ${model} TTS attempt:`, err instanceof Error ? err.message : String(err));
        // Continue to try the next model
      }
    }

    if (audioBase64) {
      return NextResponse.json({ audioBase64, mimeType });
    }

    const errorMsg = lastError instanceof Error ? lastError.message : String(lastError || 'No audio generated');
    const isQuotaExceeded =
      errorMsg.includes('429') ||
      errorMsg.includes('quota') ||
      errorMsg.includes('RESOURCE_EXHAUSTED');

    return NextResponse.json(
      {
        error: isQuotaExceeded
          ? 'محدودیت سهمیه صوتی ابری موقت'
          : errorMsg,
        quotaExceeded: isQuotaExceeded,
      },
      { status: isQuotaExceeded ? 429 : 500 }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('TTS general error:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
