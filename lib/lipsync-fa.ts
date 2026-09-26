// Persian Lip-Sync & Phonetic Processor for 3D Humanoid Avatars
// Implements Oculus LipSync Visemes for the Persian language (فارسی)

export type OculusViseme = 
  | 'sil'
  | 'PP' // ب, پ, م (bilabial)
  | 'FF' // ف, و (labiodental)
  | 'TH' // ث
  | 'DD' // ت, ط, د, ض, ظ
  | 'kk' // ک, گ, خ, ق, غ, ح
  | 'CH' // ج, چ, ش, ژ
  | 'SS' // س, ص, ز, ذ
  | 'nn' // ن, ل
  | 'RR' // ر
  | 'aa' // آ, ا, َ
  | 'E'  // اِ, ِ
  | 'I'  // ای, ی
  | 'O'  // اُ, ُ
  | 'U'; // او, و

export interface VisemeFrame {
  char: string;
  word: string;
  viseme: OculusViseme;
  time: number; // in seconds
  duration: number; // in seconds
  intensity: number; // 0 to 1
  mouthOpen: number; // 0 to 1
  jawOpen: number; // 0 to 1
}

export interface PersianLipsyncResult {
  frames: VisemeFrame[];
  totalDuration: number;
  words: { word: string; startTime: number; endTime: number }[];
}

// Persian alphabet to Oculus Viseme mapping
const PERSIAN_CHAR_TO_VISEME: Record<string, OculusViseme> = {
  // Vowels
  'ا': 'aa',
  'آ': 'aa',
  'أ': 'aa',
  'إ': 'E',
  'َ': 'aa', // Fat-ha
  'ِ': 'E',  // Kasra
  'ُ': 'O',  // Damma
  'ی': 'I',
  'ي': 'I',
  'ئ': 'DD',
  'ء': 'DD',
  'و': 'O',
  'ؤ': 'O',

  // Bilabials (Closing lips tightly)
  'ب': 'PP',
  'پ': 'PP',
  'م': 'PP',

  // Labiodentals (Upper teeth on lower lip)
  'ف': 'FF',

  // Alveolar stops & dentals
  'ت': 'DD',
  'ط': 'DD',
  'د': 'DD',

  // Alveolar fricatives
  'س': 'SS',
  'ص': 'SS',
  'ث': 'SS',
  'ز': 'SS',
  'ض': 'SS',
  'ظ': 'SS',
  'ذ': 'SS',

  // Postalveolars & affricates
  'ش': 'CH',
  'ژ': 'CH',
  'ج': 'CH',
  'چ': 'CH',

  // Velars & Uvulars
  'ک': 'kk',
  'گ': 'kk',
  'خ': 'kk',
  'ق': 'kk',
  'غ': 'kk',
  'ح': 'kk',

  // Liquids & Nasals
  'ر': 'RR',
  'ل': 'nn',
  'ن': 'nn',

  // Glottals & aspirates
  'ه': 'aa',
  'ة': 'DD',

  // Silence
  ' ': 'sil',
  '‌': 'sil', // Half-space (ZWNJ)
  '،': 'sil',
  '.': 'sil',
  '!': 'sil',
  '؟': 'sil',
  '?': 'sil',
  ':': 'sil',
  '؛': 'sil',
  '-': 'sil',
};

// Relative duration for each viseme (in seconds at rate 1.0)
const VISEME_DURATIONS: Record<OculusViseme, number> = {
  'aa': 0.15,
  'O': 0.14,
  'U': 0.14,
  'E': 0.12,
  'I': 0.12,
  'PP': 0.09, // quick crisp closure
  'FF': 0.10,
  'DD': 0.08,
  'kk': 0.09,
  'CH': 0.11,
  'SS': 0.11,
  'nn': 0.08,
  'RR': 0.08,
  'TH': 0.09,
  'sil': 0.08,
};

// Morph weights (how much jaw and mouth opens) for each viseme
const VISEME_WEIGHTS: Record<OculusViseme, { mouthOpen: number; jawOpen: number; intensity: number }> = {
  'aa': { mouthOpen: 0.85, jawOpen: 0.75, intensity: 0.9 },
  'O':  { mouthOpen: 0.5, jawOpen: 0.35, intensity: 0.85 },
  'U':  { mouthOpen: 0.15, jawOpen: 0.1, intensity: 0.95 },
  'E':  { mouthOpen: 0.45, jawOpen: 0.3, intensity: 0.8 },
  'I':  { mouthOpen: 0.3, jawOpen: 0.2, intensity: 0.8 },
  'PP': { mouthOpen: 0.0, jawOpen: 0.0, intensity: 1.0 }, // Bilabial - full closure
  'FF': { mouthOpen: 0.2, jawOpen: 0.15, intensity: 0.85 },
  'DD': { mouthOpen: 0.3, jawOpen: 0.2, intensity: 0.8 },
  'kk': { mouthOpen: 0.4, jawOpen: 0.3, intensity: 0.8 },
  'CH': { mouthOpen: 0.35, jawOpen: 0.25, intensity: 0.85 },
  'SS': { mouthOpen: 0.25, jawOpen: 0.15, intensity: 0.85 },
  'nn': { mouthOpen: 0.3, jawOpen: 0.2, intensity: 0.75 },
  'RR': { mouthOpen: 0.35, jawOpen: 0.25, intensity: 0.75 },
  'TH': { mouthOpen: 0.25, jawOpen: 0.15, intensity: 0.75 },
  'sil': { mouthOpen: 0.0, jawOpen: 0.0, intensity: 0.0 },
};

export class LipsyncFa {
  /**
   * Pre-process Persian text:
   * - standardizes Arabic Yeh/Kaf to Persian
   * - converts digits to Persian words or phonemes
   * - cleans non-spoken symbols
   */
  static cleanText(text: string): string {
    return text
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // invisible zero-width chars except ZWNJ
      .replace(/[0-9۰-۹]+/g, (match) => {
        // Simple digit conversion
        const numMap: Record<string, string> = {
          '0': ' صفر ', '1': ' یک ', '2': ' دو ', '3': ' سه ', '4': ' چهار ',
          '5': ' پنج ', '6': ' شش ', '7': ' هفت ', '8': ' هشت ', '9': ' نه ',
          '۰': ' صفر ', '۱': ' یک ', '۲': ' دو ', '۳': ' سه ', '۴': ' چهار ',
          '۵': ' پنج ', '۶': ' شش ', '۷': ' هفت ', '۸': ' هشت ', '۹': ' نه ',
        };
        return match.split('').map(d => numMap[d] || d).join('');
      })
      .trim();
  }

  /**
   * Convert Persian text into timed sequence of Oculus LipSync visemes
   * If targetDuration is specified, frames are precisely scaled to match audio duration
   */
  static generateLipSync(
    text: string,
    rate: number = 1.0,
    targetDuration?: number
  ): PersianLipsyncResult {
    const cleaned = this.cleanText(text);
    const words = cleaned.split(/\s+/).filter(Boolean);
    const frames: VisemeFrame[] = [];
    const wordSpans: { word: string; startTime: number; endTime: number }[] = [];

    let currentTime = 0.05; // tiny initial breath pause

    // Rate scaling: rate 0.5 means twice the duration (rateFactor = 2.0)
    const rateFactor = Math.max(0.4, Math.min(3.0, 1.0 / rate));

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx];
      const wordStart = currentTime;

      const chars = [...word];
      for (let cIdx = 0; cIdx < chars.length; cIdx++) {
        const char = chars[cIdx];
        let viseme = PERSIAN_CHAR_TO_VISEME[char];

        if (!viseme) {
          // Fallback heuristic for unknown chars
          if (/[a-zA-Z]/.test(char)) {
            viseme = 'aa';
          } else {
            continue;
          }
        }

        let displayChar = char;
        // Handle Persian diphthongs / digraphs:
        // "او" -> /u/ (single viseme 'U')
        if (char === 'ا' && cIdx < chars.length - 1 && chars[cIdx + 1] === 'و') {
          viseme = 'U';
          displayChar = 'او';
          cIdx++; // consume 'و' so it doesn't get processed as 'O'
        } else if (char === 'ا' && cIdx < chars.length - 1 && chars[cIdx + 1] === 'ی') {
          viseme = 'I';
          displayChar = 'ای';
          cIdx++; // consume 'ی'
        } else if (char === 'و') {
          // If 'و' is preceded by a consonant, in Persian it is usually vowel /u/ ("بو", "مو", "دو", "رو", "پوچ")
          if (cIdx > 0 && !['ا', 'آ', 'ه', 'و', 'ی'].includes(chars[cIdx - 1])) {
            viseme = 'U';
          }
        }

        const baseDur = (VISEME_DURATIONS[viseme] || 0.1) * rateFactor;
        const weights = VISEME_WEIGHTS[viseme] || { mouthOpen: 0.3, jawOpen: 0.2, intensity: 0.7 };

        // Co-articulation: if previous frame had the same viseme, lengthen it slightly
        if (frames.length > 0 && frames[frames.length - 1].viseme === viseme && viseme !== 'sil') {
          frames[frames.length - 1].duration += baseDur * 0.7;
          currentTime += baseDur * 0.7;
        } else {
          frames.push({
            char: displayChar,
            word,
            viseme,
            time: currentTime,
            duration: baseDur,
            intensity: weights.intensity,
            mouthOpen: weights.mouthOpen,
            jawOpen: weights.jawOpen,
          });
          currentTime += baseDur;
        }
      }

      wordSpans.push({
        word,
        startTime: wordStart,
        endTime: currentTime,
      });

      // Inter-word pause
      const pauseDur = (wIdx === words.length - 1 ? 0.2 : 0.07) * rateFactor;
      frames.push({
        char: ' ',
        word,
        viseme: 'sil',
        time: currentTime,
        duration: pauseDur,
        intensity: 0,
        mouthOpen: 0,
        jawOpen: 0,
      });
      currentTime += pauseDur;
    }

    // If an exact audio duration is requested, scale every frame and word boundary linearly
    if (targetDuration && targetDuration > 0 && currentTime > 0) {
      const scale = targetDuration / currentTime;
      frames.forEach((f) => {
        f.time *= scale;
        f.duration *= scale;
      });
      wordSpans.forEach((w) => {
        w.startTime *= scale;
        w.endTime *= scale;
      });
      currentTime = targetDuration;
    }

    return {
      frames,
      totalDuration: currentTime,
      words: wordSpans,
    };
  }

  /**
   * Sample active visemes at a given time point with cosine smoothing
   */
  static sampleVisemesAtTime(
    lipsync: PersianLipsyncResult,
    elapsedSeconds: number,
    exaggeration: number = 1.0
  ): {
    activeViseme: OculusViseme;
    activeChar: string;
    activeWord: string;
    morphs: Record<string, number>;
  } {
    const { frames } = lipsync;

    if (frames.length === 0 || elapsedSeconds < 0 || elapsedSeconds > lipsync.totalDuration) {
      return {
        activeViseme: 'sil',
        activeChar: '',
        activeWord: '',
        morphs: {
          viseme_sil: 1,
          mouthOpen: 0,
          jawOpen: 0,
        },
      };
    }

    // Find current active frame
    let currentFrameIndex = frames.findIndex(
      (f) => elapsedSeconds >= f.time && elapsedSeconds < f.time + f.duration
    );

    if (currentFrameIndex === -1) {
      if (elapsedSeconds >= lipsync.totalDuration) {
        return {
          activeViseme: 'sil',
          activeChar: '',
          activeWord: '',
          morphs: { viseme_sil: 1, mouthOpen: 0, jawOpen: 0 },
        };
      }
      currentFrameIndex = frames.length - 1;
    }

    const frame = frames[currentFrameIndex];
    const progress = (elapsedSeconds - frame.time) / frame.duration; // 0 to 1

    // Cosine smoothing curve for natural organic mouth muscle movement (bell shape)
    const bellShape = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
    const weight = Math.min(1.0, bellShape * frame.intensity * exaggeration);

    // Initialize all visemes to zero
    const morphs: Record<string, number> = {
      viseme_sil: 0,
      viseme_PP: 0,
      viseme_FF: 0,
      viseme_TH: 0,
      viseme_DD: 0,
      viseme_kk: 0,
      viseme_CH: 0,
      viseme_SS: 0,
      viseme_nn: 0,
      viseme_RR: 0,
      viseme_aa: 0,
      viseme_E: 0,
      viseme_I: 0,
      viseme_O: 0,
      viseme_U: 0,
      mouthOpen: 0,
      jawOpen: 0,
    };

    if (frame.viseme === 'sil') {
      morphs.viseme_sil = 1;
      morphs.mouthOpen = 0;
      morphs.jawOpen = 0;
    } else {
      const visemeKey = `viseme_${frame.viseme}`;
      morphs[visemeKey] = weight;
      morphs.mouthOpen = frame.mouthOpen * weight;
      morphs.jawOpen = frame.jawOpen * weight;

      // Special bilabial closure enforcement (ب, پ, م)
      if (frame.viseme === 'PP') {
        morphs.mouthOpen = 0;
        morphs.jawOpen = 0;
        morphs.viseme_PP = weight;
      }
    }

    // Blend previous and next frame for seamless co-articulation
    if (progress < 0.25 && currentFrameIndex > 0) {
      const prev = frames[currentFrameIndex - 1];
      if (prev.viseme !== 'sil') {
        const blend = (0.25 - progress) / 0.25 * 0.3 * exaggeration;
        morphs[`viseme_${prev.viseme}`] = Math.max(morphs[`viseme_${prev.viseme}`] || 0, blend);
      }
    } else if (progress > 0.75 && currentFrameIndex < frames.length - 1) {
      const next = frames[currentFrameIndex + 1];
      if (next.viseme !== 'sil') {
        const blend = (progress - 0.75) / 0.25 * 0.3 * exaggeration;
        morphs[`viseme_${next.viseme}`] = Math.max(morphs[`viseme_${next.viseme}`] || 0, blend);
      }
    }

    return {
      activeViseme: frame.viseme,
      activeChar: frame.char,
      activeWord: frame.word,
      morphs,
    };
  }
}
