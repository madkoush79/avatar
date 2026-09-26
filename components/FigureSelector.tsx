'use client';

import React, { useState, useEffect } from 'react';
import { FigurePose } from '@/lib/types';
import { TEN_FIGURE_POSES } from '@/lib/figures-data';
import { 
  Play, 
  Pause, 
  FlipHorizontal, 
  ChevronRight, 
  ChevronLeft, 
  Activity, 
  Sparkles,
  Sliders,
  Check
} from 'lucide-react';

interface FigureSelectorProps {
  selectedFigure: FigurePose;
  onSelectFigure: (fig: FigurePose) => void;
  mirrorPose: boolean;
  onToggleMirror: () => void;
  transitionSpeed: number;
  onChangeTransitionSpeed: (speed: number) => void;
}

export function FigureSelector({
  selectedFigure,
  onSelectFigure,
  mirrorPose,
  onToggleMirror,
  transitionSpeed,
  onChangeTransitionSpeed,
}: FigureSelectorProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [autoTourActive, setAutoTourActive] = useState<boolean>(false);
  const [tourCountdown, setTourCountdown] = useState<number>(3);

  // Auto-tour loop: cycles through figures every 3.5 seconds
  useEffect(() => {
    if (!autoTourActive) return;

    const interval = setInterval(() => {
      const currentIndex = TEN_FIGURE_POSES.findIndex((f) => f.id === selectedFigure.id);
      const nextIndex = (currentIndex + 1) % TEN_FIGURE_POSES.length;
      onSelectFigure(TEN_FIGURE_POSES[nextIndex]);
    }, 3500);

    return () => clearInterval(interval);
  }, [autoTourActive, selectedFigure, onSelectFigure]);

  const filteredFigures = filterCategory === 'all'
    ? TEN_FIGURE_POSES
    : TEN_FIGURE_POSES.filter((f) => f.category === filterCategory);

  const handleNextFigure = () => {
    const currentIndex = TEN_FIGURE_POSES.findIndex((f) => f.id === selectedFigure.id);
    const nextIndex = (currentIndex + 1) % TEN_FIGURE_POSES.length;
    onSelectFigure(TEN_FIGURE_POSES[nextIndex]);
  };

  const handlePrevFigure = () => {
    const currentIndex = TEN_FIGURE_POSES.findIndex((f) => f.id === selectedFigure.id);
    const prevIndex = (currentIndex - 1 + TEN_FIGURE_POSES.length) % TEN_FIGURE_POSES.length;
    onSelectFigure(TEN_FIGURE_POSES[prevIndex]);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-100">۱۰ فیگور و ژست اختصاصی</h3>
          <span className="text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            {TEN_FIGURE_POSES.length} فیگور طراحی‌شده
          </span>
        </div>

        {/* Toolbar: Auto-tour, Mirror, Step */}
        <div className="flex items-center gap-1.5">
          {/* Auto Tour Button */}
          <button
            onClick={() => setAutoTourActive(!autoTourActive)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              autoTourActive
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-800'
            }`}
            title="پخش خودکار تور ۱۰ فیگور"
          >
            {autoTourActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoTourActive ? 'توقف تور' : 'تور خودکار فیگورها'}</span>
          </button>

          {/* Mirror Pose Toggle */}
          <button
            onClick={onToggleMirror}
            className={`p-1.5 rounded-lg border text-xs transition-colors ${
              mirrorPose
                ? 'bg-sky-500 text-slate-950 border-sky-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="آینه‌کردن فیگور به چپ و راست"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Quick Prev / Next */}
          <button
            onClick={handlePrevFigure}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="فیگور قبلی"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNextFigure}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="فیگور بعدی"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 overflow-x-auto">
        {[
          { id: 'all', label: 'همه فیگورها' },
          { id: 'formal', label: 'رسمی و پرزنتر' },
          { id: 'casual', label: 'کژوال و مدلینگ' },
          { id: 'action', label: 'اکشن و حماسی' },
          { id: 'expressive', label: 'احساسی و گفتگو' },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilterCategory(cat.id)}
            className={`px-3 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
              filterCategory === cat.id
                ? 'bg-slate-800 text-sky-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid of 10 Figures */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
        {filteredFigures.map((fig) => {
          const isSelected = selectedFigure.id === fig.id;
          return (
            <button
              key={fig.id}
              onClick={() => onSelectFigure(fig)}
              className={`relative text-right p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-emerald-950/60 border-emerald-400/80 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400/40'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300'
              }`}
            >
              {/* Selected Tick */}
              {isSelected && (
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-mono text-emerald-400 font-bold">
                    {fig.index}
                  </span>
                  <span className="font-semibold text-xs text-slate-100">{fig.name}</span>
                </div>
                <p className="text-xs text-slate-300 font-medium mb-1">{fig.nameFa}</p>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {fig.descriptionFa}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-medium">{fig.badgeFa}</span>
                <span className="text-[10px] text-slate-400">
                  {fig.sitting ? 'نشسته' : fig.kneeling ? 'روی زانو' : 'ایستاده'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Transition Speed Slider */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>سرعت جابجایی بین فیگورها (Interpolation):</span>
          </div>
          <span className="font-mono text-slate-400 text-[11px]">
            {transitionSpeed <= 0.05 ? 'آرام و پیوسته' : transitionSpeed <= 0.1 ? 'طبیعی و نرم' : 'سریع و فرز'}
          </span>
        </div>
        <input
          type="range"
          min="0.03"
          max="0.18"
          step="0.01"
          value={transitionSpeed}
          onChange={(e) => onChangeTransitionSpeed(parseFloat(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
        />
      </div>
    </div>
  );
}
