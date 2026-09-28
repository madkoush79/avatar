export interface LiveVoiceItem {
  id: string;
  name: string;
  gender: string;
  description: string;
}

export interface LiveTurnResponse {
  user_text: string;
  reply_text: string;
  message_id?: string;
  conversation_id?: string;
  voice: string;
  audio_base64?: string;
}

export type EnglishLessonTopic =
  | 'daily_chat'
  | 'ielts_speaking'
  | 'job_interview'
  | 'pronunciation_clinic'
  | 'grammar_correction'
  | 'travel_roleplay'
  | 'business_english';

export type EnglishLevel = 'beginner' | 'intermediate' | 'advanced';

export type TeacherPersona = 'sarah' | 'david' | 'emma';

export interface TeacherConfig {
  persona: TeacherPersona;
  topic: EnglishLessonTopic;
  level: EnglishLevel;
  voice: string;
  bilingualHelp: boolean;
}

export const OFFICIAL_VOICES: LiveVoiceItem[] = [
  { id: 'sky', name: 'Sky', gender: 'Female', description: 'Warm, expressive, articulate female voice (Ideal for teacher)' },
  { id: 'cove', name: 'Cove', gender: 'Male', description: 'Calm, thoughtful, natural male voice (Default ChatGPT)' },
  { id: 'breeze', name: 'Breeze', gender: 'Female', description: 'Energetic, warm, and animated female voice' },
  { id: 'juniper', name: 'Juniper', gender: 'Female', description: 'Vibrant, upbeat, and modern female voice' },
  { id: 'ember', name: 'Ember', gender: 'Male', description: 'Approachable, relaxed, and confident male voice' },
  { id: 'sol', name: 'Sol', gender: 'Male', description: 'Dynamic, smart, and highly motivating male voice' },
  { id: 'vale', name: 'Vale', gender: 'Female', description: 'Gentle, academic, crystal-clear female voice' },
  { id: 'maple', name: 'Maple', gender: 'Female', description: 'Friendly, sweet, and comforting female voice' },
  { id: 'spruce', name: 'Spruce', gender: 'Male', description: 'Mature, steady, and professorial male voice' },
  { id: 'arbor', name: 'Arbor', gender: 'Male', description: 'Wise, thoughtful, and mentoring male voice' },
];

export const LESSON_TOPICS = [
  {
    id: 'daily_chat' as EnglishLessonTopic,
    titleFa: 'مکالمه آزاد و روزمره (Daily Chat)',
    titleEn: 'Daily Conversation & Small Talk',
    icon: '💬',
    starterPrompt: 'سلام استاد! من می‌خواهم مکالمه احوالپرسی و روزمره انگلیسی را با شما تمرین کنم.',
    instructions: 'آموزش احوالپرسی، مکالمات روزمره و اصطلاحات کاربردی با توضیحات فارسی و جملات انگلیسی.',
  },
  {
    id: 'ielts_speaking' as EnglishLessonTopic,
    titleFa: 'شبیه‌ساز آزمون آیلتس (IELTS Speaking)',
    titleEn: 'IELTS Speaking Practice',
    icon: '🎓',
    starterPrompt: 'سلام استاد! من برای آزمون اسپیکینگ آیلتس آماده می‌شوم، بیایید با هم تمرین کنیم.',
    instructions: 'شبیه‌سازی سوالات پارت ۱ تا ۳ آیلتس، ارائه اصطلاحات نمره بالا و فیدبک آموزشی به زبان فارسی.',
  },
  {
    id: 'job_interview' as EnglishLessonTopic,
    titleFa: 'آمادگی مصاحبه کاری (Job Interview)',
    titleEn: 'Professional Job Interview',
    icon: '💼',
    starterPrompt: 'سلام استاد! می‌خواهم برای یک مصاحبه کاری به زبان انگلیسی آماده شوم.',
    instructions: 'پرسیدن سوالات متداول مصاحبه کاری، آموزش جواب‌های حرفه‌ای انگلیسی با راهنمای فارسی.',
  },
  {
    id: 'pronunciation_clinic' as EnglishLessonTopic,
    titleFa: 'کارگاه تلفظ و لهجه (Pronunciation Clinic)',
    titleEn: 'Pronunciation & Accent Clinic',
    icon: '🗣️',
    starterPrompt: 'سلام استاد! می‌خواهم تلفظ صحیح و لهجه انگلیسی‌ام را با کمک شما تقویت کنم.',
    instructions: 'تمرکز روی استرس کلمات، فونتیک، تفاوت صداها و تمرین کلمات چالش‌برانگیز انگلیسی.',
  },
  {
    id: 'grammar_correction' as EnglishLessonTopic,
    titleFa: 'تصحیح گرامر و ساختار (Grammar Clinic)',
    titleEn: 'Grammar & Accuracy Clinic',
    icon: '✍️',
    starterPrompt: 'سلام استاد! لطفاً به جملات انگلیسی من گوش بدهید و ساختار گرامری‌ام را تصحیح کنید.',
    instructions: 'اصلاح مهربانانه خطاهای گرامری، توضیح قاعده به فارسی و ارائه ساختار صحیح انگلیسی.',
  },
  {
    id: 'travel_roleplay' as EnglishLessonTopic,
    titleFa: 'نقش‌آفرینی سفر و فرودگاه (Travel Roleplay)',
    titleEn: 'Travel, Airport & Hotel Roleplay',
    icon: '✈️',
    starterPrompt: 'سلام استاد! بیایید مکالمه فرودگاه، هتل و کافه به زبان انگلیسی را نقش‌آفرینی کنیم.',
    instructions: 'سناریوهای واقعی سفر، عبارات کاربردی فرودگاه، سفارش در رستوران و درخواست راهنمایی.',
  },
  {
    id: 'business_english' as EnglishLessonTopic,
    titleFa: 'انگلیسی تجاری و جلسات (Business English)',
    titleEn: 'Business & Negotiation English',
    icon: '📊',
    starterPrompt: 'سلام استاد! من می‌خواهم اصطلاحات و جملات انگلیسی رسمی برای جلسات کاری را یاد بگیرم.',
    instructions: 'اصطلاحات ایمیل‌نگاری و مذاکره تجاری، جملات رسمی کاری با توضیحات کامل به فارسی.',
  },
];

export const LEVEL_SETTINGS: Record<EnglishLevel, { labelFa: string; promptGuide: string }> = {
  beginner: {
    labelFa: 'مبتدی (A1 - A2)',
    promptGuide: 'The student is a beginner. Speak clearly, using simple sentences and basic vocabulary. If helpful, you may include a brief Persian translation for difficult keywords.',
  },
  intermediate: {
    labelFa: 'متوسط (B1 - B2)',
    promptGuide: 'The student is intermediate. Use natural conversational English, introduce interesting idioms, and encourage full-sentence answers.',
  },
  advanced: {
    labelFa: 'پیشرفته (C1 - C2)',
    promptGuide: 'The student is advanced. Speak at native pace with rich vocabulary, nuanced phrasing, and in-depth discussions.',
  },
};

export const TEACHER_PERSONAS: Record<TeacherPersona, { name: string; nameFa: string; defaultVoice: string; descFa: string }> = {
  sarah: {
    name: 'Teacher Sarah',
    nameFa: 'استاد سارا',
    defaultVoice: 'sky',
    descFa: 'معلم صمیمی، پرانرژی و مشوق — عالی برای مکالمه روزمره و افزایش اعتمادبه‌نفس',
  },
  david: {
    name: 'Professor David',
    nameFa: 'پروفسور دیوید',
    defaultVoice: 'cove',
    descFa: 'استاد آکادمیک و باتجربه — ایده‌آل برای آزمون آیلتس، انگلیسی تجاری و ساختار زبان',
  },
  emma: {
    name: 'Teacher Emma',
    nameFa: 'استاد اِما',
    defaultVoice: 'breeze',
    descFa: 'معلم خلاق و خوش‌بیان — متخصص کلینیک تلفظ، اصطلاحات خیابانی و رول‌پلی‌های سفر',
  },
};

const DEFAULT_API_BASE = 'http://127.0.0.1:8001';

/**
 * Builds the English Teacher system instructions for ChatGPT Live
 */
export function buildEnglishTeacherPrompt(
  studentUtterance: string,
  config: TeacherConfig,
  conversationHistory: { role: 'user' | 'assistant'; text: string }[] = []
): string {
  const persona = TEACHER_PERSONAS[config.persona] || TEACHER_PERSONAS.sarah;
  const topicInfo = LESSON_TOPICS.find((t) => t.id === config.topic) || LESSON_TOPICS[0];
  const levelInfo = LEVEL_SETTINGS[config.level] || LEVEL_SETTINGS.intermediate;

  // Build compact recent history context
  const recentTurns = conversationHistory.slice(-4);
  let historySection = '';
  if (recentTurns.length > 0) {
    historySection = `تاریخچه مکالمه اخیر:\n${recentTurns
      .map((t) => (t.role === 'user' ? `زبان‌آموز: ${t.text}` : `استاد: ${t.text}`))
      .join('\n')}\n`;
  }

  return `[دستورالعمل سیستم: شما ${persona.nameFa} (${persona.name}) هستید؛ یک استاد بسیار مهربان، خوش‌بیان، حرفه‌ای و باانگیزه زبان انگلیسی برای زبان‌آموزان فارسی‌زبان.

قوانین بسیار مهم مکالمه صوتی:
۱. زبان پایه شما فارسی است: تمام احوالپرسی‌ها، توضیحات، تشویق‌ها و قواعد را با لحنی گرم، صمیمی و دوستانه به زبان فارسی بیان کنید.
۲. آموزش زبان انگلیسی: کلمات، اصطلاحات، جملات کاربردی و تلفظ‌های موردنظر را به زبان انگلیسی آموزش دهید، معنی آن‌ها را به فارسی بگویید و نکات تلفظ یا کاربردشان را توضیح دهید.
۳. دعوت به تکرار و تعامل: در پایان هر نوبت، از زبان‌آموز بخواهید عبارت انگلیسی را با شما تکرار کند یا به یک سوال ساده انگلیسی پاسخ دهد تا مهارت گفتاری‌اش تقویت شود.
۴. اصلاح مهربانانه: اگر زبان‌آموز اشتباه گرامری یا تلفظی داشت، با تشویق و به فارسی شکل درست آن را بگویید.
۵. خلاصه و مخصوص صوت: پاسخ‌ها حداکثر ۲ تا ۳ جمله کوتاه، روان و بدون بولت‌پوینت یا علائم نگارشی پیچیده باشند تا به صورت صوتی به گوش زبان‌آموز خوش بنشیند.]

موضوع کلاس: ${topicInfo.titleFa} (${topicInfo.instructions})
سطح زبان‌آموز: ${levelInfo.labelFa}

${historySection}زبان‌آموز: ${studentUtterance}`;
}

export interface AiGestureEmotion {
  gesture: string;
  gestureNameFa: string;
  figureId: string;
  emotion: string;
  emotionNameFa: string;
  facialExpression: {
    mouthSmile: number;
    browInnerUp: number;
  };
  cleanedText: string;
}

const GESTURE_MAP: Record<string, { figureId: string; nameFa: string }> = {
  greeting: { figureId: 'namaste', nameFa: 'درود و خوش‌آمدگویی' },
  welcome: { figureId: 'namaste', nameFa: 'خوش‌آمدگویی' },
  namaste: { figureId: 'namaste', nameFa: 'درود و احترام' },
  thinking: { figureId: 'thinking', nameFa: 'تفکر و تحلیل' },
  pondering: { figureId: 'thinking', nameFa: 'تفکر عمیق' },
  explaining: { figureId: 'straight', nameFa: 'توضیح و ارائه رسمی' },
  presentation: { figureId: 'straight', nameFa: 'پرزنت و تدریس' },
  formal: { figureId: 'straight', nameFa: 'ایستاده رسمی' },
  crossed_arms: { figureId: 'crossed_arms', nameFa: 'دست به سینه و توجه' },
  confident: { figureId: 'crossed_arms', nameFa: 'بااعتمادبه‌نفس' },
  encouraging: { figureId: 'bend', nameFa: 'صمیمی و تشویق‌کننده' },
  engaging: { figureId: 'bend', nameFa: 'مکالمه رو در رو' },
  celebrating: { figureId: 'victory', nameFa: 'جشن شادی و آفرین!' },
  victory: { figureId: 'victory', nameFa: 'پیروزی و تحسین' },
  great_job: { figureId: 'victory', nameFa: 'آفرین و عالی بود!' },
  relaxed: { figureId: 'side', nameFa: 'کژوال و دوستانه' },
  casual: { figureId: 'side', nameFa: 'راحت و صمیمی' },
  stylish: { figureId: 'hip', nameFa: 'دست به کمر و پرانرژی' },
};

const EMOTION_MAP: Record<string, { nameFa: string; expr: { mouthSmile: number; browInnerUp: number } }> = {
  smile: { nameFa: 'لبخند گرم', expr: { mouthSmile: 0.65, browInnerUp: 0.15 } },
  happy: { nameFa: 'شادی و نشاط', expr: { mouthSmile: 0.85, browInnerUp: 0.25 } },
  curious: { nameFa: 'کنجکاو و پرسشگر', expr: { mouthSmile: 0.2, browInnerUp: 0.6 } },
  proud: { nameFa: 'تحسین و افتخار', expr: { mouthSmile: 0.75, browInnerUp: 0.1 } },
  excited: { nameFa: 'هیجان‌زده و شاداب', expr: { mouthSmile: 0.7, browInnerUp: 0.55 } },
  calm: { nameFa: 'آرام و دقیق', expr: { mouthSmile: 0.1, browInnerUp: 0.0 } },
};

/**
 * Parses [GESTURE: ...] and [EMOTION: ...] tags from the AI response,
 * maps them to 3D avatar figures and facial blendshapes, and strips tags for speech.
 */
export function parseAiGestureAndEmotion(rawResponse: string): AiGestureEmotion {
  let gestureKey = 'explaining';
  let emotionKey = 'smile';
  let cleaned = rawResponse;

  const gestureMatch = rawResponse.match(/\[GESTURE:\s*([a-zA-Z_]+)\]/i);
  const emotionMatch = rawResponse.match(/\[EMOTION:\s*([a-zA-Z_]+)\]/i);

  if (gestureMatch) {
    gestureKey = gestureMatch[1].toLowerCase();
    cleaned = cleaned.replace(gestureMatch[0], '');
  }
  if (emotionMatch) {
    emotionKey = emotionMatch[1].toLowerCase();
    cleaned = cleaned.replace(emotionMatch[0], '');
  }

  // Remove any stray empty brackets
  cleaned = cleaned.replace(/\[\s*\]/g, '').trim();

  const gestureInfo = GESTURE_MAP[gestureKey] || GESTURE_MAP.explaining;
  const emotionInfo = EMOTION_MAP[emotionKey] || EMOTION_MAP.smile;

  return {
    gesture: gestureKey,
    gestureNameFa: gestureInfo.nameFa,
    figureId: gestureInfo.figureId,
    emotion: emotionKey,
    emotionNameFa: emotionInfo.nameFa,
    facialExpression: emotionInfo.expr,
    cleanedText: cleaned,
  };
}

/**
 * Check if the local WebChatGPT Live API is reachable
 */
export async function checkLiveApiStatus(baseUrl: string = DEFAULT_API_BASE): Promise<{
  online: boolean;
  userEmail?: string;
  userName?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${baseUrl}/account`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        online: true,
        userEmail: data.email,
        userName: data.name,
      };
    }
    return { online: false, error: `HTTP ${res.status}` };
  } catch (err) {
    return {
      online: false,
      error: err instanceof Error ? err.message : 'سرور در دسترس نیست',
    };
  }
}

/**
 * Fetch official OpenAI voices from the live backend
 */
export async function fetchLiveVoices(baseUrl: string = DEFAULT_API_BASE): Promise<LiveVoiceItem[]> {
  try {
    const res = await fetch(`${baseUrl}/chatgpt/voices`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch remote voices, using built-in list:', e);
  }
  return OFFICIAL_VOICES;
}

/**
 * Send one live turn to /chatgpt/live_turn
 */
export async function sendLiveTurn(
  prompt: string,
  voice: string,
  baseUrl: string = DEFAULT_API_BASE,
  signal?: AbortSignal
): Promise<LiveTurnResponse> {
  const url = `${baseUrl}/chatgpt/live_turn`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      prompt,
      voice,
    }),
    signal,
  });

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const data: LiveTurnResponse = await res.json();
  return data;
}
