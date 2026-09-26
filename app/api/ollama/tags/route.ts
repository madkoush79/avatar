import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_SERVER_URL = process.env.OLLAMA_BASE_URL || 'http://192.168.171.12:11434';

export async function GET(req: NextRequest) {
  const customUrl = req.nextUrl.searchParams.get('serverUrl') || req.headers.get('x-ollama-base-url');
  const serverUrl = (customUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${serverUrl}/api/tags`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Ollama responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    const ping = Date.now() - startTime;
    const models = Array.isArray(data.models) ? data.models : [];

    const hasNadia = models.some(
      (m: { name?: string; model?: string }) =>
        (m.name && m.name.toLowerCase().includes('nadia')) ||
        (m.model && m.model.toLowerCase().includes('nadia'))
    );

    return NextResponse.json({
      online: true,
      serverUrl,
      ping,
      hasNadia,
      models,
      defaultModel: hasNadia ? 'Nadia_gpt:latest' : (models[0]?.name || 'Nadia_gpt:latest'),
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        online: false,
        serverUrl,
        ping: null,
        error: errorMsg,
        models: [],
        defaultModel: 'Nadia_gpt:latest',
      },
      { status: 200 }
    );
  }
}
