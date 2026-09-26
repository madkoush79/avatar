'use client';

import React from 'react';
import { CameraPreset, CharacterItem, FigurePose } from '@/lib/types';
import { 
  Camera, 
  RotateCcw, 
  Sparkles, 
  Layers, 
  Maximize2, 
  Eye, 
  User, 
  HelpCircle,
  ExternalLink
} from 'lucide-react';

interface HeaderProps {
  character: CharacterItem;
  figure: FigurePose;
  cameraPreset: CameraPreset;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  onResetCamera: () => void;
  onOpenFigureGallery: () => void;
  onTakeSnapshot: (transparent?: boolean) => void;
}

export function Header({
  character,
  figure,
  cameraPreset,
  onSelectCameraPreset,
  onResetCamera,
  onOpenFigureGallery,
  onTakeSnapshot,
}: HeaderProps) {
  const cameraPresetsList: { id: CameraPreset; labelFa: string; icon: string }[] = [
    { id: 'full', labelFa: 'تمام قد', icon: '🧍' },
    { id: 'bust', labelFa: 'نیم‌تنه', icon: '👤' },
    { id: 'portrait', labelFa: 'پرتره چهره', icon: '🙂' },
    { id: 'low_hero', labelFa: 'زاویه حماسی', icon: '⚡' },
  ];

  return (
    <header className="w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/20">
          <Sparkles className="w-5 h-5 fill-current" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-tight">
              TalkingHead 3D Studio
            </h1>
            <span className="text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded">
              v1.7.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            کاراکترهای mahdiyarKoushki/TalkingHead با ۱۰ فیگور اختصاصی
          </p>
        </div>
      </div>

      {/* Middle: Camera Angle Buttons */}
      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800/80">
        <span className="text-[11px] text-slate-400 px-2 font-medium hidden md:inline">زاویه دوربین:</span>
        {cameraPresetsList.map((cam) => (
          <button
            key={cam.id}
            onClick={() => onSelectCameraPreset(cam.id)}
            className={`px-2.5 py-1 text-xs rounded-lg transition-all flex items-center gap-1 ${
              cameraPreset === cam.id
                ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <span>{cam.icon}</span>
            <span className="hidden sm:inline">{cam.labelFa}</span>
          </button>
        ))}
        <button
          onClick={onResetCamera}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          title="تنظیم مجدد دوربین"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: Actions (Gallery & Snapshot) */}
      <div className="flex items-center gap-2">
        {/* All Figures Modal */}
        <button
          onClick={onOpenFigureGallery}
          className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>کاتالوگ ۱۰ فیگور</span>
        </button>

        {/* Snapshot Photo Button */}
        <button
          onClick={() => onTakeSnapshot(false)}
          className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all hover:scale-105"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>عکس و کارت فیگور</span>
        </button>
      </div>
    </header>
  );
}
