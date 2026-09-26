// Web Audio Persian Vocal Formant & Speech Synthesizer
// Combines Neural Persian Text-to-Speech (via /api/tts) with browser Web Speech API
// Synchronized frame-by-frame with Persian LipSync

import { LipsyncFa, PersianLipsyncResult, OculusViseme } from './lipsync-fa';

export class PersianSpeechSynthesizer {
  private audioCtx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private animFrameId: number | null = null;
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];
  private ttsCache: Map<string, AudioBuffer> = new Map();
  private isFetching: boolean = false;

  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Speak Persian text and stream synchronized Oculus visemes
   */
  speak(
    text: string,
    options: {
      rate?: number;
      pitch?: number;
      rateStr?: string;
      pitchStr?: string;
      exaggeration?: number;
      enableAudio?: boolean;
      useBrowserTTSIfAvailable?: boolean;
      voice?: string;
    } = {},
    callbacks: {
      onVisemeUpdate: (
        morphs: Record<string, number>,
        activeViseme: OculusViseme,
        char: string,
        word: string
      ) => void;
      onStart?: () => void;
      onEnd?: () => void;
      onFallbackNotice?: (mode: 'neural' | 'browser') => void;
    }
  ): { stop: () => void } {
    this.stop();

    const cleanText = text.trim();
    const voice = options.voice || 'fa-IR-DilaraNeural';
    const rate = Math.max(0.4, options.rate ?? 1.0);
    const pitch = options.pitch ?? 1.0;
    const exaggeration = options.exaggeration ?? 1.0;
    const enableAudio = options.enableAudio ?? true;
    const cacheKey = `${voice}_${cleanText}`;

    this.isPlaying = true;
    let stopped = false;

    const executePlayback = async () => {
      // 1. First priority: High-Fidelity Natural Neural Persian Voice (from /api/tts)
      let audioBuffer = this.ttsCache.get(cacheKey);

      if (!audioBuffer && enableAudio && typeof window !== 'undefined') {
        try {
          this.isFetching = true;
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanText,
              voice,
              rate: options.rateStr,
              pitch: options.pitchStr,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.audioBase64) {
              const ctx = this.ensureAudioContext();
              const binary = atob(data.audioBase64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }
              audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
              this.ttsCache.set(cacheKey, audioBuffer);
            }
          }
        } catch (err) {
          console.warn('TTS request error, proceeding to fallback:', err);
        } finally {
          this.isFetching = false;
        }
      }

      if (stopped || !this.isPlaying) return;

      // --- Mode A: Neural Persian Voice (Crisp studio quality) ---
      if (audioBuffer && enableAudio) {
        callbacks.onFallbackNotice?.('neural');
        const ctx = this.ensureAudioContext();
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = rate;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.95, ctx.currentTime);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        this.activeNodes.push(source, gainNode);

        const actualAudioDuration = audioBuffer.duration / rate;
        const lipsync = LipsyncFa.generateLipSync(cleanText, rate, actualAudioDuration);

        callbacks.onStart?.();
        const audioStartTime = performance.now() / 1000;
        source.start();

        const renderLoop = () => {
          if (!this.isPlaying || stopped) return;

          const now = performance.now() / 1000;
          const elapsed = now - audioStartTime;

          if (elapsed > actualAudioDuration) {
            this.stop();
            callbacks.onEnd?.();
            return;
          }

          const sample = LipsyncFa.sampleVisemesAtTime(lipsync, elapsed, exaggeration);
          callbacks.onVisemeUpdate(
            sample.morphs,
            sample.activeViseme,
            sample.activeChar,
            sample.activeWord
          );

          this.animFrameId = requestAnimationFrame(renderLoop);
        };

        renderLoop();
        return;
      }

      if (stopped || !this.isPlaying) return;

      // --- Mode B: Clear System Speech Synthesis (Native Browser TTS) ---
      // If neural voice was unreachable, use standard browser text-to-speech
      callbacks.onFallbackNotice?.('browser');
      const lipsync = LipsyncFa.generateLipSync(cleanText, rate);

      callbacks.onStart?.();

      if (enableAudio && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(cleanText);
        utt.rate = rate;
        utt.pitch = pitch;

        // Try to pick a Persian or Arabic/Middle-Eastern natural voice if installed
        const voices = window.speechSynthesis.getVoices();
        const faVoice =
          voices.find((v) => v.lang.startsWith('fa')) ||
          voices.find((v) => v.lang.startsWith('ar')) ||
          voices.find((v) => v.lang.includes('IR'));

        if (faVoice) {
          utt.voice = faVoice;
          utt.lang = faVoice.lang;
        } else {
          utt.lang = 'fa-IR';
        }

        window.speechSynthesis.speak(utt);
      }

      const startTime = performance.now() / 1000;

      const renderLoop = () => {
        if (!this.isPlaying || stopped) return;

        const now = performance.now() / 1000;
        const elapsed = now - startTime;

        if (elapsed > lipsync.totalDuration) {
          this.stop();
          callbacks.onEnd?.();
          return;
        }

        const sample = LipsyncFa.sampleVisemesAtTime(lipsync, elapsed, exaggeration);
        callbacks.onVisemeUpdate(
          sample.morphs,
          sample.activeViseme,
          sample.activeChar,
          sample.activeWord
        );

        this.animFrameId = requestAnimationFrame(renderLoop);
      };

      renderLoop();
    };

    executePlayback();

    return {
      stop: () => {
        stopped = true;
        this.stop(callbacks.onEnd);
      },
    };
  }

  stop(onEnd?: () => void) {
    this.isPlaying = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.activeNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof node.stop === 'function') node.stop();
        if ('disconnect' in node && typeof node.disconnect === 'function') node.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeNodes = [];

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onEnd?.();
  }
}

export const persianSpeechSynth = new PersianSpeechSynthesizer();
