import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiTTSOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  voiceName?: string;
  promptPrefix?: string;
}

export interface GeminiTTSResult {
  audioBase64: string;
  mimeType: string;
  provider: string;
  model: string;
  voice: string;
}

/**
 * Wraps raw 16-bit little-endian mono PCM audio buffer into a valid standard RIFF WAV format
 */
export function pcmToWav(
  pcmBuffer: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Text-to-Speech using Gemini on GapGPT API
 */
export async function synthesizeGeminiTTS(
  text: string,
  options: GeminiTTSOptions = {}
): Promise<GeminiTTSResult> {
  const apiKey =
    options.apiKey ||
    process.env.GAPGPT_API_KEY ||
    process.env.GEMINI_API_KEY ||
    'sk-rWsuEJd4v87rpvc5aNfv4PmDqEAweBl5DIeapy6w25QXXfvt';

  let rawBaseUrl = options.baseUrl || process.env.GAPGPT_BASE_URL || 'https://api.gapgpt.app/v1';
  rawBaseUrl = rawBaseUrl.replace(/\/+$/, '');

  const voice = options.voiceName || process.env.GAPGPT_TTS_VOICE || 'Kore';
  const requestedModel = options.model || process.env.GAPGPT_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
  const cleanText = text.trim();

  if (!cleanText) {
    throw new Error('متن برای تبدیل به گفتار خالی است');
  }

  // Method 1: Try using @google/generative-ai official SDK
  try {
    const sdkBaseUrl = rawBaseUrl.endsWith('/v1')
      ? rawBaseUrl.slice(0, -3)
      : rawBaseUrl;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      {
        model: requestedModel,
      },
      {
        baseUrl: sdkBaseUrl,
        apiVersion: 'v1',
      }
    );

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `Say cheerfully: ${cleanText}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      } as any,
    });

    const candidate = result.response.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    if (part && 'inlineData' in part && part.inlineData?.data) {
      const mime = part.inlineData.mimeType || 'audio/wav';
      let audioBuffer: Uint8Array = Buffer.from(part.inlineData.data, 'base64');

      // If raw PCM without RIFF header, wrap in standard WAV header
      if (!Buffer.from(audioBuffer).subarray(0, 4).toString('ascii').startsWith('RIFF')) {
        audioBuffer = pcmToWav(audioBuffer, 24000, 1, 16);
      }

      return {
        audioBase64: Buffer.from(audioBuffer).toString('base64'),
        mimeType: 'audio/wav',
        provider: 'gemini-sdk-gapgpt',
        model: requestedModel,
        voice,
      };
    }
  } catch (sdkErr) {
    console.warn('Gemini SDK TTS call warning, trying direct GapGPT audio endpoint:', sdkErr instanceof Error ? sdkErr.message : sdkErr);
  }

  // Method 2: Direct GapGPT Chat Audio API (fully supported by GapGPT distributor channel)
  const modelsToTry = [
    requestedModel,
    // 'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
  ];
  // Deduplicate
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError = 'No model succeeded';

  for (const modelName of uniqueModels) {
    try {
      const chatUrl = `${rawBaseUrl}/chat/completions`;
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'user',
              content: `Say cheerfully: ${cleanText}`,
            },
          ],
          modalities: ['text', 'audio'],
          audio: {
            voice: voice.toLowerCase(),
            format: 'wav',
          },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        lastError = `GapGPT HTTP ${res.status}: ${errBody}`;
        continue;
      }

      const data = await res.json();
      const rawAudioBase64 = data.choices?.[0]?.message?.audio?.data;

      if (rawAudioBase64) {
        let audioBuf: Uint8Array = Buffer.from(rawAudioBase64, 'base64');

        // Check if RIFF header already present
        if (!Buffer.from(audioBuf).subarray(0, 4).toString('ascii').startsWith('RIFF')) {
          audioBuf = pcmToWav(audioBuf, 24000, 1, 16);
        }

        return {
          audioBase64: Buffer.from(audioBuf).toString('base64'),
          mimeType: 'audio/wav',
          provider: 'gapgpt-gemini-tts',
          model: modelName,
          voice,
        };
      } else {
        lastError = `No audio in response: ${JSON.stringify(data).slice(0, 200)}`;
      }
    } catch (fetchErr) {
      lastError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    }
  }

  throw new Error(`خطا در تولید صدای جمینای از GapGPT: ${lastError}`);
}
