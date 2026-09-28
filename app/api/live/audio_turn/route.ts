import { NextRequest, NextResponse } from 'next/server';
import {
  buildEnglishTeacherPrompt,
  TeacherConfig,
} from '@/lib/chatgpt-live-client';

const LIVE_API_BASE = process.env.CHATGPT_LIVE_API_BASE || 'http://127.0.0.1:8001';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio_file') as Blob | null;
    const voice = (formData.get('voice') as string) || 'sky';
    const configRaw = formData.get('config') as string | null;
    const historyRaw = formData.get('history') as string | null;
    const language = (formData.get('language') as string) || 'fa-IR';

    if (!audioFile || !(audioFile instanceof Blob) || audioFile.size === 0) {
      return NextResponse.json(
        { error: 'فایل صوتی ارسال نشده یا خالی است.' },
        { status: 400 }
      );
    }

    // Step 1: Forward the recorded microphone audio directly to the backend STT
    const sttFormData = new FormData();
    const fileName = (audioFile as any).name || 'student_voice.webm';
    sttFormData.append('audio_file', audioFile, fileName);
    sttFormData.append('language', language);

    const sttRes = await fetch(`${LIVE_API_BASE}/audio/stt`, {
      method: 'POST',
      body: sttFormData,
    });

    if (!sttRes.ok) {
      let sttErr = `خطای STT: HTTP ${sttRes.status}`;
      try {
        const errJson = await sttRes.json();
        sttErr = errJson.detail || errJson.message || sttErr;
      } catch {
        sttErr = await sttRes.text();
      }
      return NextResponse.json({ error: sttErr }, { status: sttRes.status });
    }

    const sttData = await sttRes.json();
    const userText = (sttData.text || '').trim();

    if (!userText) {
      return NextResponse.json({
        empty: true,
        user_text: '',
        message: 'صدایی تشخیص داده نشد. لطفاً شفاف‌تر صحبت کنید.',
      });
    }

    // Step 2: Build the Persian-base English teacher prompt
    let config: TeacherConfig = {
      persona: 'sarah',
      topic: 'daily_chat',
      level: 'intermediate',
      voice,
      bilingualHelp: false,
    };

    if (configRaw) {
      try {
        config = { ...config, ...JSON.parse(configRaw) };
      } catch {}
    }

    let history: { role: 'user' | 'assistant'; text: string }[] = [];
    if (historyRaw) {
      try {
        history = JSON.parse(historyRaw);
      } catch {}
    }

    const fullPrompt = buildEnglishTeacherPrompt(userText, config, history);

    // Step 3: Send to ChatGPT Live Turn to get response with AI gesture/emotion and live voice
    const turnRes = await fetch(`${LIVE_API_BASE}/chatgpt/live_turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        voice: config.voice || voice,
      }),
    });

    if (!turnRes.ok) {
      let turnErr = `خطای تولید پاسخ معلم: HTTP ${turnRes.status}`;
      try {
        const errJson = await turnRes.json();
        turnErr = errJson.detail || errJson.message || turnErr;
      } catch {
        turnErr = await turnRes.text();
      }
      return NextResponse.json({ error: turnErr }, { status: turnRes.status });
    }

    const turnData = await turnRes.json();

    return NextResponse.json({
      user_text: userText,
      reply_text: turnData.reply_text,
      audio_base64: turnData.audio_base64,
      voice: turnData.voice,
      conversation_id: turnData.conversation_id,
      message_id: turnData.message_id,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `خطا در پردازش چرخه صدای زنده: ${msg}` },
      { status: 500 }
    );
  }
}
