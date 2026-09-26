'use client';

import React, { useRef } from 'react';
import { CharacterItem, FigurePose } from '@/lib/types';
import { Download, X, Sparkles, Share2, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface FigureCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotUrl: string | null;
  character: CharacterItem;
  figure: FigurePose;
}

export function FigureCardModal({
  isOpen,
  onClose,
  snapshotUrl,
  character,
  figure,
}: FigureCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !snapshotUrl) return null;

  const handleDownload = () => {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });

    const link = document.createElement('a');
    link.download = `${character.name}_Figure_${figure.index}_${figure.id}.png`;
    link.href = snapshotUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-1.5 text-xs text-sky-400 font-semibold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>کارت کلکسیونی فیگور سه‌بعدی</span>
          </div>
          <h3 className="text-lg font-bold text-white">
            {character.name} · {figure.nameFa}
          </h3>
        </div>

        {/* The Collectible Card Box */}
        <div
          ref={cardRef}
          className="w-full max-w-[340px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-sky-500/40 rounded-2xl p-4 shadow-xl shadow-sky-500/10 flex flex-col items-center relative overflow-hidden"
        >
          {/* Card Top Banner */}
          <div className="w-full flex items-center justify-between text-xs pb-2 mb-2 border-b border-slate-800 text-slate-300">
            <span className="font-mono text-sky-400 font-bold">#FIG-0{figure.index}</span>
            <span className="text-[11px] text-slate-400">TalkingHead Studio 3D</span>
          </div>

          {/* Snapshot Image */}
          <div className="w-full h-64 rounded-xl bg-slate-950/80 border border-slate-800/80 overflow-hidden flex items-center justify-center relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={snapshotUrl}
              alt={`${character.name} in ${figure.name}`}
              className="w-full h-full object-contain"
            />
          </div>

          {/* Card Metadata */}
          <div className="w-full mt-3 text-right">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">{character.nameFa}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {figure.badgeFa}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">{figure.nameFa}</p>
            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
              {figure.descriptionFa}
            </p>
          </div>

          {/* Footer watermark */}
          <div className="w-full mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
            <span>مدل: {character.styleFa}</span>
            <span>کیفیت Ultra HD 4K</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-5 w-full max-w-[340px]">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all hover:scale-[1.02]"
          >
            <Download className="w-4 h-4" />
            <span>دانلود عکس فیگور (PNG)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
