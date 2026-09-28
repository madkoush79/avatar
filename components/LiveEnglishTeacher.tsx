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
  parseAiGestureAndEmotion,
  AiGestureEmotion,
} from '@/lib/chatgpt-live-client';
import { TEN_FIGURE_POSES } from '@/lib/figures-data';
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
  AudioWaveform,
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
  onSelectFigure,
  onUpdateExpression,
}: LiveEnglishTeacherProps) {
  // Call & Live State
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [callState, setCallState] = useState<'idle' | 'listening' | 'recording' | 'thinking' | 'speaking'>('idle');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(new Array(16).fill(0));
  const [activeAiGesture, setActiveAiGesture] = useState<{
    gestureNameFa: string;
    emotionNameFa: string;
  } | null>(null);

  // Microphone mode: Auto (silence detection / VAD) or Manual (push-to-talk)
  const [micMode, setMicMode] = useState<'auto' | 'manual'>('auto');
  const [isManualRecording, setIsManualRecording] = useState<boolean>(false);
  const [studentMicVolume, setStudentMicVolume] = useState<number>(0);

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
    text: 'برای شروع مکالمه مستقیم صوتی با معلم زبان انگلیسی روی دکمه شروع تماس کلیک کنید.',
  });
  const [showPersianTranslation, setShowPersianTranslation] = useState<boolean>(false);
  const [translatedSubtitle, setTranslatedSubtitle] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Silent keyboard input bar
  const [textInputOpen, setTextInputOpen] = useState<boolean>(false);
  const [typedMessage, setTypedMessage] = useState<string>('');

  // Audio Playback & Microphone Recorder Refs
  const audioControllerRef = useRef<LiveAudioLipSyncController | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  // VAD & Silence tracking
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speechDetectedRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const isBotSpeakingRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const isCallActiveRef = useRef<boolean>(false);
  const micModeRef = useRef<'auto' | 'manual'>('auto');
  const callTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  isMutedRef.current = isMuted;
  isCallActiveRef.current = isCallActive;
  micModeRef.current = micMode;

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

  // -------------------------------------------------------------
  // Teacher Voice & Animation Playback with LipsyncFa
  // -------------------------------------------------------------
  const playTeacherResponse = useCallback(
    (replyText: string, audioBase64?: string) => {
      // 1. Parse AI Gesture and Emotion for the 3D character
      const parsedAi = parseAiGestureAndEmotion(replyText);
      setActiveAiGesture({
        gestureNameFa: parsedAi.gestureNameFa,
        emotionNameFa: parsedAi.emotionNameFa,
      });

      // Apply hand/body gesture requested by AI
      if (onSelectFigure) {
        const matchingPose = TEN_FIGURE_POSES.find((f) => f.id === parsedAi.figureId);
        if (matchingPose) {
          onSelectFigure(matchingPose);
        }
      }

      // Apply facial expression
      if (onUpdateExpression) {
        onUpdateExpression({
          mouthSmile: parsedAi.facialExpression.mouthSmile,
          browInnerUp: parsedAi.facialExpression.browInnerUp,
        });
      }

      // Add teacher turn to transcript
      const teacherMsg: ChatTurnMessage = {
        id: `turn_${Date.now()}_a`,
        role: 'assistant',
        text: parsedAi.cleanedText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setTranscript((prev) => [...prev, teacherMsg]);
      setCurrentSubtitle({ speaker: 'teacher', text: parsedAi.cleanedText });

      // If audio returned, play through lipsync driver with clean text
      if (audioBase64) {
        stopTeacherSpeaking();

        isBotSpeakingRef.current = true;
        setIsSpeaking(true);
        setCallState('speaking');

        audioControllerRef.current = playLiveVoiceWithLipSync(
          audioBase64,
          parsedAi.cleanedText,
          {
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

              // After teacher finishes speaking, resume recording student's voice
              if (isCallActiveRef.current && !isMutedRef.current) {
                setCallState('listening');
                startAudioRecording();
              } else {
                setCallState('idle');
              }
            },
            onError: (err) => {
              console.error('Audio playback error:', err);
              isBotSpeakingRef.current = false;
              setIsSpeaking(false);
              if (isCallActiveRef.current) {
                setCallState('listening');
                startAudioRecording();
              }
            },
            onVisemeUpdate: (morphs) => {
              onUpdateVisemes(morphs);
            },
            onWaveformUpdate: (bars) => {
              setWaveformBars(bars);
            },
          }
        );
      } else {
        // Text-only fallback
        setCallState(isCallActiveRef.current ? 'listening' : 'idle');
        if (isCallActiveRef.current && !isMutedRef.current) {
          startAudioRecording();
        }
      }
    },
    [onSelectFigure, onUpdateExpression, onUpdateVisemes, setIsSpeaking, stopTeacherSpeaking]
  );

  // -------------------------------------------------------------
  // Send Recorded Audio Blob Directly to Backend STT + Teacher
  // -------------------------------------------------------------
  const handleSendAudioTurn = async (audioBlob: Blob) => {
    if (isProcessingRef.current || !audioBlob || audioBlob.size < 1000) {
      if (isCallActiveRef.current && !isBotSpeakingRef.current) {
        startAudioRecording();
      }
      return;
    }

    isProcessingRef.current = true;
    setCallState('thinking');
    setCurrentSubtitle({
      speaker: 'system',
      text: '🎙️ در حال ارسال صدای ضبط‌شده به سرور و تحلیل توسط هوش مصنوعی...',
    });

    try {
      const formData = new FormData();
      const ext = audioBlob.type.includes('wav') ? 'wav' : 'webm';
      formData.append('audio_file', audioBlob, `student_voice.${ext}`);
      formData.append('voice', config.voice);
      formData.append('language', 'fa-IR');
      formData.append('config', JSON.stringify(config));

      const historyItems = transcript.slice(-4).map((t) => ({
        role: t.role,
        text: t.text,
      }));
      formData.append('history', JSON.stringify(historyItems));

      const res = await fetch('/api/live/audio_turn', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.empty) {
        setCurrentSubtitle({
          speaker: 'system',
          text: 'صدایی شنیده نشد. لطفاً شفاف‌تر صحبت کنید.',
        });
        setCallState('listening');
        startAudioRecording();
        return;
      }

      // Add student voice transcript
      if (data.user_text) {
        const studentMsg: ChatTurnMessage = {
          id: `turn_${Date.now()}_u`,
          role: 'user',
          text: data.user_text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setTranscript((prev) => [...prev, studentMsg]);
        setCurrentSubtitle({ speaker: 'student', text: data.user_text });
      }

      // Play teacher reply with lipsync and gestures
      playTeacherResponse(data.reply_text, data.audio_base64);
    } catch (err: unknown) {
      console.error('Audio turn error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setCurrentSubtitle({
        speaker: 'system',
        text: `⚠️ خطا در ارسال صدا: ${errMsg}`,
      });
      setCallState('idle');
      if (isCallActiveRef.current && !isBotSpeakingRef.current) {
        startAudioRecording();
      }
    } finally {
      isProcessingRef.current = false;
    }
  };

  // -------------------------------------------------------------
  // Send Typed Prompt (Silent text fallback or initial greeting)
  // -------------------------------------------------------------
  const handleSendTextTurn = async (promptText: string) => {
    if (!promptText.trim() || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setCallState('thinking');

    try {
      const historyItems = transcript.slice(-4).map((t) => ({
        role: t.role,
        text: t.text,
      }));

      const fullPrompt = buildEnglishTeacherPrompt(promptText, config, historyItems);

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
      playTeacherResponse(data.reply_text, data.audio_base64);
    } catch (err: unknown) {
      console.error('Text turn error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setCurrentSubtitle({
        speaker: 'system',
        text: `⚠️ خطا: ${errMsg}`,
      });
      setCallState('idle');
    } finally {
      isProcessingRef.current = false;
    }
  };

  // -------------------------------------------------------------
  // Microphone Stream, AudioContext VAD, and MediaRecorder
  // -------------------------------------------------------------
  const initMicrophoneStream = async (): Promise<boolean> => {
    if (mediaStreamRef.current) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Setup Web Audio Analyser for live volume meter & silence detection
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start volume monitor loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const monitorVolume = () => {
        if (!analyserRef.current || !isCallActiveRef.current) {
          micAnimFrameRef.current = requestAnimationFrame(monitorVolume);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalizedVol = Math.min(1, avg / 100);
        setStudentMicVolume(normalizedVol);

        // If student is speaking while teacher is speaking -> barge-in / interrupt
        if (normalizedVol > 0.12 && isBotSpeakingRef.current) {
          stopTeacherSpeaking();
        }

        // Voice Activity Detection (Auto Mode)
        if (
          micModeRef.current === 'auto' &&
          isCallActiveRef.current &&
          !isBotSpeakingRef.current &&
          !isProcessingRef.current &&
          !isMutedRef.current
        ) {
          // If volume is above speaking threshold
          if (normalizedVol > 0.08) {
            speechDetectedRef.current = true;
            setCallState('recording');

            // Reset silence countdown timer
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else if (speechDetectedRef.current) {
            // Student was speaking, now quiet -> start silence timeout (1000ms)
            if (!silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                silenceTimerRef.current = null;
                speechDetectedRef.current = false;
                // Auto trigger student turn with recorded audio
                stopAudioRecordingAndSend();
              }, 1100);
            }
          }
        }

        micAnimFrameRef.current = requestAnimationFrame(monitorVolume);
      };

      micAnimFrameRef.current = requestAnimationFrame(monitorVolume);
      return true;
    } catch (e) {
      console.error('Failed to get microphone stream:', e);
      alert('لطفاً دسترسی به میکروفون را در مرورگر مجاز کنید تا بتوانید مستقیم با معلم صحبت کنید.');
      return false;
    }
  };

  // Start recording microphone audio into chunks
  const startAudioRecording = () => {
    if (!mediaStreamRef.current || isProcessingRef.current || isBotSpeakingRef.current) {
      return;
    }

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        return; // already recording
      }

      audioChunksRef.current = [];
      speechDetectedRef.current = false;

      // Pick supported mime type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      }

      const recorder = mimeType
        ? new MediaRecorder(mediaStreamRef.current, { mimeType })
        : new MediaRecorder(mediaStreamRef.current);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const finalBlob = new Blob(audioChunksRef.current, {
            type: recorder.mimeType || 'audio/webm',
          });
          audioChunksRef.current = [];
          handleSendAudioTurn(finalBlob);
        } else {
          setCallState('listening');
        }
      };

      // Record in 250ms time slices for smooth streaming chunks
      recorder.start(250);
      mediaRecorderRef.current = recorder;

      if (micModeRef.current === 'manual') {
        setIsManualRecording(true);
        setCallState('recording');
      } else {
        setCallState('listening');
      }
    } catch (err) {
      console.warn('Failed to start MediaRecorder:', err);
    }
  };

  // Stop recording and send accumulated voice
  const stopAudioRecordingAndSend = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    speechDetectedRef.current = false;
    setIsManualRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping mediaRecorder:', e);
      }
    }
  };

  // -------------------------------------------------------------
  // Call Lifecycle: Start & End
  // -------------------------------------------------------------
  const startCall = async (initialStarterPrompt?: string) => {
    const hasMic = await initMicrophoneStream();
    if (!hasMic) return;

    setIsCallActive(true);
    isCallActiveRef.current = true;
    setCallState('thinking');

    const persona = TEACHER_PERSONAS[config.persona];
    const topic = LESSON_TOPICS.find((t) => t.id === config.topic);

    // Initial welcoming turn: teacher greets student in Persian and introduces the English lesson
    const welcomePrompt =
      initialStarterPrompt ||
      `[شروع جلسه]: زبان‌آموز وارد کلاس آنلاین شده است. به زبان فارسی با لحنی پرانرژی و صمیمی به او سلام و خوش‌آمد بگویید، خودتان را به عنوان ${persona.nameFa} معرفی کنید و بگویید امروز قرار است در زمینه ${topic?.titleFa} با هم مکالمه و تمرین داشته باشیم و یک سوال کوتاه برای شروع بپرسید.`;

    await handleSendTextTurn(welcomePrompt);
  };

  const endCall = () => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setCallState('idle');
    setIsManualRecording(false);
    speechDetectedRef.current = false;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    stopTeacherSpeaking();

    setCurrentSubtitle({
      speaker: 'system',
      text: 'تماس زنده به پایان رسید. جلسه مکالمه صوتی ذخیره شد.',
    });
  };

  // Toggle Mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }

    if (nextMuted) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      setCallState('idle');
    } else {
      if (isCallActiveRef.current && !isBotSpeakingRef.current) {
        setCallState('listening');
        startAudioRecording();
      }
    }
  };

  // Interrupt Teacher
  const handleInterrupt = () => {
    stopTeacherSpeaking();
    if (isCallActiveRef.current && !isMutedRef.current) {
      setCallState('listening');
      startAudioRecording();
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
      initMicrophoneStream();
    }

    const userMsg: ChatTurnMessage = {
      id: `turn_${Date.now()}_u`,
      role: 'user',
      text: msg,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setTranscript((prev) => [...prev, userMsg]);
    setCurrentSubtitle({ speaker: 'student', text: msg });

    handleSendTextTurn(msg);
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
            {activeAiGesture ? (
              <p className="text-[11px] text-amber-300 flex items-center gap-1.5 mt-0.5 animate-fadeIn">
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                <span>ژست: <strong>{activeAiGesture.gestureNameFa}</strong></span>
                <span>·</span>
                <span>میمیک: <strong>{activeAiGesture.emotionNameFa}</strong></span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>{currentTopic.icon} {currentTopic.titleFa.split('(')[0]}</span>
                <span>·</span>
                <span className="font-mono text-emerald-400">{currentVoice.name} ({currentVoice.gender})</span>
              </p>
            )}
          </div>
        </div>

        {/* Server & Settings Actions */}
        <div className="flex items-center gap-1.5">
          {/* Audio Input Indicator */}
          <div
            className="px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 border font-medium bg-slate-800/80 text-slate-300 border-slate-700/60"
            title="ارسال مستقیم صدای میکروفون به هوش مصنوعی"
          >
            <Radio className={`w-3 h-3 ${isCallActive ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span>صدای مستقیم</span>
          </div>

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
                : callState === 'recording'
                ? 'bg-rose-500'
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
                  : callState === 'recording'
                  ? 'border-rose-400 shadow-lg shadow-rose-500/40 animate-pulse scale-105'
                  : callState === 'listening'
                  ? 'border-emerald-400 shadow-lg shadow-emerald-500/30'
                  : callState === 'thinking'
                  ? 'border-purple-400 shadow-lg shadow-purple-500/30 animate-spin'
                  : 'border-slate-800 bg-slate-900/60'
              }`}
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  callState === 'speaking'
                    ? 'bg-gradient-to-tr from-sky-500 to-indigo-600 text-white'
                    : callState === 'recording'
                    ? 'bg-gradient-to-tr from-rose-500 to-amber-500 text-white animate-pulse'
                    : callState === 'listening'
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white'
                    : callState === 'thinking'
                    ? 'bg-gradient-to-tr from-purple-500 to-pink-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {callState === 'speaking' ? (
                  <Volume2 className="w-8 h-8 animate-bounce" />
                ) : callState === 'recording' ? (
                  <Mic className="w-8 h-8 animate-pulse text-white" />
                ) : callState === 'listening' ? (
                  <AudioWaveform className="w-8 h-8 animate-pulse text-white" />
                ) : callState === 'thinking' ? (
                  <Zap className="w-8 h-8 animate-pulse" />
                ) : (
                  <Phone className="w-8 h-8 opacity-40" />
                )}
              </div>
            </div>
          </div>

          {/* Real-time Waveform Bars (Reflects Teacher Speech or Student Voice Input) */}
          <div className="h-6 flex items-center justify-center gap-1 w-full max-w-[220px] mb-2">
            {callState === 'recording' || callState === 'listening' ? (
              // Student mic volume bars
              Array.from({ length: 16 }).map((_, idx) => {
                const barHeight = Math.max(4, studentMicVolume * 24 * (1 + Math.sin(idx + Date.now() / 200)));
                return (
                  <span
                    key={idx}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      callState === 'recording' ? 'bg-rose-400' : 'bg-emerald-400'
                    }`}
                    style={{
                      height: `${barHeight}px`,
                      opacity: studentMicVolume > 0.05 ? 0.9 : 0.3,
                    }}
                  />
                );
              })
            ) : (
              // Teacher speech waveform bars
              waveformBars.map((val, idx) => (
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
              ))
            )}
          </div>

          {/* Call Status Caption & Duration */}
          <div className="flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-200">
              {callState === 'speaking' && '🔊 معلم در حال آموزش صوتی...'}
              {callState === 'recording' && '🎙️ در حال ضبط صدای شما (مستقیم)...'}
              {callState === 'listening' && '👂 آماده شنیدن صحبت شما (انگلیسی یا فارسی)...'}
              {callState === 'thinking' && '🧠 در حال پردازش صوت و تولید پاسخ هوشمند...'}
              {callState === 'idle' && (isCallActive ? 'آماده برای صحبت شما' : 'جلسه آنلاین آماده شروع است')}
            </span>

            {isCallActive && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  ⏱️ {formatTimer(callDuration)}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {micMode === 'auto' ? '· ارسال خودکار با سکوت' : '· ارسال با دکمه'}
                </span>
              </div>
            )}
          </div>

          {/* Instant "Done Speaking & Send" Button when recording in progress */}
          {isCallActive && (callState === 'recording' || isManualRecording) && (
            <button
              onClick={stopAudioRecordingAndSend}
              className="mt-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all animate-bounce"
            >
              <Send className="w-3.5 h-3.5" />
              <span>پایان صحبت و ارسال فوری صدا</span>
            </button>
          )}
        </div>

        {/* Live Subtitles & Learning Card */}
        <div className="mt-3 p-3.5 bg-slate-950/90 border border-slate-800/90 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/60 pb-1.5">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold text-slate-300">
                {currentSubtitle.speaker === 'student' && 'صدای شما (تشخیص مستقیم STT):'}
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

        {/* Quick Topic Prompts (When call is inactive) */}
        {!isCallActive ? (
          <div className="mt-3 flex-1 flex flex-col gap-1.5 overflow-y-auto">
            <span className="text-[11px] text-slate-400 font-medium">موضوعات پیشنهادی برای شروع کلاس:</span>
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
                  <span className="font-semibold">{msg.role === 'user' ? 'صدای شما (دانش‌آموز)' : currentPersona.name}</span>
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
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2.5 shrink-0">
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

        {/* Push-to-Talk / Click to Speak button (Manual mode) */}
        {isCallActive && micMode === 'manual' && (
          <button
            onClick={() => {
              if (isManualRecording) {
                stopAudioRecordingAndSend();
              } else {
                startAudioRecording();
              }
            }}
            className={`py-3 px-3.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all border ${
              isManualRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>{isManualRecording ? 'ارسال صدا' : 'شروع صحبت'}</span>
          </button>
        )}

        {/* Big Central Call Toggle Button */}
        {!isCallActive ? (
          <button
            onClick={() => startCall()}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all scale-100 active:scale-95"
          >
            <Phone className="w-5 h-5 fill-current" />
            <span>شروع تماس زنده صوتی (Start Live Call)</span>
          </button>
        ) : (
          <button
            onClick={endCall}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition-all scale-100 active:scale-95"
          >
            <PhoneOff className="w-5 h-5 fill-current" />
            <span>پایان تماس (End Call)</span>
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
              <h3 className="font-bold text-sm text-white">تنظیمات کلاس، صدا و میکروفون</h3>
            </div>
            <button
              onClick={() => setShowConfigModal(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col gap-4 text-xs">
            {/* 1. Mic Mode (Auto VAD vs Push-to-Talk) */}
            <div>
              <label className="font-semibold text-slate-300 block mb-2">روش تشخیص و ارسال صدای شما:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMicMode('auto')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    micMode === 'auto'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                  }`}
                >
                  <div className="text-xs">خودکار (هوشمند با سکوت)</div>
                  <div className="text-[10px] opacity-75 mt-0.5">به محض اتمام صحبت، صدا ارسال می‌شود</div>
                </button>
                <button
                  onClick={() => setMicMode('manual')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    micMode === 'manual'
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                  }`}
                >
                  <div className="text-xs">دکمه‌ای (Push-to-Talk)</div>
                  <div className="text-[10px] opacity-75 mt-0.5">شروع و پایان ضبط با کلیک شما</div>
                </button>
              </div>
            </div>

            {/* 2. Teacher Persona */}
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

            {/* 3. Official ChatGPT Voice */}
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

            {/* 4. Lesson Topic */}
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

            {/* 5. Student Level */}
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

            {/* 6. Bilingual Help */}
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
