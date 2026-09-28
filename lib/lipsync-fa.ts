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
  ',': 'sil',
  '.': 'sil',
  '!': 'sil',
  '؟': 'sil',
  '?': 'sil',
  ':': 'sil',
  '؛': 'sil',
  ';': 'sil',
  '-': 'sil',

  // English letters support for bilingual English Teacher
  'a': 'aa', 'A': 'aa',
  'b': 'PP', 'B': 'PP',
  'c': 'kk', 'C': 'kk',
  'd': 'DD', 'D': 'DD',
  'e': 'E',  'E': 'E',
  'f': 'FF', 'F': 'FF',
  'g': 'kk', 'G': 'kk',
  'h': 'aa', 'H': 'aa',
  'i': 'I',  'I': 'I',
  'j': 'CH', 'J': 'CH',
  'k': 'kk', 'K': 'kk',
  'l': 'nn', 'L': 'nn',
  'm': 'PP', 'M': 'PP',
  'n': 'nn', 'N': 'nn',
  'o': 'O',  'O': 'O',
  'p': 'PP', 'P': 'PP',
  'q': 'kk', 'Q': 'kk',
  'r': 'RR', 'R': 'RR',
  's': 'SS', 'S': 'SS',
  't': 'DD', 'T': 'DD',
  'u': 'U',  'U': 'U',
  'v': 'FF', 'V': 'FF',
  'w': 'U',  'W': 'U',
  'x': 'SS', 'X': 'SS',
  'y': 'I',  'Y': 'I',
  'z': 'SS', 'Z': 'SS',
};

// Relative duration for each viseme (in seconds at rate 1.0)
// Adjusted for calmer, slower, natural phoneme articulation
const VISEME_DURATIONS: Record<OculusViseme, number> = {
  'aa': 0.22,
  'O': 0.20,
  'U': 0.20,
  'E': 0.18,
  'I': 0.18,
  'PP': 0.15, // natural relaxed closure
  'FF': 0.16,
  'DD': 0.15,
  'kk': 0.15,
  'CH': 0.17,
  'SS': 0.17,
  'nn': 0.15,
  'RR': 0.15,
  'TH': 0.15,
  'sil': 0.14,
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

export const PUNCTUATION_PAUSES: Record<string, number> = {
  '.': 0.52,
  '!': 0.52,
  '؟': 0.58,
  '?': 0.58,
  '،': 0.32,
  ',': 0.30,
  '؛': 0.36,
  ';': 0.36,
  ':': 0.35,
  '…': 0.65,
  '...': 0.65,
  '\n': 0.55,
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
   * Accurately parses punctuation marks as realistic acoustic pauses (مکث)
   * If targetDuration is specified, frames are scaled to match actual audio duration
   */
  static generateLipSync(
    text: string,
    rate: number = 1.0,
    targetDuration?: number
  ): PersianLipsyncResult {
    const cleaned = this.cleanText(text);
    // Tokenize into words and punctuation tokens
    const rawTokens = cleaned.match(/([.!?،؟؛:…]+)|(\S+)/g) || [];
    const frames: VisemeFrame[] = [];
    const wordSpans: { word: string; startTime: number; endTime: number }[] = [];

    let currentTime = 0.06; // natural initial breath pause

    // Rate scaling: rate 0.5 means twice the duration
    const rateFactor = Math.max(0.4, Math.min(3.0, 1.0 / rate));

    for (let tIdx = 0; tIdx < rawTokens.length; tIdx++) {
      const token = rawTokens[tIdx];

      // Check if token is punctuation pause (e.g. '.', '!', '؟', '،', etc.)
      const isPunctOnly = /^[.!?،؟؛:…]+$/.test(token);
      if (isPunctOnly) {
        const punctChar = token[0];
        const pauseBase = PUNCTUATION_PAUSES[token] || PUNCTUATION_PAUSES[punctChar] || 0.45;
        const pauseDur = pauseBase * rateFactor;

        frames.push({
          char: token,
          word: '(مکث)',
          viseme: 'sil',
          time: currentTime,
          duration: pauseDur,
          intensity: 0,
          mouthOpen: 0,
          jawOpen: 0,
        });
        currentTime += pauseDur;
        continue;
      }

      // Check if word has trailing punctuation attached (e.g., "سلام!" or "استودیو،")
      const trailingPunctMatch = token.match(/^(.*?)([.!?,،؟؛:…]+)$/);
      let wordCore = token;
      let trailingPunct = '';
      if (trailingPunctMatch) {
        wordCore = trailingPunctMatch[1];
        trailingPunct = trailingPunctMatch[2];
      }

      const wordStart = currentTime;
      const chars = [...wordCore];

      for (let cIdx = 0; cIdx < chars.length; cIdx++) {
        const char = chars[cIdx];
        let viseme = PERSIAN_CHAR_TO_VISEME[char] || PERSIAN_CHAR_TO_VISEME[char.toLowerCase()];

        if (!viseme) {
          continue;
        }

        let displayChar = char;
        // Handle Persian diphthongs / digraphs:
        // "او" -> /u/ (single viseme 'U')
        if (char === 'ا' && cIdx < chars.length - 1 && chars[cIdx + 1] === 'و') {
          viseme = 'U';
          displayChar = 'او';
          cIdx++; // consume 'و'
        } else if (char === 'ا' && cIdx < chars.length - 1 && chars[cIdx + 1] === 'ی') {
          viseme = 'I';
          displayChar = 'ای';
          cIdx++; // consume 'ی'
        } else if (char === 'و') {
          // If 'و' is preceded by a consonant, in Persian it is usually vowel /u/
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
            word: wordCore,
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
        word: wordCore,
        startTime: wordStart,
        endTime: currentTime,
      });

      // Trailing punctuation pause or normal inter-word pause
      if (trailingPunct) {
        const pauseBase = PUNCTUATION_PAUSES[trailingPunct] || PUNCTUATION_PAUSES[trailingPunct[0]] || 0.45;
        const pauseDur = pauseBase * rateFactor;
        frames.push({
          char: trailingPunct,
          word: '(مکث)',
          viseme: 'sil',
          time: currentTime,
          duration: pauseDur,
          intensity: 0,
          mouthOpen: 0,
          jawOpen: 0,
        });
        currentTime += pauseDur;
      } else {
        // Standard inter-word pause
        const pauseDur = (tIdx === rawTokens.length - 1 ? 0.25 : 0.08) * rateFactor;
        frames.push({
          char: ' ',
          word: wordCore,
          viseme: 'sil',
          time: currentTime,
          duration: pauseDur,
          intensity: 0,
          mouthOpen: 0,
          jawOpen: 0,
        });
        currentTime += pauseDur;
      }
    }

    // If an exact audio duration is requested, scale frames proportionally
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
   * Sample active visemes at a given time point with cosine smoothing,
   * live audio volume modulation, and strict silence/pause gating.
   */
  static sampleVisemesAtTime(
    lipsync: PersianLipsyncResult,
    elapsedSeconds: number,
    exaggeration: number = 1.0,
    audioVolume?: number, // 0.0 to 1.0 live audio volume
    isAudioSilent?: boolean // live sound pause flag
  ): {
    activeViseme: OculusViseme;
    activeChar: string;
    activeWord: string;
    morphs: Record<string, number>;
    isPaused: boolean;
  } {
    const { frames } = lipsync;

    // Silence template (lips completely closed, rest pose)
    const zeroMorphs: Record<string, number> = {
      viseme_sil: 1,
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

    // If audio is acoustically silent, firmly seal mouth in perfect synchronization with the audio pause
    if (isAudioSilent) {
      return {
        activeViseme: 'sil',
        activeChar: '(مکث)',
        activeWord: '(مکث صدا)',
        morphs: { ...zeroMorphs },
        isPaused: true,
      };
    }

    if (frames.length === 0 || elapsedSeconds < 0 || elapsedSeconds > lipsync.totalDuration) {
      return {
        activeViseme: 'sil',
        activeChar: '',
        activeWord: '',
        morphs: { ...zeroMorphs },
        isPaused: true,
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
          morphs: { ...zeroMorphs },
          isPaused: true,
        };
      }
      currentFrameIndex = frames.length - 1;
    }

    const frame = frames[currentFrameIndex];
    const progress = (elapsedSeconds - frame.time) / frame.duration; // 0 to 1

    // If active frame is silence (pause between words, sentence break, punctuation)
    if (frame.viseme === 'sil') {
      return {
        activeViseme: 'sil',
        activeChar: frame.char === ' ' ? '' : frame.char,
        activeWord: frame.word,
        morphs: { ...zeroMorphs },
        isPaused: true,
      };
    }

    // Non-silence frame: use a smooth sustained curve that keeps natural articulation across the syllable
    // and gently cross-fades into adjacent phonemes instead of snapping up and down rapidly
    const smoothCurve = 0.65 + 0.35 * Math.sin(Math.max(0.1, Math.min(0.9, progress)) * Math.PI);
    let weight = Math.min(1.0, smoothCurve * frame.intensity * exaggeration);

    // Audio volume modulation: scale mouth opening and viseme intensity gently with acoustic volume
    if (audioVolume !== undefined) {
      const volumeFactor = Math.min(1.15, 0.5 + Math.max(0, Math.min(1, audioVolume)) * 0.65);
      weight *= volumeFactor;
    }

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

    const visemeKey = `viseme_${frame.viseme}`;
    morphs[visemeKey] = weight;

    // Sustain gentle natural mouth openness throughout speech words without jerky fluttering
    morphs.mouthOpen = Math.max(0.28 * weight, frame.mouthOpen * weight);
    morphs.jawOpen = Math.max(0.18 * weight, frame.jawOpen * weight);

    // Special bilabial closure enforcement (ب, پ, م)
    if (frame.viseme === 'PP') {
      morphs.mouthOpen = 0;
      morphs.jawOpen = 0;
      morphs.viseme_PP = weight;
    }

    // Wide, seamless co-articulation blending with adjacent non-silence phonemes for calm, slow transitions
    if (progress < 0.45 && currentFrameIndex > 0) {
      const prev = frames[currentFrameIndex - 1];
      if (prev.viseme !== 'sil') {
        const blend = ((0.45 - progress) / 0.45) * 0.4 * exaggeration;
        morphs[`viseme_${prev.viseme}`] = Math.max(morphs[`viseme_${prev.viseme}`] || 0, blend);
      }
    } else if (progress > 0.55 && currentFrameIndex < frames.length - 1) {
      const next = frames[currentFrameIndex + 1];
      if (next.viseme !== 'sil') {
        const blend = ((progress - 0.55) / 0.45) * 0.4 * exaggeration;
        morphs[`viseme_${next.viseme}`] = Math.max(morphs[`viseme_${next.viseme}`] || 0, blend);
      }
    }

    return {
      activeViseme: frame.viseme,
      activeChar: frame.char,
      activeWord: frame.word,
      morphs,
      isPaused: false,
    };
  }
}
