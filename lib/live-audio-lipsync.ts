import { FacialExpression } from './types';
import { LipsyncFa, PersianLipsyncResult, OculusViseme } from './lipsync-fa';

export interface LiveAudioLipSyncController {
  isPlaying: boolean;
  stop: () => void;
  getFrequencyData?: () => Uint8Array | null;
}

export interface LiveAudioLipSyncCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
  onVisemeUpdate: (morphs: Partial<FacialExpression>, rawVolume: number) => void;
  onWaveformUpdate?: (waveformData: number[]) => void;
}

let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioCtx = new AudioCtxClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Strips markdown code blocks, formatting asterisks, and emojis to produce
 * a clean spoken text stream for the LipsyncFa phonetic engine.
 */
export function cleanSpokenText(text: string): string {
  return text
    .replace(/\[.*?\]/g, '') // remove bracketed tags like [GESTURE: ...]
    .replace(/```[\s\S]*?```/g, '') // code blocks
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*_#~>[\]()]/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // emojis
    .trim();
}

/**
 * Plays base64 AAC/MP3 audio returned by ChatGPT Live Turn and uses the exact
 * LipsyncFa phonetic timeline engine synchronized with real-time audio volume
 * to drive natural, smooth 3D avatar lip movements and rest poses.
 */
export function playLiveVoiceWithLipSync(
  audioBase64: string,
  spokenText: string,
  callbacks: LiveAudioLipSyncCallbacks
): LiveAudioLipSyncController {
  if (typeof window === 'undefined') {
    callbacks.onEnd?.();
    return { isPlaying: false, stop: () => {} };
  }

  const cleanText = cleanSpokenText(spokenText);
  let audioUrl: string | null = null;
  let audioElem: HTMLAudioElement | null = null;
  let sourceNode: AudioNode | null = null;
  let gainNode: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let animId: number | null = null;
  let isStopped = false;

  const audioCtx = getSharedAudioContext();

  const resetVisemesToSilence = () => {
    callbacks.onVisemeUpdate(
      {
        viseme_sil: 1,
        viseme_aa: 0,
        viseme_O: 0,
        viseme_E: 0,
        viseme_I: 0,
        viseme_U: 0,
        viseme_PP: 0,
        viseme_FF: 0,
        viseme_SS: 0,
        viseme_CH: 0,
        viseme_kk: 0,
        viseme_DD: 0,
        viseme_nn: 0,
        viseme_RR: 0,
        mouthOpen: 0,
        jawOpen: 0,
        speechVolume: 0,
        isSpeechPaused: true,
      },
      0
    );
    if (callbacks.onWaveformUpdate) {
      callbacks.onWaveformUpdate(new Array(16).fill(0));
    }
  };

  const cleanup = () => {
    if (isStopped) return;
    isStopped = true;

    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }

    if (audioElem) {
      audioElem.pause();
      audioElem.removeAttribute('src');
      audioElem = null;
    }

    if (sourceNode) {
      try {
        if ('stop' in sourceNode && typeof (sourceNode as any).stop === 'function') {
          (sourceNode as any).stop();
        }
        sourceNode.disconnect();
      } catch {}
      sourceNode = null;
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }

    resetVisemesToSilence();
    callbacks.onEnd?.();
  };

  const startPlaybackLoop = (
    duration: number,
    getElapsed: () => number,
    analyserNode: AnalyserNode
  ) => {
    // Generate phonetically timed lip-sync matching the exact audio duration
    const lipsync = LipsyncFa.generateLipSync(cleanText, 1.0, duration);

    callbacks.onStart?.();

    const timeData = new Uint8Array(analyserNode.frequencyBinCount);
    const freqData = new Uint8Array(analyserNode.frequencyBinCount);
    const waveSummary = new Array(16).fill(0);
    let smoothVolume = 0.3;

    const renderLoop = () => {
      if (isStopped) return;

      const elapsed = getElapsed();

      if (elapsed > duration + 0.15) {
        cleanup();
        return;
      }

      // Compute acoustic RMS amplitude for exact natural sound pauses
      analyserNode.getByteTimeDomainData(timeData);
      let sumSquares = 0;
      for (let i = 0; i < timeData.length; i++) {
        const norm = (timeData[i] - 128) / 128;
        sumSquares += norm * norm;
      }
      const instantRms = Math.sqrt(sumSquares / timeData.length);
      const instantVol = Math.min(1.0, instantRms * 5.8);

      // Smooth envelope follower (smooth attack, natural decay)
      smoothVolume += (instantVol - smoothVolume) * (instantVol > smoothVolume ? 0.22 : 0.12);

      // Acoustic silence detection
      const isAudioSilent = smoothVolume < 0.04;

      // Sample visemes using the exact LipsyncFa engine
      const sample = LipsyncFa.sampleVisemesAtTime(
        lipsync,
        elapsed,
        1.0, // exaggeration
        smoothVolume,
        isAudioSilent
      );

      callbacks.onVisemeUpdate(
        {
          ...sample.morphs,
          speechVolume: isAudioSilent ? 0 : smoothVolume,
          isSpeechPaused: sample.isPaused || isAudioSilent,
        },
        smoothVolume
      );

      // Waveform summary for UI visualizer
      if (callbacks.onWaveformUpdate) {
        analyserNode.getByteFrequencyData(freqData);
        const step = Math.floor(freqData.length / 16);
        for (let b = 0; b < 16; b++) {
          waveSummary[b] = (freqData[b * step] || 0) / 255;
        }
        callbacks.onWaveformUpdate([...waveSummary]);
      }

      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  // Convert base64 to binary byte array
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Attempt Method A: Web Audio API BufferSource (zero jitter, microsecond accurate)
  audioCtx
    .decodeAudioData(bytes.buffer.slice(0))
    .then((audioBuffer) => {
      if (isStopped) return;

      const duration = audioBuffer.duration;
      const bufferSource = audioCtx.createBufferSource();
      bufferSource.buffer = audioBuffer;

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.25;

      gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);

      bufferSource.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      sourceNode = bufferSource;

      const audioStartTime = performance.now() / 1000;
      bufferSource.start();

      startPlaybackLoop(
        duration,
        () => performance.now() / 1000 - audioStartTime,
        analyser
      );
    })
    .catch((decodeErr) => {
      // Method B Fallback: HTMLAudioElement with MediaElementSource (universal AAC streaming)
      if (isStopped) return;
      console.warn('decodeAudioData fallback to HTMLAudioElement:', decodeErr);

      try {
        const blob = new Blob([bytes], { type: 'audio/aac' });
        audioUrl = URL.createObjectURL(blob);
        audioElem = new Audio(audioUrl);
        audioElem.crossOrigin = 'anonymous';

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.25;

        const mediaSource = audioCtx.createMediaElementSource(audioElem);
        mediaSource.connect(analyser);
        analyser.connect(audioCtx.destination);
        sourceNode = mediaSource;

        audioElem.onloadedmetadata = () => {
          if (isStopped || !audioElem) return;
          const duration = audioElem.duration || 3.0;

          audioElem.play().then(() => {
            if (isStopped || !audioElem || !analyser) return;
            startPlaybackLoop(duration, () => audioElem?.currentTime ?? 0, analyser);
          }).catch(cleanup);
        };

        audioElem.onerror = cleanup;
      } catch (elemErr) {
        console.error('Playback initialization error:', elemErr);
        cleanup();
      }
    });

  return {
    isPlaying: true,
    stop: cleanup,
    getFrequencyData: () => {
      if (!analyser) return null;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buf);
      return buf;
    },
  };
}
