'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  OllamaChatMessage, 
  OllamaServerStatus, 
  OllamaSettings,
  getStoredOllamaSettings, 
  saveStoredOllamaSettings, 
  checkOllamaServer, 
  streamOllamaChat,
  DEFAULT_OLLAMA_CONFIG,
  OllamaModelItem
} from '@/lib/ollama-client';
import { FacialExpression } from '@/lib/types';
import { persianSpeechSynth } from '@/lib/speech-synth-fa';
import { 
  Sparkles, 
  Send, 
  Square, 
  Image as ImageIcon, 
  X, 
  RefreshCw, 
  Settings2, 
  Volume2, 
  VolumeX, 
  Copy, 
  Check, 
  Trash2, 
  Bot, 
  User, 
  Zap, 
  Eye, 
  Cpu, 
  Layers, 
  ChevronRight,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

interface NadiaAIChatProps {
  onUpdateVisemes: (morphs: Partial<FacialExpression>) => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  characterName?: string;
}

const SUGGESTION_PROMPTS = [
  {
    title: 'معرفی کاراکتر و نادیا',
    desc: 'سلام! خودت رو معرفی کن و بگو چطور می‌تونی کمکم کنی.',
    prompt: 'سلام! خودت رو معرفی کن و بگو چطور می‌تونی در این استودیو سه بعدی به من کمک کنی.',
  },
  {
    title: 'داستان کوتاه فارسی',
    desc: 'یک داستان کوتاه و پرکشش برای خواندن و لب‌خوانی بگو.',
    prompt: 'یک داستان کوتاه، زیبا و رسا به زبان فارسی برای من تعریف کن.',
  },
  {
    title: 'توصیف استایل و فیگورها',
    desc: 'درباره ۱۰ فیگور بدن و انیمیشن‌های این استودیو صحبت کن.',
    prompt: 'به عنوان مدل هوش مصنوعی نادیا، درباره ۱۰ حالت و فیگور بدن کاراکتر در این استودیو توضیح بده.',
  },
  {
    title: 'شعر و ادب فارسی',
    desc: 'یک بیت یا شعر زیبا با واژه‌های پرطنین بخوان.',
    prompt: 'یک شعر زیبا و گوش‌نواز از ادبیات فارسی با معنای عمیق برای من بگو.',
  },
];

export function NadiaAIChat({
  onUpdateVisemes,
  isSpeaking,
  setIsSpeaking,
  characterName = 'کاراکتر سه بعدی',
}: NadiaAIChatProps) {
  // Settings & Status
  const [settings, setSettings] = useState<OllamaSettings>(DEFAULT_OLLAMA_CONFIG);
  const [status, setStatus] = useState<OllamaServerStatus>({
    online: false,
    serverUrl: DEFAULT_OLLAMA_CONFIG.serverUrl,
    ping: null,
    hasNadia: false,
    models: [],
    defaultModel: DEFAULT_OLLAMA_CONFIG.model,
  });
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Chat State
  const [messages, setMessages] = useState<OllamaChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('nadia_chat_messages');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [autoSpeakReplies, setAutoSpeakReplies] = useState<boolean>(true);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentSpeakingSessionRef = useRef<{ stop: () => void } | null>(null);

  // Load initial settings
  useEffect(() => {
    const loaded = getStoredOllamaSettings();
    setSettings(loaded);
    setAutoSpeakReplies(loaded.autoSpeak);
    handleRefreshStatus(loaded.serverUrl);
  }, []);

  // Save messages to local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nadia_chat_messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  // Check Ollama Server Status
  const handleRefreshStatus = async (urlToCheck?: string) => {
    setIsCheckingStatus(true);
    setTestResult(null);
    try {
      const targetUrl = urlToCheck || settings.serverUrl;
      const res = await checkOllamaServer(targetUrl);
      setStatus(res);
      if (res.online && res.hasNadia) {
        setTestResult(`اتصال موفق به مدل نادیا (${res.ping}ms)`);
      } else if (res.online) {
        setTestResult(`سرور آنلاین است اما مدل نادیا یافت نشد (${res.models.length} مدل موجود)`);
      } else {
        setTestResult(`عدم اتصال به ${targetUrl}: ${res.error || 'خطای شبکه'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus((prev) => ({ ...prev, online: false, ping: null, error: msg }));
      setTestResult(`خطا در بررسی سرور: ${msg}`);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('لطفا فقط فایل تصویری انتخاب کنید.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1];
      setAttachedImage(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Speak text with 3D Avatar
  const handleSpeakText = (text: string) => {
    // Strip markdown formatting for cleaner speech
    const cleanSpeechText = text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_#~>[\]()]/g, '')
      .trim();

    if (!cleanSpeechText) return;

    // Stop existing speech
    if (currentSpeakingSessionRef.current) {
      currentSpeakingSessionRef.current.stop();
    }

    setIsSpeaking(true);

    const session = persianSpeechSynth.speak(
      cleanSpeechText,
      {
        voice: 'fa-IR-DilaraNeural',
        rateStr: '-10%',
        pitchStr: '+10Hz',
        rate: 1.0,
        pitch: 1.0,
        exaggeration: 1.0,
        enableAudio: true,
        useBrowserTTSIfAvailable: true,
      },
      {
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false);
          onUpdateVisemes({
            viseme_sil: 1,
            viseme_aa: 0,
            viseme_O: 0,
            viseme_E: 0,
            viseme_I: 0,
            viseme_U: 0,
            viseme_PP: 0,
            viseme_FF: 0,
            mouthOpen: 0,
            jawOpen: 0,
          });
        },
        onVisemeUpdate: (morphs) => {
          onUpdateVisemes(morphs as Partial<FacialExpression>);
        },
      }
    );

    currentSpeakingSessionRef.current = session;
  };

  const handleStopSpeaking = () => {
    if (currentSpeakingSessionRef.current) {
      currentSpeakingSessionRef.current.stop();
      currentSpeakingSessionRef.current = null;
    }
    setIsSpeaking(false);
    onUpdateVisemes({
      viseme_sil: 1,
      viseme_aa: 0,
      viseme_PP: 0,
      mouthOpen: 0,
      jawOpen: 0,
    });
  };

  // Send message to Ollama
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputPrompt).trim();
    if (!text && !attachedImage) return;

    const userMsg: OllamaChatMessage = {
      role: 'user',
      content: text,
      images: attachedImage ? [attachedImage] : undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputPrompt('');
    setAttachedImage(null);
    setIsGenerating(true);

    // Placeholder for assistant response
    const assistantMsgIndex = newMessages.length;
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let fullGenerated = '';

    await streamOllamaChat({
      messages: newMessages,
      serverUrl: settings.serverUrl,
      model: settings.model,
      systemPrompt: settings.systemPrompt,
      temperature: settings.temperature,
      topP: settings.topP,
      signal: controller.signal,
      onChunk: (chunk, accumulated) => {
        fullGenerated = accumulated;
        setMessages((prev) => {
          const copy = [...prev];
          if (copy[assistantMsgIndex]) {
            copy[assistantMsgIndex] = {
              ...copy[assistantMsgIndex],
              content: accumulated,
            };
          }
          return copy;
        });
        scrollToBottom();
      },
      onDone: (completedText) => {
        setIsGenerating(false);
        abortControllerRef.current = null;
        // If auto-speak is enabled, speak the answer through 3D avatar!
        if (autoSpeakReplies && completedText.trim()) {
          handleSpeakText(completedText);
        }
      },
      onError: (err) => {
        setIsGenerating(false);
        abortControllerRef.current = null;
        setMessages((prev) => {
          const copy = [...prev];
          if (copy[assistantMsgIndex]) {
            copy[assistantMsgIndex] = {
              role: 'assistant',
              content: `⚠️ **خطا در دریافت پاسخ از سرور نادیا:**\n${err.message}\n\nلطفاً از تنظیمات بررسی کنید که سرور الاما روی \`${settings.serverUrl}\` فعال باشد.`,
            };
          }
          return copy;
        });
      },
    });
  };

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClearChat = () => {
    if (confirm('آیا از پاک کردن تاریخچه گفتگو اطمینان دارید؟')) {
      setMessages([]);
      handleStopSpeaking();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nadia_chat_messages');
      }
    }
  };

  const handleSaveSettings = () => {
    saveStoredOllamaSettings(settings);
    setShowSettingsModal(false);
    handleRefreshStatus(settings.serverUrl);
  };

  return (
    <div className="flex flex-col h-full max-h-[82vh] lg:max-h-none flex-1 gap-2.5">
      {/* Top Bar: Connection Badge & Controls */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 shrink-0">
        {/* Left: Status info */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status.online
                  ? 'bg-emerald-400 shadow-md shadow-emerald-400/50'
                  : 'bg-rose-500 shadow-md shadow-rose-500/50'
              }`}
            />
            {status.online && (
              <span className="absolute w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
            )}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200">
                {status.hasNadia ? 'هوش مصنوعی نادیا (Nadia GPT)' : 'سرور الاما (Ollama)'}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {settings.model}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {status.online
                ? `آنلاین (${status.ping}ms) • ${settings.serverUrl}`
                : `عدم دسترسی به سرور • ${settings.serverUrl}`}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleRefreshStatus()}
            disabled={isCheckingStatus}
            title="بررسی مجدد وضعیت اتصال سرور"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingStatus ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          <button
            onClick={() => {
              const nextVal = !autoSpeakReplies;
              setAutoSpeakReplies(nextVal);
              saveStoredOllamaSettings({ autoSpeak: nextVal });
            }}
            title={autoSpeakReplies ? 'لب‌خوانی خودکار فعال است' : 'لب‌خوانی خودکار غیرفعال است'}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition-all ${
              autoSpeakReplies
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {autoSpeakReplies ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">لب‌خوانی خودکار</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            title="تنظیمات سرور الاما و پارامترها"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              title="پاک کردن پیام‌ها"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Messages Container */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto space-y-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 min-h-[260px] max-h-[460px] scrollbar-thin"
      >
        {messages.length === 0 ? (
          /* Welcome State Screen */
          <div className="flex flex-col items-center justify-center py-6 px-2 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 via-emerald-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Bot className="w-6 h-6 text-slate-950" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center justify-center gap-1.5">
                <span>گفتگو با هوش مصنوعی نادیا (Nadia GPT)</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                متصل به سرور الاما با مدل{' '}
                <strong className="text-sky-400 font-mono">Nadia_gpt:latest</strong>. کاراکتر سه بعدی پاسخ‌ها را به صورت همزمان تلفظ کرده و لب‌خوانی می‌کند.
              </p>
            </div>

            {/* Model capabilities tags */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                <span>پاسخ آنی استریم</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                <Volume2 className="w-3 h-3" />
                <span>لب‌خوانی هماهنگ سه‌بعدی</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                <span>درک تصاویر (Vision)</span>
              </span>
            </div>

            {/* Suggestion Prompt Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md pt-2">
              {SUGGESTION_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  className="text-right p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-800/80 transition-all text-xs group flex flex-col gap-0.5 shadow-sm"
                >
                  <div className="flex items-center justify-between text-slate-200 font-medium">
                    <span className="group-hover:text-sky-300 transition-colors">{item.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:-translate-x-0.5 transition-all" />
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={index}
                className={`flex gap-2.5 text-xs ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center font-bold shadow-md ${
                    isUser
                      ? 'bg-sky-500 text-slate-950 shadow-sky-500/20'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Content Bubble */}
                <div
                  className={`flex flex-col max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-md ${
                    isUser
                      ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {/* Sender title and action buttons */}
                  <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400 pb-1 mb-1 border-b border-white/10">
                    <span className={`font-semibold ${isUser ? 'text-sky-200' : 'text-emerald-400'}`}>
                      {isUser ? 'شما' : 'مدل نادیا (Nadia GPT)'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!isUser && (
                        <button
                          onClick={() => handleSpeakText(msg.content)}
                          title="پخش و تلفظ مجدد با کاراکتر سه بعدی"
                          className="hover:text-emerald-300 p-0.5 transition-colors flex items-center gap-0.5"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span className="text-[9px]">تلفظ</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleCopyMessage(msg.content, index)}
                        title="کپی متن پیام"
                        className="hover:text-white p-0.5 transition-colors"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Attached Image Thumbnail if present */}
                  {msg.images && msg.images.length > 0 && (
                    <div className="mb-2">
                      <img
                        src={`data:image/jpeg;base64,${msg.images[0]}`}
                        alt="Attached"
                        className="max-h-48 rounded-lg object-contain border border-white/20"
                      />
                    </div>
                  )}

                  {/* Text content */}
                  <div className="whitespace-pre-wrap leading-relaxed select-text font-sans">
                    {msg.content || (
                      <span className="flex items-center gap-1.5 text-slate-400 italic">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>در حال تفکر و پردازش نادیا...</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Image Preview Thumbnail if attached */}
      {attachedImage && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl shrink-0">
          <div className="relative">
            <img
              src={`data:image/jpeg;base64,${attachedImage}`}
              alt="Attachment"
              className="w-10 h-10 object-cover rounded-lg border border-slate-700"
            />
            <button
              onClick={() => setAttachedImage(null)}
              className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-0.5 shadow"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <span className="text-[11px] text-slate-300">تصویر پیوست شد (قابلیت Vision نادیا)</span>
        </div>
      )}

      {/* Input Box & Action Bar */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-2xl p-1.5 shadow-inner focus-within:border-sky-500 transition-colors">
          {/* Attach image button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="پیوست تصویر برای بررسی بینایی هوش مصنوعی"
            className="p-2 rounded-xl text-slate-400 hover:text-sky-400 hover:bg-slate-900 transition-colors shrink-0"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Text input area */}
          <textarea
            ref={textareaRef}
            dir="rtl"
            rows={1}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isGenerating && (inputPrompt.trim() || attachedImage)) {
                  handleSendMessage();
                }
              }
            }}
            placeholder="پیامی برای نادیا بنویسید... (Enter برای ارسال، Shift+Enter خط جدید)"
            className="flex-1 bg-transparent border-0 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none max-h-24 scrollbar-none"
          />

          {/* Send or Stop button */}
          {isGenerating ? (
            <button
              type="button"
              onClick={handleStopGenerating}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-rose-600/20 shrink-0"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>توقف</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputPrompt.trim() && !attachedImage}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-sky-500/20 active:scale-95 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارسال</span>
            </button>
          )}
        </div>

        {/* Live Speaking Indicator */}
        {isSpeaking && (
          <div className="flex items-center justify-between px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-400 animate-pulse">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              <span>کاراکتر در حال صحبت و لب‌خوانی است...</span>
            </div>
            <button
              onClick={handleStopSpeaking}
              className="text-slate-400 hover:text-white underline text-[10px]"
            >
              توقف صدا
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            dir="rtl"
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-slate-100">تنظیمات سرور الاما (Ollama)</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {/* Server URL Input */}
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 font-medium">آدرس سرور الاما (Ollama Server URL):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.serverUrl}
                    onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-sky-500"
                    placeholder="http://192.168.171.12:11434"
                  />
                  <button
                    type="button"
                    onClick={() => handleRefreshStatus(settings.serverUrl)}
                    disabled={isCheckingStatus}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-medium whitespace-nowrap transition-colors"
                  >
                    تست اتصال
                  </button>
                </div>
                {testResult && (
                  <span
                    className={`text-[10px] mt-1 ${
                      status.online ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {testResult}
                  </span>
                )}
              </div>

              {/* Model Select */}
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 font-medium">مدل فعال هوش مصنوعی:</label>
                <select
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-sky-500"
                >
                  {status.models.length > 0 ? (
                    status.models.map((m, idx) => (
                      <option key={idx} value={m.name || m.model}>
                        {m.name || m.model}
                      </option>
                    ))
                  ) : (
                    <option value={settings.model}>{settings.model}</option>
                  )}
                </select>
              </div>

              {/* System Prompt */}
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 font-medium">دستورالعمل سیستم (System Prompt):</label>
                <textarea
                  rows={2}
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  placeholder="دستورالعمل لحن و رفتار کاراکتر..."
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-slate-200 text-xs focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              {/* Temperature */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>درجه خلاقیت (Temperature):</span>
                  <span className="font-mono text-sky-400">{settings.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Top P */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>تنوع واژگان (Top-P):</span>
                  <span className="font-mono text-sky-400">{settings.topP}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={settings.topP}
                  onChange={(e) => setSettings({ ...settings, topP: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-md shadow-sky-500/20"
              >
                ذخیره تنظیمات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
