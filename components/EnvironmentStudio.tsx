'use client';

import React from 'react';
import { StudioEnvironment } from '@/lib/types';
import { Sun, Moon, Sparkles, RefreshCw, Eye, Wind, MousePointer } from 'lucide-react';

interface EnvironmentStudioProps {
  environment: StudioEnvironment;
  onChangeEnvironment: (env: StudioEnvironment) => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  breathing: boolean;
  onToggleBreathing: () => void;
  blinking: boolean;
  onToggleBlinking: () => void;
  headTracking: boolean;
  onToggleHeadTracking: () => void;
}

export function EnvironmentStudio({
  environment,
  onChangeEnvironment,
  autoRotate,
  onToggleAutoRotate,
  breathing,
  onToggleBreathing,
  blinking,
  onToggleBlinking,
  headTracking,
  onToggleHeadTracking,
}: EnvironmentStudioProps) {
  const environments = [
    {
      id: 'dark_cyber' as StudioEnvironment,
      nameFa: 'سایبرپانک تاریک',
      nameEn: 'Dark Cyber Studio',
      color: 'bg-slate-900 border-sky-500/50',
      tag: 'نئون آبی و بنفش',
    },
    {
      id: 'minimal_studio' as StudioEnvironment,
      nameFa: 'استودیو مینیمال',
      nameEn: 'Clean White Studio',
      color: 'bg-slate-200 text-slate-900 border-slate-300',
      tag: 'روشن و استاندارد',
    },
    {
      id: 'sunset_gold' as StudioEnvironment,
      nameFa: 'نور طلایی غروب',
      nameEn: 'Sunset Golden Hour',
      color: 'bg-amber-950 border-amber-500/50',
      tag: 'گرم و سینمایی',
    },
    {
      id: 'matrix_grid' as StudioEnvironment,
      nameFa: 'ماتریس هولودک',
      nameEn: 'Matrix Grid',
      color: 'bg-emerald-950 border-emerald-500/50',
      tag: 'سبز تکنولوژی',
    },
    {
      id: 'green_screen' as StudioEnvironment,
      nameFa: 'پرده سبز کروماکی',
      nameEn: 'Chroma Green Screen',
      color: 'bg-green-600 text-white border-green-400',
      tag: 'مخصوص تدوین ویدیو',
    },
    {
      id: 'transparent' as StudioEnvironment,
      nameFa: 'بدون پس‌زمینه (شفاف)',
      nameEn: 'Transparent Alpha',
      color: 'bg-slate-800/80 border-slate-600',
      tag: 'برای خروجی PNG',
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sun className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-slate-100">نورپردازی، محیط و فیزیک حرکتی</h3>
      </div>

      {/* Environments Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {environments.map((env) => {
          const isSelected = environment === env.id;
          return (
            <button
              key={env.id}
              onClick={() => onChangeEnvironment(env.id)}
              className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                isSelected
                  ? 'ring-2 ring-sky-400 shadow-md bg-slate-800 border-sky-400'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-xs text-slate-100">{env.nameFa}</span>
                <div className={`w-3 h-3 rounded-full border ${env.color}`} />
              </div>
              <span className="text-[10px] text-slate-400">{env.tag}</span>
            </button>
          );
        })}
      </div>

      {/* Physics & Automation Toggles */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        {/* Auto Rotate */}
        <button
          onClick={onToggleAutoRotate}
          className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-colors ${
            autoRotate
              ? 'bg-sky-950/70 border-sky-400 text-sky-300'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
            <span>چرخش خودکار دوربین</span>
          </div>
          <span className="font-mono text-[10px]">{autoRotate ? 'روشن' : 'خاموش'}</span>
        </button>

        {/* Breathing Animation */}
        <button
          onClick={onToggleBreathing}
          className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-colors ${
            breathing
              ? 'bg-sky-950/70 border-sky-400 text-sky-300'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5" />
            <span>تنفس طبیعی بالاتنه</span>
          </div>
          <span className="font-mono text-[10px]">{breathing ? 'روشن' : 'خاموش'}</span>
        </button>

        {/* Blinking */}
        <button
          onClick={onToggleBlinking}
          className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-colors ${
            blinking
              ? 'bg-sky-950/70 border-sky-400 text-sky-300'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span>پلک‌زدن خودکار</span>
          </div>
          <span className="font-mono text-[10px]">{blinking ? 'روشن' : 'خاموش'}</span>
        </button>

        {/* Head Tracking */}
        <button
          onClick={onToggleHeadTracking}
          className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-colors ${
            headTracking
              ? 'bg-sky-950/70 border-sky-400 text-sky-300'
              : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <MousePointer className="w-3.5 h-3.5" />
            <span>نگاه به ماوس (Head Tracking)</span>
          </div>
          <span className="font-mono text-[10px]">{headTracking ? 'روشن' : 'خاموش'}</span>
        </button>
      </div>
    </div>
  );
}
