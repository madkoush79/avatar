'use client';

import React from 'react';
import { FigurePose, CharacterItem } from '@/lib/types';
import { TEN_FIGURE_POSES } from '@/lib/figures-data';
import { X, Play, Check, Activity, Sparkles } from 'lucide-react';

interface FigureGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFigure: FigurePose;
  character: CharacterItem;
  onSelectFigure: (fig: FigurePose) => void;
}

export function FigureGalleryModal({
  isOpen,
  onClose,
  selectedFigure,
  character,
  onSelectFigure,
}: FigureGalleryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
              <Sparkles className="w-4 h-4" />
              <span>ماتریس ۱۰ فیگور کاراکتر {character.name}</span>
            </div>
            <h3 className="text-lg font-bold text-white">
              کاتالوگ جامع فیگورهای طراحی‌شده برای کاراکتر
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 10 Figures Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto py-4 pr-1">
          {TEN_FIGURE_POSES.map((fig) => {
            const isSelected = selectedFigure.id === fig.id;
            return (
              <button
                key={fig.id}
                onClick={() => {
                  onSelectFigure(fig);
                  onClose();
                }}
                className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between relative group ${
                  isSelected
                    ? 'bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-400/40 shadow-lg'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
                      0{fig.index}
                    </span>
                    <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                      {fig.name}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 mb-1">{fig.nameFa}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{fig.descriptionFa}</p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-medium text-[11px]">{fig.badgeFa}</span>
                  <span className="text-[10px] text-slate-400">
                    {fig.sitting ? 'نشسته' : fig.kneeling ? 'روی زانو' : 'ایستاده'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>برای اعمال هر فیگور روی کاراکتر فعلی، روی کارت آن کلیک کنید.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            بستن کاتالوگ
          </button>
        </div>
      </div>
    </div>
  );
}
