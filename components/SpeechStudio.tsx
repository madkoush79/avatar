'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FacialExpression } from '@/lib/types';
import { LipsyncFa, OculusViseme } from '@/lib/lipsync-fa';
import { persianSpeechSynth } from '@/lib/speech-synth-fa';
import { MicAudioLipSync } from '@/lib/speech-sync';
import { streamOllamaChat } from '@/lib/ollama-client';
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Send, 
  Sparkles, 
  Sliders, 
  MessageSquare,
  Activity,
  Layers,
  Radio,
  Play,
  Loader2
} from 'lucide-react';

interface SpeechStudioProps {
  onUpdateVisemes: (morphs: Partial<FacialExpression>) => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
}

const PERSIAN_PRESETS = [
  {
    titleFa: 'متن تست اصلی: لب‌خوانی با صدا',
    text: 'سلام! لب‌خوانی زبان فارسی با دقت عالی در این استودیو کار می‌کند.',
  },
  {
    titleFa: 'معرفی فارسی کاراکتر',
    text: 'سلام! من کاراکتر سه بعدی پروژه هستم. لب خوانی زبان فارسی با دقت کامل فعال است.',
  },
  {
    titleFa: 'تست واج‌های بسته (ب، پ، م)',
    text: 'بهترین پرزنتر با پوشش و مدل‌های متنوع در این استودیو آماده بررسی است.',
  },
  {
    titleFa: 'تست واکه‌های گرد (او، اُ، آ)',
    text: 'امروز با هم فیگورهای جذاب و استایل‌های نوین را تماشا می‌کنیم.',
  },
];

const ZERO_VISEMES: Partial<FacialExpression> = {
  viseme_aa: 0,
  viseme_PP: 0,
  viseme_U: 0,
  viseme_O: 0,
  viseme_E: 0,
  viseme_I: 0,
  viseme_FF: 0,
  viseme_SS: 0,
  viseme_CH: 0,
  viseme_kk: 0,
  viseme_DD: 0,
  viseme_nn: 0,
  viseme_RR: 0,
  viseme_sil: 0,
  mouthOpen: 0,
  jawOpen: 0,
};

const QUICK_VISEME_TESTS: {
  labelFa: string;
  phoneme: string;
  viseme: OculusViseme;
  descriptionFa: string;
  morphs: Partial<FacialExpression>;
}[] = [
  {
    labelFa: 'آ / ا',
    phoneme: 'â / a',
    viseme: 'aa',
    descriptionFa: 'دهان و فک کاملاً باز و طبیعی',
    morphs: { ...ZERO_VISEMES, viseme_aa: 0.9 },
  },
  {
    labelFa: 'ب / پ / م',
    phoneme: 'b / p / m',
    viseme: 'PP',
    descriptionFa: 'دو لب کاملاً بسته و فشرده (Bilabial)',
    morphs: { ...ZERO_VISEMES, viseme_PP: 1.0 },
  },
  {
    labelFa: 'او',
    phoneme: 'u (boot)',
    viseme: 'U',
    descriptionFa: 'لب‌ها کاملاً گرد و غنچه‌ای',
    morphs: { ...ZERO_VISEMES, viseme_U: 0.95 },
  },
  {
    labelFa: 'اُ',
    phoneme: 'o (open)',
    viseme: 'O',
    descriptionFa: 'لب‌ها گرد با دهان نیمه‌باز',
    morphs: { ...ZERO_VISEMES, viseme_O: 0.85 },
  },
  {
    labelFa: 'ف / و',
    phoneme: 'f / v',
    viseme: 'FF',
    descriptionFa: 'دندان بالا روی لب پایین',
    morphs: { ...ZERO_VISEMES, viseme_FF: 0.9 },
  },
  {
    labelFa: 'س / ز / ص',
    phoneme: 's / z',
    viseme: 'SS',
    descriptionFa: 'دندان‌ها نزدیک، لب کشیده',
    morphs: { ...ZERO_VISEMES, viseme_SS: 0.85 },
  },
  {
    labelFa: 'ش / ژ / چ',
    phoneme: 'sh / zh / ch',
    viseme: 'CH',
    descriptionFa: 'لب‌ها کمی جلو، خروج هوا',
    morphs: { ...ZERO_VISEMES, viseme_CH: 0.85 },
  },
  {
    labelFa: 'ای / اِ',
    phoneme: 'i / e',
    viseme: 'I',
    descriptionFa: 'لب‌ها کشیده به طرفین',
    morphs: { ...ZERO_VISEMES, viseme_I: 0.85 },
  },
  {
    labelFa: 'ک / گ / خ',
    phoneme: 'k / g / kh',
    viseme: 'kk',
    descriptionFa: 'پشت زبان بالا، فک نیمه‌باز',
    morphs: { ...ZERO_VISEMES, viseme_kk: 0.85 },
  },
];

export function SpeechStudio({
  onUpdateVisemes,
  isSpeaking,
  setIsSpeaking,
}: SpeechStudioProps) {
  const [customText, setCustomText] = useState<string>('سلام! لب‌خوانی زبان فارسی با دقت عالی در این استودیو کار می‌کند.');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [speechPitch, setSpeechPitch] = useState<number>(1.0);
  const [intensityExaggeration, setIntensityExaggeration] = useState<number>(1.0);
  const [useVoiceAudio, setUseVoiceAudio] = useState<boolean>(true);
  const [micActive, setMicActive] = useState<boolean>(false);
  const [speechEngineMode, setSpeechEngineMode] = useState<'neural' | 'browser'>('neural');
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);

  // Live Viseme Monitor state
  const [activePhoneme, setActivePhoneme] = useState<{
    char: string;
    word: string;
    viseme: OculusViseme;
  }>({
    char: '',
    word: '',
    viseme: 'sil',
  });

  const micSyncRef = useRef<MicAudioLipSync | null>(null);
  const speechSessionRef = useRef<{ stop: () => void } | null>(null);

  const handleGenerateAIText = async () => {
    setIsGeneratingAI(true);
    let generated = '';
    const prompts = [
      'یک جمله کوتاه، جذاب و شیوا به زبان فارسی برای تست لب‌خوانی و انیمیشن چهره کاراکتر سه بعدی بنویس (فقط یک یا دو جمله بدون توضیحات اضافه).',
      'یک پیام خوش‌آمدگویی یا دیالوگ صمیمی فارسی بنویس (فقط متن جمله).',
      'یک جمله روان فارسی با ترکیب حروف مختلف و واژه‌های صدادار برای تست دقیق لب‌خوانی بگو (فقط متن جمله).'
    ];
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    await streamOllamaChat({
      messages: [{ role: 'user', content: randomPrompt }],
      systemPrompt: 'شما نادیا هستید. فقط متن کوتاه جمله فارسی درخواستی را بدون هیچ کلمه اضافی یا علامت نقل قول خروجی بده.',
      temperature: 0.8,
      onChunk: (chunk, acc) => {
        generated = acc;
        setCustomText(acc.replace(/^["'«]+|["'»]+$/g, '').trim());
      },
      onDone: (full) => {
        setCustomText(full.replace(/^["'«]+|["'»]+$/g, '').trim());
        setIsGeneratingAI(false);
      },
      onError: (err) => {
        console.warn('Ollama generation error in SpeechStudio:', err);
        setIsGeneratingAI(false);
      }
    });
  };

  // Stop talking when unmounting
  useEffect(() => {
    return () => {
      speechSessionRef.current?.stop();
      micSyncRef.current?.stop();
    };
  }, []);

  const handleSpeakPersian = (textToSpeak: string) => {
    if (!textToSpeak.trim()) return;

    if (micActive) {
      micSyncRef.current?.stop();
      setMicActive(false);
    }

    if (isSpeaking) {
      handleStop();
      return;
    }

    setIsSpeaking(true);

    const computedRateStr = Math.abs(speechRate - 1.0) < 0.05 ? '-10%' : `${Math.round((speechRate - 1.0) * 100) >= 0 ? '+' : ''}${Math.round((speechRate - 1.0) * 100)}%`;
    const computedPitchStr = Math.abs(speechPitch - 1.0) < 0.05 ? '+10Hz' : `${Math.round((speechPitch - 1.0) * 50) >= 0 ? '+' : ''}${Math.round((speechPitch - 1.0) * 50)}Hz`;

    const session = persianSpeechSynth.speak(
      textToSpeak,
      {
        rate: speechRate,
        pitch: speechPitch,
        rateStr: computedRateStr,
        pitchStr: computedPitchStr,
        voice: selectedVoice,
        exaggeration: intensityExaggeration,
        enableAudio: useVoiceAudio,
        useBrowserTTSIfAvailable: true,
      },
      {
        onStart: () => setIsSpeaking(true),
        onFallbackNotice: (mode) => setSpeechEngineMode(mode),
        onEnd: () => {
          setIsSpeaking(false);
          setActivePhoneme({ char: '', word: '', viseme: 'sil' });
          resetVisemes();
        },
        onVisemeUpdate: (morphs, activeViseme, char, word, metrics) => {
          setActivePhoneme({ char, word, viseme: activeViseme });
          onUpdateVisemes({
            ...(morphs as Partial<FacialExpression>),
            speechVolume: metrics?.volume ?? 0,
            isSpeechPaused: metrics?.isSilent ?? (activeViseme === 'sil'),
          });
        },
      }
    );

    speechSessionRef.current = session;
  };

  const handleStop = () => {
    speechSessionRef.current?.stop();
    setIsSpeaking(false);
    setActivePhoneme({ char: '', word: '', viseme: 'sil' });
    resetVisemes();
  };

  const resetVisemes = () => {
    onUpdateVisemes({
      viseme_sil: 1,
      viseme_aa: 0,
      viseme_O: 0,
      viseme_E: 0,
      viseme_I: 0,
      viseme_U: 0,
      viseme_PP: 0,
      viseme_FF: 0,
      viseme_TH: 0,
      viseme_DD: 0,
      viseme_kk: 0,
      viseme_CH: 0,
      viseme_SS: 0,
      viseme_nn: 0,
      viseme_RR: 0,
      mouthOpen: 0,
      jawOpen: 0,
      speechVolume: 0,
      isSpeechPaused: true,
    });
  };

  // Quick manual tester for specific Persian phonemes
  const handleTestPhoneme = (test: typeof QUICK_VISEME_TESTS[0]) => {
    handleStop();
    setActivePhoneme({ char: test.labelFa, word: test.descriptionFa, viseme: test.viseme });

    // If audio is enabled, also vocalize the test phoneme so the user hears it clearly!
    if (useVoiceAudio) {
      persianSpeechSynth.speak(
        test.labelFa,
        {
          rate: 0.5,
          pitch: speechPitch,
          rateStr: '-10%',
          pitchStr: '+10Hz',
          voice: selectedVoice,
          exaggeration: intensityExaggeration,
          enableAudio: true,
          useBrowserTTSIfAvailable: false,
        },
        {
          onVisemeUpdate: () => {},
          onEnd: () => {},
        }
      );
    }

    // For bilabial 'ب / پ / م', perform an authentic articulatory sequence:
    // 1. Firm bilabial closure (PP: 1.0)
    // 2. Audible and visual plosive release
    // 3. Smooth return to rest
    if (test.viseme === 'PP') {
      onUpdateVisemes(test.morphs);
      setTimeout(() => {
        // Natural release: slight mouth parting
        onUpdateVisemes({ ...ZERO_VISEMES, viseme_PP: 0, viseme_aa: 0.25 });
        setTimeout(() => {
          resetVisemes();
          setActivePhoneme({ char: '', word: '', viseme: 'sil' });
        }, 350);
      }, 550);
      return;
    }

    onUpdateVisemes(test.morphs);

    // Auto-release after 1.5 seconds back to rest
    setTimeout(() => {
      resetVisemes();
      setActivePhoneme({ char: '', word: '', viseme: 'sil' });
    }, 1500);
  };

  const toggleMic = async () => {
    if (micActive) {
      micSyncRef.current?.stop();
      setMicActive(false);
      setIsSpeaking(false);
      resetVisemes();
      return;
    }

    handleStop();
    const mic = new MicAudioLipSync();
    const ok = await mic.start((vol) => {
      const active = vol > 0.08;
      setIsSpeaking(active);
      if (active) {
        // Natural speech frequency split
        const openAmt = Math.min(1.0, vol * 1.4 * intensityExaggeration);
        onUpdateVisemes({
          viseme_aa: openAmt,
          mouthOpen: openAmt * 0.9,
          jawOpen: openAmt * 0.8,
          viseme_PP: 0,
          speechVolume: vol,
          isSpeechPaused: false,
        });
        setActivePhoneme({ char: 'صدا', word: 'میکروفون زنده', viseme: 'aa' });
      } else {
        resetVisemes();
        setActivePhoneme({ char: 'مکث', word: 'سکوت صدا', viseme: 'sil' });
      }
    });

    if (ok) {
      micSyncRef.current = mic;
      setMicActive(true);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Header & Mode Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Volume2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>موتور لب‌خوانی فارسی (Persian Lip-Sync)</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-mono">
                Oculus ARKit
              </span>
            </h3>
          </div>
        </div>

        {/* Microphone Toggle */}
        <button
          onClick={toggleMic}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all shadow-sm ${
            micActive
              ? 'bg-rose-500 text-white border-rose-400 shadow-rose-500/30 animate-pulse'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800'
          }`}
          title="فعال‌سازی لب‌خوانی با صدای میکروفون شما"
        >
          {micActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-400" />}
          <span>{micActive ? 'قطع میکروفون' : 'میکروفون زنده'}</span>
        </button>
      </div>

      {/* Live Viseme & Phoneme Inspector Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${
            isSpeaking 
              ? 'bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/20' 
              : 'bg-slate-800 text-slate-400'
          }`}>
            {activePhoneme.char || '—'}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-200">
                {activePhoneme.word ? `کلمه: ${activePhoneme.word}` : 'در انتظار گفتار...'}
              </span>
              {isSpeaking && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              شکل لب: <strong className="text-sky-400">{activePhoneme.viseme}</strong> ({
                activePhoneme.viseme === 'PP' ? 'بسته بودن دو لب' :
                activePhoneme.viseme === 'aa' ? 'دهان کاملاً باز' :
                activePhoneme.viseme === 'FF' ? 'دندان روی لب' :
                activePhoneme.viseme === 'SS' ? 'دندان‌های نزدیک' :
                activePhoneme.viseme === 'CH' ? 'لب جلو' :
                activePhoneme.viseme === 'U' || activePhoneme.viseme === 'O' ? 'لب گرد' :
                activePhoneme.viseme === 'E' || activePhoneme.viseme === 'I' ? 'لب کشیده' :
                activePhoneme.viseme === 'kk' ? 'پشت زبان' :
                activePhoneme.viseme === 'DD' ? 'نوک زبان' : 'حالت استراحت'
              })
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-sky-300 text-[11px] rounded px-2 py-1 focus:outline-none focus:border-sky-500 cursor-pointer"
            title="انتخاب گوینده هوش مصنوعی فارسی"
          >
            <option value="Kore">جمینای Kore (زن/پیش‌فرض)</option>
            <option value="Puck">جمینای Puck (مردانه)</option>
            <option value="Fenrir">جمینای Fenrir (بم)</option>
            <option value="Charon">جمینای Charon (آرام)</option>
            <option value="fa-IR-DilaraNeural">صوت زن دیلارا (Edge)</option>
            <option value="fa-IR-FaridNeural">صوت مرد فرید (Edge)</option>
          </select>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700/60 bg-slate-800/80 text-sky-400">
            {speechEngineMode === 'neural' ? 'Neural TTS' : 'سیستم'}
          </span>
          <button
            onClick={() => setUseVoiceAudio(!useVoiceAudio)}
            className={`px-2 py-1 rounded-md text-[11px] border font-medium transition-colors ${
              useVoiceAudio
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="پخش یا قطع صدای گفتار هنگام لب‌خوانی"
          >
            {useVoiceAudio ? 'صدا روشن' : 'بی‌صدا (فقط لب)'}
          </button>
        </div>
      </div>

      {/* Preset Phrases */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-slate-400 font-medium">جملات تست لب‌خوانی فارسی:</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {PERSIAN_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCustomText(preset.text);
                handleSpeakPersian(preset.text);
              }}
              className="text-right p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800 hover:border-slate-700 text-xs text-slate-300 transition-colors flex items-center justify-between group"
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{preset.titleFa}</span>
              </div>
              <Play className="w-3 h-3 text-slate-500 group-hover:text-emerald-400 shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Custom Text Area */}
      <div className="flex flex-col gap-1.5 mt-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">متن فارسی دلخواه را تایپ کنید:</span>
          <button
            type="button"
            onClick={handleGenerateAIText}
            disabled={isGeneratingAI}
            className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 px-2 py-0.5 rounded-lg transition-all"
          >
            {isGeneratingAI ? (
              <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
            ) : (
              <Sparkles className="w-3 h-3 text-amber-400" />
            )}
            <span>{isGeneratingAI ? 'در حال نگارش با نادیا...' : 'تولید متن با نادیا (Ollama)'}</span>
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            dir="rtl"
            placeholder="مثلاً: سلام به همه! چهره و حرکت لب‌های من را بررسی کنید..."
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSpeakPersian(customText);
            }}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 shadow-inner"
          />

          {isSpeaking ? (
            <button
              onClick={handleStop}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-rose-600/20"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>توقف</span>
            </button>
          ) : (
            <button
              onClick={() => handleSpeakPersian(customText)}
              disabled={!customText.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 hover:from-sky-300 hover:to-emerald-300 disabled:opacity-40 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-sky-500/20 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>پخش صدا و لب‌خوانی</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Persian Phoneme Manual Test Buttons */}
      <div className="flex flex-col gap-1.5 mt-1 bg-slate-900/50 border border-slate-800/80 rounded-xl p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تست فوری شکل دهان برای واج‌های فارسی:</span>
          </span>
          <span className="text-[10px] text-slate-500">کلیک برای مشاهده فرم لب</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {QUICK_VISEME_TESTS.map((test, idx) => (
            <button
              key={idx}
              onClick={() => handleTestPhoneme(test)}
              className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500 hover:bg-sky-950/30 text-center transition-all group flex flex-col items-center gap-0.5"
            >
              <span className="text-xs font-bold text-slate-200 group-hover:text-sky-300">{test.labelFa}</span>
              <span className="text-[9px] text-slate-500 font-mono">{test.viseme}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Speed & Exaggeration Controls */}
      <div className="grid grid-cols-2 gap-2 bg-slate-900/60 border border-slate-800/80 rounded-xl p-2.5 text-xs text-slate-300">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>سرعت گفتار:</span>
            <span className="font-mono">{speechRate}x</span>
          </div>
          <input
            type="range"
            min="0.4"
            max="1.5"
            step="0.05"
            value={speechRate}
            onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
            className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>شدت باز شدن لب‌ها:</span>
            <span className="font-mono">{intensityExaggeration}x</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="1.8"
            step="0.1"
            value={intensityExaggeration}
            onChange={(e) => setIntensityExaggeration(parseFloat(e.target.value))}
            className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
