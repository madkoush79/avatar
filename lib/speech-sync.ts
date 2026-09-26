export interface SpeechController {
  isSpeaking: boolean;
  stop: () => void;
}

export const SPEECH_PRESETS = [
  {
    lang: 'fa-IR',
    titleFa: 'معرفی کاراکتر و پروژه',
    text: 'سلام! من کاراکتر ۳ بعدی پروژه TalkingHead هستم. می‌تونی هر ۱۰ فیگور مختلف من رو در این استودیو بررسی کنی.',
  },
  {
    lang: 'fa-IR',
    titleFa: 'توضیح فیگورها و انیمیشن',
    text: 'هر کدام از این ۱۰ فیگور با دقت و به صورت کاملاً روان طراحی شده‌اند و استخوان‌بندی بدن به نرمی تغییر پوز می‌دهد.',
  },
  {
    lang: 'fa-IR',
    titleFa: 'دعوت به سفارشی‌سازی',
    text: 'نورپردازی استودیو، حالت‌های چهره و زوایای دوربین را تغییر بده و یک شات باکیفیت ذخیره کن!',
  },
  {
    lang: 'en-US',
    titleFa: 'معرفی به انگلیسی (English Greeting)',
    text: 'Hello! Welcome to the 3D Character and Figure Studio based on TalkingHead. Switch between all 10 figures seamlessly.',
  },
  {
    lang: 'en-US',
    titleFa: 'استایل و ژست‌ها (Action & Pose)',
    text: 'Check out the fashion hip stance, the executive crossed arms, or the hero kneel pose!',
  },
];

export function speakText(
  text: string,
  lang: string = 'fa-IR',
  rate: number = 1.0,
  pitch: number = 1.0,
  onViseme: (morphs: { aa: number; O: number; E: number; I: number }) => void,
  onStart?: () => void,
  onEnd?: () => void
): SpeechController {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    onEnd?.();
    return { isSpeaking: false, stop: () => {} };
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;

  // Try finding voice matching language
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find((v) => v.lang.startsWith(lang.slice(0, 2)));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  let animationFrameId: number | null = null;
  let isSpeaking = true;
  const startTime = Date.now();

  const animateVisemes = () => {
    if (!isSpeaking) return;

    const elapsed = (Date.now() - startTime) / 1000;
    // Rhythmic syllable pulse simulation for realistic lip movement
    const freq = 5.5 * rate;
    const wave = (Math.sin(elapsed * freq * 2 * Math.PI) + 1) / 2;
    const wave2 = (Math.cos(elapsed * (freq * 1.3) * 2 * Math.PI) + 1) / 2;

    const baseIntensity = Math.min(1, Math.max(0, wave * 0.7 + wave2 * 0.3));

    // Dynamic viseme variation
    const cycle = Math.floor(elapsed * 4) % 4;
    let aa = 0, O = 0, E = 0, I = 0;

    if (cycle === 0) aa = baseIntensity * 0.9;
    else if (cycle === 1) O = baseIntensity * 0.8;
    else if (cycle === 2) E = baseIntensity * 0.75;
    else I = baseIntensity * 0.7;

    onViseme({ aa, O, E, I });
    animationFrameId = requestAnimationFrame(animateVisemes);
  };

  utterance.onstart = () => {
    isSpeaking = true;
    onStart?.();
    animateVisemes();
  };

  const cleanup = () => {
    isSpeaking = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    onViseme({ aa: 0, O: 0, E: 0, I: 0 });
    onEnd?.();
  };

  utterance.onend = cleanup;
  utterance.onerror = cleanup;

  window.speechSynthesis.speak(utterance);

  return {
    isSpeaking: true,
    stop: () => {
      window.speechSynthesis.cancel();
      cleanup();
    },
  };
}

// Microphone audio-driven lip-sync
export class MicAudioLipSync {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isListening: boolean = false;
  private animId: number | null = null;

  async start(onVolume: (volume: number) => void): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices) return false;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.isListening = true;
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const loop = () => {
        if (!this.isListening || !this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1, avg / 65); // 0 to 1
        onVolume(normalized);

        this.animId = requestAnimationFrame(loop);
      };

      loop();
      return true;
    } catch {
      return false;
    }
  }

  stop() {
    this.isListening = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
