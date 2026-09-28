'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FacialExpression, FigurePose } from '@/lib/types';
import {
  LiveVoiceItem,
  LiveTurnResponse,
  EnglishLessonTopic,
  EnglishLevel,
  TeacherPersona,
  TeacherConfig,
  OFFICIAL_VOICES,
  LESSON_TOPICS,
  LEVEL_SETTINGS,
  TEACHER_PERSONAS,
  buildEnglishTeacherPrompt,
} from '@/lib/chatgpt-live-client';
import {
  playLiveVoiceWithLipSync,
  LiveAudioLipSyncController,
} from '@/lib/live-audio-lipsync';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Square,
  Volume2,
  Sparkles,
  Settings2,
  BookOpen,
  GraduationCap,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Languages,
  RotateCcw,
  Zap,
  Radio,
  Sliders,
  X,
  VolumeX,
  User,
  Bot,
} from 'lucide-react';

interface LiveEnglishTeacherProps {
  onUpdateVisemes: (morphs: Partial<FacialExpression>) => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  characterName?: string;
  onSelectFigure?: (figure: FigurePose) => void;
  onUpdateExpression?: (partial: Partial<FacialExpression>) => void;
}

interface ChatTurnMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  topic?: string;
}

export function LiveEnglishTeacher({
  onUpdateVisemes,
  isSpeaking,
  setIsSpeaking,
  characterName = 'کاراکتر معلم',
}: LiveEnglishTeacherProps) {
  // Call & Live State
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [callState, setCallState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(16).fill(0));

  // Teacher Configuration
  const [config, setConfig] = useState<TeacherConfig>({
    persona: 'sarah',
    topic: 'daily_chat',
    level: 'intermediate',
    voice: 'sky',
    bilingualHelp: false,
  });

  // Server & Voices Status
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [serverPing, setServerPing] = useState<number | null>(null);
  const [availableVoices, setAvailableVoices] = useState<LiveVoiceItem[]>(OFFICIAL_VOICES);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // Dialogue & Subtitles
  const [transcript, setTranscript] = useState<ChatTurnMessage[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<{
    speaker: 'student' | 'teacher' | 'system';
    text: string;
  }>({
    speaker: 'system',
    text: 'برای شروع مکالمه زنده با معلم زبان انگلیسی روی دکمه شروع تماس کلیک کنید.',
  });
  const [showPersianTranslation, setShowPersianTranslation] = useState<boolean>(false);
  const [translatedSubtitle, setTranslatedSubtitle] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Silent keyboard input bar
  const [textInputOpen, setTextInputOpen] = useState<boolean>(false);
  const [typedMessage, setTypedMessage] = useState<string>('');

  // Audio Playback & Speech Recognition Refs
  const audioControllerRef = useRef<LiveAudioLipSyncController | null>(null);
  const recognitionRef = useRef<any>(null);
  const speechBufferRef = useRef<string>('');
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const isBotSpeakingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const isCallActiveRef = useRef<boolean>(false);
  const callTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  isMutedRef.current = isMuted;
  isCallActiveRef.current = isCallActive;

  // Check backend server status on mount
  useEffect(() => {
    checkServerHealth();
    loadRemoteVoices();
  }, []);

  const checkServerHealth = async () => {
    try {
      const res = await fetch('/api/live/status');
      const data = await res.json();
      setServerOnline(data.online);
      setServerPing(data.ping);
    } catch {
      setServerOnline(false);
      setServerPing(null);
    }
  };

  const loadRemoteVoices = async () => {
    try {
      const res = await fetch('/api/live/voices');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAvailableVoices(data);
        }
      }
    } catch {
      // use defaults
    }
  };

  // Scroll transcript to bottom
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript, currentSubtitle]);

  // Handle call timer
  useEffect(() => {
    if (isCallActive) {
      setCallDuration(0);
      callTimerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerIntervalRef.current) {
        clearInterval(callTimerIntervalRef.current);
        callTimerIntervalRef.current = null;
      }
    }
    return () => {
      if (callTimerIntervalRef.current) clearInterval(callTimerIntervalRef.current);
    };
  }, [isCallActive]);

  // Format Call Timer MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Stop currently playing speech and avatar audio
  const stopTeacherSpeaking = useCallback(() => {
    if (audioControllerRef.current) {
      audioControllerRef.current.stop();
      audioControllerRef.current = null;
    }
    isBotSpeakingRef.current = false;
    setIsSpeaking(false);
    setWaveformBars(new Array(16).fill(0));
  }, [setIsSpeaking]);

  // Send turn to ChatGPT Live API (/api/live/turn)
  const handleSendTurn = async (userText: string) => {
    if (!userText.trim() || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setCallState('thinking');

    // Pause recognition while processing
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    // Add student turn to transcript
    const userMsg: ChatTurnMessage = {
      id: `turn_${Date.now()}_u`,
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTranscript((prev) => [...prev, userMsg]);
    setCurrentSubtitle({ speaker: 'student', text: userText });
    setTranslatedSubtitle('');

    try {
      const historyItems = transcript.slice(-4).map((t) => ({
        role: t.role,
        text: t.text,
      }));

      const fullPrompt = buildEnglishTeacherPrompt(userText, config, historyItems);

      const res = await fetch('/api/live/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          voice: config.voice,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data: LiveTurnResponse = await res.json();
      const reply = data.reply_text;

      // Add teacher turn to transcript
      const teacherMsg: ChatTurnMessage = {
        id: `turn_${Date.now()}_a`,
        role: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setTranscript((prev) => [...prev, teacherMsg]);
      setCurrentSubtitle({ speaker: 'teacher', text: reply });

      // If audio returned, play through lipsync driver with clean text
      if (data.audio_base64) {
        stopTeacherSpeaking();

        isBotSpeakingRef.current = true;
        setIsSpeaking(true);
        setCallState('speaking');

        audioControllerRef.current = playLiveVoiceWithLipSync(data.audio_base64, reply, {
          onStart: () => {
            isBotSpeakingRef.current = true;
            setIsSpeaking(true);
            setCallState('speaking');
          },
          onEnd: () => {
            isBotSpeakingRef.current = false;
            setIsSpeaking(false);
            audioControllerRef.current = null;
            onUpdateVisemes({
              viseme_sil: 1,
              viseme_aa: 0,
              viseme_O: 0,
              viseme_E: 0,
              viseme_I: 0,
              viseme_U: 0,
              viseme_PP: 0,
              viseme_FF: 0,
              viseme_SS: 0,
              mouthOpen: 0,
              jawOpen: 0,
              speechVolume: 0,
              isSpeechPaused: true,
            });

            // If call still active, resume listening to student
            if (isCallActiveRef.current && !isMutedRef.current) {
              setCallState('listening');
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch {}
              }
            } else {
              setCallState('idle');
            }
          },
          onError: (err) => {
            console.error('Audio playback error:', err);
            isBotSpeakingRef.current = false;
            setIsSpeaking(false);
            if (isCallActiveRef.current) setCallState('listening');
          },
          onVisemeUpdate: (morphs) => {
            onUpdateVisemes(morphs);
          },
          onWaveformUpdate: (bars) => {
            setWaveformBars(bars);
          },
        });
      } else {
        // Text-only fallback if no audio
        setCallState(isCallActiveRef.current ? 'listening' : 'idle');
        if (isCallActiveRef.current && recognitionRef.current && !isMutedRef.current) {
          try {
            recognitionRef.current.start();
          } catch {}
        }
      }
    } catch (err: unknown) {
      console.error('Live turn error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setCurrentSubtitle({
        speaker: 'system',
        text: `⚠️ خطا در پاسخ معلم: ${errMsg}`,
      });
      setCallState('idle');
    } finally {
      isProcessingRef.current = false;
    }
  };

  // Start Speech Recognition
  const initSpeechRecognition = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('Web Speech API not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fa-IR'; // recognizes both Persian and English speech from the student

      recognition.onstart = () => {
        if (isCallActiveRef.current && !isBotSpeakingRef.current && !isProcessingRef.current) {
          setCallState('listening');
        }
      };

      recognition.onresult = (event: any) => {
        // If teacher is speaking and student talks -> barge-in / interrupt
        if (isBotSpeakingRef.current) {
          stopTeacherSpeaking();
        }

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const currentText = (final || interim).trim();
        if (currentText) {
          speechBufferRef.current = currentText;
          setCurrentSubtitle({ speaker: 'student', text: currentText });
        }

        // Debounce silence: pause triggers turn
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        if (final.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            triggerStudentTurn();
          }, 800);
        } else if (interim.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            triggerStudentTurn();
          }, 1500);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          alert('لطفاً دسترسی به میکروفون را در مرورگر مجاز کنید تا بتوانید با معلم صحبت کنید.');
          endCall();
        }
      };

      recognition.onend = () => {
        if (
          isCallActiveRef.current &&
          !isBotSpeakingRef.current &&
          !isProcessingRef.current &&
          !isMutedRef.current
        ) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRec init failed:', e);
    }
  };

  const triggerStudentTurn = () => {
    if (!speechBufferRef.current.trim() || isProcessingRef.current) return;
    const text = speechBufferRef.current.trim();
    speechBufferRef.current = '';
    handleSendTurn(text);
  };

  // Start Live Call
  const startCall = (initialGreeting?: string) => {
    setIsCallActive(true);
    isCallActiveRef.current = true;
    setCallState('listening');

    initSpeechRecognition();

    if (recognitionRef.current && !isMutedRef.current) {
      try {
        recognitionRef.current.start();
      } catch {}
    }

    const persona = TEACHER_PERSONAS[config.persona];
    const topic = LESSON_TOPICS.find((t) => t.id === config.topic);

    // Trigger initial welcoming turn from teacher in Persian
    handleSendTurn(
      initialGreeting ||
        `[شروع جلسه]: زبان‌آموز وارد کلاس آنلاین شده است. به زبان فارسی با لحنی پرانرژی و صمیمی به او سلام و خوش‌آمد بگویید، خودتان را به عنوان ${persona.nameFa} معرفی کنید و بگویید امروز قرار است در زمینه ${topic?.titleFa} با هم مکالمه و تمرین داشته باشیم و یک سوال کوتاه برای شروع بپرسید.`
    );
  };

  // End Live Call
  const endCall = () => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setCallState('idle');

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    stopTeacherSpeaking();

    setCurrentSubtitle({
      speaker: 'system',
      text: 'تماس به پایان رسید. جلسه مکالمه ذخیره شد.',
    });
  };

  // Toggle Mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    if (nextMuted) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    } else {
      if (isCallActiveRef.current && !isBotSpeakingRef.current) {
        setCallState('listening');
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {}
        }
      }
    }
  };

  // Interrupt Teacher
  const handleInterrupt = () => {
    stopTeacherSpeaking();
    if (isCallActiveRef.current && !isMutedRef.current) {
      setCallState('listening');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      }
    }
  };

  // Send Typed Message
  const handleSendTyped = () => {
    if (!typedMessage.trim()) return;
    const msg = typedMessage.trim();
    setTypedMessage('');
    setTextInputOpen(false);

    if (!isCallActive) {
      setIsCallActive(true);
      isCallActiveRef.current = true;
      initSpeechRecognition();
    }

    handleSendTurn(msg);
  };

  // Translate Subtitle into Persian using quick helper
  const handleTranslateSubtitle = async () => {
    if (!currentSubtitle.text || isTranslating) return;
    setIsTranslating(true);
    try {
      const res = await fetch('/api/live/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Translate this spoken English sentence accurately and naturally into Persian (Farsi) in 1 short line: "${currentSubtitle.text}"`,
          voice: 'cove',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTranslatedSubtitle(data.reply_text);
        setShowPersianTranslation(true);
      }
    } catch {
      setTranslatedSubtitle('ترجمه در دسترس نیست');
    } finally {
      setIsTranslating(false);
    }
  };

  const currentTopic = LESSON_TOPICS.find((t) => t.id === config.topic) || LESSON_TOPICS[0];
  const currentPersona = TEACHER_PERSONAS[config.persona];
  const currentVoice = availableVoices.find((v) => v.id === config.voice) || availableVoices[0];

  return (
    <div className="flex flex-col h-full bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative">
      {/* Top Teacher Header & Status */}
      <div className="p-3.5 bg-slate-950/80 border-b border-slate-800/90 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-400 p-[1.5px] shadow-md shadow-sky-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-white">
                <GraduationCap className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            {isCallActive && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm">{currentPersona.name}</span>
              <span className="text-[10px] bg-sky-500/15 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded font-medium">
                معلم زبان انگلیسی (پایه فارسی)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{currentTopic.icon} {currentTopic.titleFa.split('(')[0]}</span>
              <span>·</span>
              <span className="font-mono text-emerald-400">{currentVoice.name} ({currentVoice.gender})</span>
            </p>
          </div>
        </div>

        {/* Server & Settings Actions */}
        <div className="flex items-center gap-1.5">
          {/* Live Ping status */}
          <div
            className={`px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 border font-mono ${
              serverOnline
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
            title={serverOnline ? `API 127.0.0.1:8001 (${serverPing}ms)` : 'عدم اتصال به سرور لایو'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>{serverOnline ? `${serverPing || 20}ms` : 'آفلاین'}</span>
          </div>

          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all border border-slate-700/60"
            title="تنظیمات درس و صدای معلم"
          >
            <Sliders className="w-4 h-4 text-sky-400" />
          </button>
        </div>
      </div>

      {/* Main Interactive Stage: Live Audio Call Status */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden relative">
        {/* Dynamic State Card */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-inner">
          {/* Ambient Glow matching state */}
          <div
            className={`absolute inset-0 pointer-events-none transition-all duration-700 opacity-20 blur-3xl ${
              callState === 'speaking'
                ? 'bg-sky-500'
                : callState === 'listening'
                ? 'bg-emerald-500'
                : callState === 'thinking'
                ? 'bg-purple-500'
                : 'bg-transparent'
            }`}
          />

          {/* Central Animated Orb & Frequency Visualizer */}
          <div className="relative mb-3 flex items-center justify-center">
            {/* Visualizer Ring */}
            <div
              className={`w-28 h-28 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                callState === 'speaking'
                  ? 'border-sky-400 shadow-lg shadow-sky-500/30 scale-105'
                  : callState === 'listening'
                  ? 'border-emerald-400 shadow-lg shadow-emerald-500/30 animate-pulse'
                  : callState === 'thinking'
                  ? 'border-purple-400 shadow-lg shadow-purple-500/30 animate-spin'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  callState === 'speaking'
                    ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white'
                    : callState === 'listening'
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white'
                    : callState === 'thinking'
                    ? 'bg-gradient-to-tr from-purple-500 to-pink-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {callState === 'speaking' ? (
                  <Volume2 className="w-8 h-8 animate-bounce" />
                ) : callState === 'listening' ? (
                  <Mic className="w-8 h-8 animate-pulse" />
                ) : callState === 'thinking' ? (
                  <Zap className="w-8 h-8 animate-pulse" />
                ) : (
                  <Phone className="w-8 h-8 opacity-40" />
                )}
              </div>
            </div>
          </div>

          {/* Frequency Bars Visualizer (Active during speech) */}
          <div className="h-6 flex items-center justify-center gap-1 w-full max-w-[200px] mb-2">
            {waveformBars.map((val, idx) => (
              <span
                key={idx}
                className={`w-1 rounded-full transition-all duration-75 ${
                  callState === 'speaking' ? 'bg-sky-400' : 'bg-slate-800'
                }`}
                style={{
                  height: `${Math.max(4, val * 24)}px`,
                  opacity: callState === 'speaking' ? 0.4 + val * 0.6 : 0.2,
                }}
              />
            ))}
          </div>

          {/* Call Status Caption & Duration */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-200">
              {callState === 'speaking' && '🔊 معلم در حال آموزش صوتی...'}
              {callState === 'listening' && '🎤 گوش دادن به صدای انگلیسی شما...'}
              {callState === 'thinking' && '🧠 معلم در حال پردازش و تدریس...'}
              {callState === 'idle' && (isCallActive ? 'آماده برای صحبت شما' : 'جلسه آنلاین آماده شروع است')}
            </span>

            {isCallActive && (
              <span className="text-[11px] font-mono text-emerald-400 font-bold mt-1">
                ⏱️ {formatTimer(callDuration)}
              </span>
            )}
          </div>
        </div>

        {/* Live Subtitles & Learning Card */}
        <div className="mt-3 p-3.5 bg-slate-950/90 border border-slate-800/90 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-1.5">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold text-slate-300">
                {currentSubtitle.speaker === 'student' && 'شما (دانش‌آموز):'}
                {currentSubtitle.speaker === 'teacher' && `${currentPersona.name}:`}
                {currentSubtitle.speaker === 'system' && 'وضعیت کلاس:'}
              </span>
            </div>

            {currentSubtitle.speaker === 'teacher' && (
              <button
                onClick={handleTranslateSubtitle}
                disabled={isTranslating}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
              >
                <Languages className="w-3 h-3" />
                <span>{isTranslating ? 'در حال ترجمه...' : 'ترجمه فارسی'}</span>
              </button>
            )}
          </div>

          {/* Subtitle text */}
          <p
            dir="rtl"
            className={`text-sm leading-relaxed text-right ${
              currentSubtitle.speaker === 'teacher'
                ? 'text-sky-100 font-medium'
                : currentSubtitle.speaker === 'student'
                ? 'text-emerald-200 font-medium'
                : 'text-slate-400 text-xs'
            }`}
          >
            {currentSubtitle.text}
          </p>

          {/* Persian Translation if requested */}
          {showPersianTranslation && translatedSubtitle && (
            <div dir="rtl" className="mt-1 pt-1.5 border-t border-slate-800/80 text-xs text-amber-300/90 bg-amber-500/5 p-2 rounded-lg">
              <span className="font-semibold text-amber-400">ترجمه روان: </span>
              <span>{translatedSubtitle}</span>
            </div>
          )}
        </div>

        {/* Quick Topic Prompts (When call is active or before call) */}
        {!isCallActive ? (
          <div className="mt-3 flex-1 flex flex-col gap-1.5 overflow-y-auto">
            <span className="text-[11px] text-slate-400 font-medium">موضوعات پیشنهادی برای شروع:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {LESSON_TOPICS.slice(0, 4).map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => {
                    setConfig((c) => ({ ...c, topic: topic.id }));
                    startCall(topic.starterPrompt);
                  }}
                  className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-sky-500/40 text-right transition-all flex items-start gap-2 group"
                >
                  <span className="text-base shrink-0">{topic.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-300">
                      {topic.titleFa.split('(')[0]}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">
                      {topic.titleEn}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Ongoing Transcript Drawer */
          <div
            ref={transcriptScrollRef}
            className="mt-3 flex-1 overflow-y-auto bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/50 flex flex-col gap-2 max-h-[160px]"
          >
            {transcript.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 rounded-xl text-xs ${
                  msg.role === 'user'
                    ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-100 self-end ml-4'
                    : 'bg-slate-800/60 border border-slate-700/50 text-slate-100 self-start mr-4'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] opacity-70 mb-0.5">
                  <span className="font-semibold">{msg.role === 'user' ? 'شما' : currentPersona.name}</span>
                  <span>{msg.timestamp}</span>
                </div>
                <div dir="rtl" className="leading-relaxed text-right">
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Silent Typing input bar (toggleable) */}
        {textInputOpen && (
          <div className="mt-3 flex items-center gap-2 bg-slate-950 border border-slate-700 p-1.5 rounded-xl">
            <input
              type="text"
              dir="auto"
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendTyped()}
              placeholder="پیام خود را بنویسید (فارسی یا English)..."
              className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={handleSendTyped}
              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>ارسال</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Main Call Action Dock */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
        {/* Toggle Mute Mic */}
        <button
          onClick={toggleMute}
          disabled={!isCallActive}
          className={`p-3 rounded-2xl transition-all border ${
            isMuted
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80'
          } ${!isCallActive ? 'opacity-40 cursor-not-allowed' : ''}`}
          title={isMuted ? 'وصل میکروفون' : 'قطع میکروفون'}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Big Central Call Toggle Button */}
        {!isCallActive ? (
          <button
            onClick={() => startCall()}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all scale-100 active:scale-95"
          >
            <Phone className="w-5 h-5 fill-current" />
            <span>شروع کلاس مکالمه زنده (Start Call)</span>
          </button>
        ) : (
          <button
            onClick={endCall}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition-all scale-100 active:scale-95"
          >
            <PhoneOff className="w-5 h-5 fill-current" />
            <span>پایان تماس (End Lesson)</span>
          </button>
        )}

        {/* Interrupt teacher speaking */}
        <button
          onClick={handleInterrupt}
          disabled={!isSpeaking}
          className={`p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-all ${
            !isSpeaking ? 'opacity-40 cursor-not-allowed' : 'text-amber-400 border-amber-500/40'
          }`}
          title="قطع صحبت معلم (Interrupt)"
        >
          <Square className="w-5 h-5 fill-current" />
        </button>

        {/* Silent Text Toggle */}
        <button
          onClick={() => setTextInputOpen(!textInputOpen)}
          className={`p-3 rounded-2xl transition-all border ${
            textInputOpen
              ? 'bg-sky-500 text-slate-950 border-sky-400'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80'
          }`}
          title="حالت چت متنی"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      {/* Teacher & Lesson Configuration Modal */}
      {showConfigModal && (
        <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col p-4 overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-sky-400" />
              <h3 className="font-bold text-sm text-white">تنظیمات کلاس و صدای معلم</h3>
            </div>
            <button
              onClick={() => setShowConfigModal(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 text-xs">
            {/* 1. Teacher Persona */}
            <div>
              <label className="font-semibold text-slate-300 block mb-2">انتخاب استاد:</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(TEACHER_PERSONAS) as TeacherPersona[]).map((pKey) => {
                  const p = TEACHER_PERSONAS[pKey];
                  const isSelected = config.persona === pKey;
                  return (
                    <button
                      key={pKey}
                      onClick={() => setConfig((c) => ({ ...c, persona: pKey, voice: p.defaultVoice }))}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs">{p.name}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">{p.nameFa}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Official ChatGPT Voice */}
            <div>
              <label className="font-semibold text-slate-300 block mb-2">
                صدای رسمی ChatGPT (OpenAI Voice):
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                {availableVoices.map((v) => {
                  const isSelected = config.voice === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setConfig((c) => ({ ...c, voice: v.id }))}
                      className={`p-2 rounded-lg border text-right transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <div>
                        <div className="font-mono text-xs">{v.name}</div>
                        <div className="text-[10px] opacity-60">
                          {v.gender === 'Female' ? 'زنانه' : 'مردانه'}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Lesson Topic */}
            <div>
              <label className="font-semibold text-slate-300 block mb-2">موضوع و سبک کلاس:</label>
              <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                {LESSON_TOPICS.map((topic) => {
                  const isSelected = config.topic === topic.id;
                  return (
                    <button
                      key={topic.id}
                      onClick={() => setConfig((c) => ({ ...c, topic: topic.id }))}
                      className={`p-2 rounded-lg border text-right transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-semibold'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{topic.icon}</span>
                        <div>
                          <div>{topic.titleFa}</div>
                          <div className="text-[10px] opacity-60">{topic.titleEn}</div>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Student Level */}
            <div>
              <label className="font-semibold text-slate-300 block mb-2">سطح زبان شما:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['beginner', 'intermediate', 'advanced'] as EnglishLevel[]).map((lvl) => {
                  const isSelected = config.level === lvl;
                  return (
                    <button
                      key={lvl}
                      onClick={() => setConfig((c) => ({ ...c, level: lvl }))}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                      }`}
                    >
                      {LEVEL_SETTINGS[lvl].labelFa}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Bilingual Help */}
            <div className="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
              <div>
                <div className="font-semibold text-slate-200">راهنمای فارسی در ابهامات</div>
                <div className="text-[10px] text-slate-400">
                  اگر کلمه‌ای را متوجه نشدید، معلم معنای فارسی آن را کوتاه ذکر کند
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.bilingualHelp}
                onChange={(e) => setConfig((c) => ({ ...c, bilingualHelp: e.target.checked }))}
                className="w-4 h-4 accent-sky-500"
              />
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowConfigModal(false)}
              className="mt-2 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-center"
            >
              ذخیره و اعمال تنظیمات
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
