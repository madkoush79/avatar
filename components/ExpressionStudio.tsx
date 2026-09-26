'use client';

import React from 'react';
import { FacialExpression } from '@/lib/types';
import { Smile, Frown, Meh, Eye, Sparkles, RotateCcw } from 'lucide-react';

interface ExpressionStudioProps {
  expressions: FacialExpression;
  onUpdateExpression: (exp: Partial<FacialExpression>) => void;
  onResetExpressions: () => void;
}

export function ExpressionStudio({
  expressions,
  onUpdateExpression,
  onResetExpressions,
}: ExpressionStudioProps) {
  const presets = [
    {
      name: 'خنثی (Neutral)',
      exp: { mouthSmile: 0, mouthOpen: 0, jawOpen: 0, browInnerUp: 0, eyeBlinkLeft: 0, eyeBlinkRight: 0 },
    },
    {
      name: 'لبخند زیبا (Happy)',
      exp: { mouthSmile: 0.75, mouthOpen: 0.1, jawOpen: 0, browInnerUp: 0.2, eyeBlinkLeft: 0, eyeBlinkRight: 0 },
    },
    {
      name: 'متعجب (Surprised)',
      exp: { mouthSmile: 0, mouthOpen: 0.6, jawOpen: 0.5, browInnerUp: 0.85, eyeBlinkLeft: 0, eyeBlinkRight: 0 },
    },
    {
      name: 'با اعتمادبه‌نفس (Confident)',
      exp: { mouthSmile: 0.45, mouthOpen: 0, jawOpen: 0, browInnerUp: 0.15, eyeBlinkLeft: 0, eyeBlinkRight: 0 },
    },
    {
      name: 'چشمک چپ (Wink Left)',
      exp: { mouthSmile: 0.4, mouthOpen: 0, jawOpen: 0, browInnerUp: 0.1, eyeBlinkLeft: 1.0, eyeBlinkRight: 0 },
    },
    {
      name: 'چشمک راست (Wink Right)',
      exp: { mouthSmile: 0.4, mouthOpen: 0, jawOpen: 0, browInnerUp: 0.1, eyeBlinkLeft: 0, eyeBlinkRight: 1.0 },
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smile className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-slate-100">احساسات و میمیک چهره (Facial Blendshapes)</h3>
        </div>
        <button
          onClick={onResetExpressions}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>حالت خنثی</span>
        </button>
      </div>

      {/* Preset Emotion Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {presets.map((p, idx) => (
          <button
            key={idx}
            onClick={() => onUpdateExpression(p.exp)}
            className="p-2 text-xs rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300 transition-colors text-right"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2.5 text-xs text-slate-300">
        {/* Smile Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>شدت لبخند (mouthSmile):</span>
            <span className="font-mono">{Math.round(expressions.mouthSmile * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={expressions.mouthSmile}
            onChange={(e) => onUpdateExpression({ mouthSmile: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Mouth Open Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>باز شدن دهان (mouthOpen):</span>
            <span className="font-mono">{Math.round(expressions.mouthOpen * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={expressions.mouthOpen}
            onChange={(e) => onUpdateExpression({ mouthOpen: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>

        {/* Eyebrows */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>بالا بردن ابرو (browInnerUp):</span>
            <span className="font-mono">{Math.round(expressions.browInnerUp * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={expressions.browInnerUp}
            onChange={(e) => onUpdateExpression({ browInnerUp: parseFloat(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
