export interface OllamaModelItem {
  name: string;
  model: string;
  size?: number;
  digest?: string;
  modified_at?: string;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[]; // Base64 encoded images for vision
}

export interface OllamaServerStatus {
  online: boolean;
  serverUrl: string;
  ping: number | null;
  hasNadia: boolean;
  models: OllamaModelItem[];
  defaultModel: string;
  error?: string;
}

export interface OllamaSettings {
  serverUrl: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  autoSpeak: boolean;
}

export const DEFAULT_OLLAMA_CONFIG: OllamaSettings = {
  serverUrl: 'http://192.168.171.12:11434',
  model: 'Nadia_gpt:latest',
  systemPrompt: 'شما هوش مصنوعی صمیمی و فارسی‌زبان به نام مدل نادیا (Nadia GPT) هستید که با کاراکتر سه بعدی صحبت می‌کنید. پاسخ‌ها را روان، جذاب و رسا به زبان فارسی بیان کنید.',
  temperature: 0.7,
  topP: 0.9,
  autoSpeak: true,
};

export function getStoredOllamaSettings(): OllamaSettings {
  if (typeof window === 'undefined') return DEFAULT_OLLAMA_CONFIG;
  return {
    serverUrl: localStorage.getItem('nadia_server_url') || DEFAULT_OLLAMA_CONFIG.serverUrl,
    model: localStorage.getItem('nadia_model') || DEFAULT_OLLAMA_CONFIG.model,
    systemPrompt: localStorage.getItem('nadia_sys_prompt') ?? DEFAULT_OLLAMA_CONFIG.systemPrompt,
    temperature: parseFloat(localStorage.getItem('nadia_temperature') || String(DEFAULT_OLLAMA_CONFIG.temperature)),
    topP: parseFloat(localStorage.getItem('nadia_top_p') || String(DEFAULT_OLLAMA_CONFIG.topP)),
    autoSpeak: localStorage.getItem('nadia_auto_speak') !== 'false',
  };
}

export function saveStoredOllamaSettings(settings: Partial<OllamaSettings>) {
  if (typeof window === 'undefined') return;
  if (settings.serverUrl !== undefined) localStorage.setItem('nadia_server_url', settings.serverUrl);
  if (settings.model !== undefined) localStorage.setItem('nadia_model', settings.model);
  if (settings.systemPrompt !== undefined) localStorage.setItem('nadia_sys_prompt', settings.systemPrompt);
  if (settings.temperature !== undefined) localStorage.setItem('nadia_temperature', String(settings.temperature));
  if (settings.topP !== undefined) localStorage.setItem('nadia_top_p', String(settings.topP));
  if (settings.autoSpeak !== undefined) localStorage.setItem('nadia_auto_speak', String(settings.autoSpeak));
}

/**
 * Checks connectivity and retrieves models from Ollama server
 */
export async function checkOllamaServer(serverUrl?: string): Promise<OllamaServerStatus> {
  const target = serverUrl || getStoredOllamaSettings().serverUrl;
  try {
    const res = await fetch(`/api/ollama/tags?serverUrl=${encodeURIComponent(target)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      return {
        online: false,
        serverUrl: target,
        ping: null,
        hasNadia: false,
        models: [],
        defaultModel: DEFAULT_OLLAMA_CONFIG.model,
        error: `HTTP ${res.status}`,
      };
    }

    const data: OllamaServerStatus = await res.json();
    return data;
  } catch (err: unknown) {
    return {
      online: false,
      serverUrl: target,
      ping: null,
      hasNadia: false,
      models: [],
      defaultModel: DEFAULT_OLLAMA_CONFIG.model,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Stream chat completion from Ollama
 */
export async function streamOllamaChat(params: {
  messages: OllamaChatMessage[];
  model?: string;
  serverUrl?: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  signal?: AbortSignal;
  onChunk: (chunk: string, accumulated: string) => void;
  onDone: (fullContent: string) => void;
  onError: (error: Error) => void;
}) {
  const settings = getStoredOllamaSettings();
  const serverUrl = params.serverUrl || settings.serverUrl;
  const model = params.model || settings.model;
  const systemPrompt = params.systemPrompt ?? settings.systemPrompt;
  const temperature = params.temperature ?? settings.temperature;
  const topP = params.topP ?? settings.topP;

  const apiMessages: { role: string; content: string; images?: string[] }[] = [];
  if (systemPrompt && systemPrompt.trim()) {
    apiMessages.push({ role: 'system', content: systemPrompt.trim() });
  }

  params.messages.forEach((m) => {
    apiMessages.push({
      role: m.role,
      content: m.content,
      images: m.images && m.images.length > 0 ? m.images : undefined,
    });
  });

  try {
    const response = await fetch('/api/ollama/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        serverUrl,
        messages: apiMessages,
        stream: true,
        options: {
          temperature,
          top_p: topP,
        },
      }),
      signal: params.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(err.error || `خطا در برقراری ارتباط با سرور الاما (${response.status})`);
    }

    if (!response.body) {
      throw new Error('پاسخی از سرور دریافت نشد');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const chunk = parsed.message?.content || '';
          if (chunk) {
            accumulated += chunk;
            params.onChunk(chunk, accumulated);
          }
        } catch {
          // ignore non-json line
        }
      }
    }

    // Process remainder if any
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        const chunk = parsed.message?.content || '';
        if (chunk) {
          accumulated += chunk;
          params.onChunk(chunk, accumulated);
        }
      } catch {
        // ignore
      }
    }

    params.onDone(accumulated);
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') {
      return;
    }
    params.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
