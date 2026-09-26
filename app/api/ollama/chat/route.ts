import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_SERVER_URL = process.env.OLLAMA_BASE_URL || 'http://192.168.171.12:11434';
const DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL || 'Nadia_gpt:latest';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      model = DEFAULT_MODEL,
      messages = [],
      stream = true,
      options = {},
      serverUrl: customUrl,
    } = body;

    const baseServerUrl = (
      customUrl ||
      req.headers.get('x-ollama-base-url') ||
      DEFAULT_SERVER_URL
    ).replace(/\/+$/, '');

    const endpoint = `${baseServerUrl}/api/chat`;

    const payload = {
      model: model || DEFAULT_MODEL,
      messages,
      stream: Boolean(stream),
      options: {
        temperature: typeof options.temperature === 'number' ? options.temperature : 0.7,
        top_p: typeof options.topP === 'number' ? options.topP : (typeof options.top_p === 'number' ? options.top_p : 0.9),
        ...options,
      },
    };

    const ollamaResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!ollamaResponse.ok) {
      const errText = await ollamaResponse.text();
      return NextResponse.json(
        { error: `سرور الاما خطا داد (${ollamaResponse.status}): ${errText}` },
        { status: ollamaResponse.status }
      );
    }

    if (!stream) {
      const data = await ollamaResponse.json();
      return NextResponse.json(data);
    }

    // Streaming mode: pipe the Ollama response directly to client
    const headers = new Headers();
    headers.set('Content-Type', 'text/event-stream; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-transform');
    headers.set('Connection', 'keep-alive');

    return new Response(ollamaResponse.body, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Ollama chat proxy error:', errorMsg);
    return NextResponse.json({ error: `خطای ارتباط با هوش مصنوعی نادیا: ${errorMsg}` }, { status: 500 });
  }
}
