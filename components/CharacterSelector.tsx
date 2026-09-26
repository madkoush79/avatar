'use client';

import React, { useState } from 'react';
import { CharacterItem } from '@/lib/types';
import { TALKING_HEAD_CHARACTERS } from '@/lib/characters-data';
import { Users, Upload, Sparkles, Check, Info } from 'lucide-react';

interface CharacterSelectorProps {
  selectedCharacter: CharacterItem;
  onSelectCharacter: (char: CharacterItem) => void;
  onCustomAvatarUrl?: (url: string, name: string) => void;
}

export function CharacterSelector({
  selectedCharacter,
  onSelectCharacter,
  onCustomAvatarUrl,
}: CharacterSelectorProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    onCustomAvatarUrl?.(customUrlInput.trim(), 'کاراکتر سفارشی (Custom RPM)');
    setShowCustomModal(false);
    setCustomUrlInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    onCustomAvatarUrl?.(blobUrl, file.name.replace('.glb', ''));
    setShowCustomModal(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-100">کاراکترهای پروژه TalkingHead</h3>
        </div>
        <button
          onClick={() => setShowCustomModal(true)}
          className="text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 font-medium"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>آپلود کاراکتر دلخواه</span>
        </button>
      </div>

      {/* Grid of Characters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {TALKING_HEAD_CHARACTERS.map((char) => {
          const isSelected = selectedCharacter.id === char.id;
          return (
            <button
              key={char.id}
              onClick={() => onSelectCharacter(char)}
              className={`relative text-right p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                isSelected
                  ? 'bg-sky-950/60 border-sky-400/80 shadow-md shadow-sky-500/10 ring-1 ring-sky-400/40'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300'
              }`}
            >
              {/* Selected Tick Indicator */}
              {isSelected && (
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-semibold text-sm text-slate-100">{char.name}</span>
                  <span className="text-[10px] text-slate-400">({char.bodyType === 'F' ? 'زن' : 'مرد'})</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">{char.nameFa}</p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-sky-400/90 font-medium">{char.tagFa}</span>
                <span className="font-mono text-[10px] text-slate-400">{char.fileSize}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Avatar Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl text-right">
            <h4 className="text-base font-semibold text-slate-100 mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>بارگذاری آواتار سه‌بعدی سفارشی</span>
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              می‌توانید لینک Ready Player Me یا فایل سه‌بعدی GLB خود را بارگذاری کنید تا هر ۱۰ فیگور روی آن اعمال شود.
            </p>

            <form onSubmit={handleCustomSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">لینک مستقیم مدل GLB / Ready Player Me:</label>
                <input
                  type="url"
                  placeholder="https://models.readyplayer.me/...glb"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-left"
                />
              </div>

              <div className="flex items-center my-1">
                <div className="flex-1 border-t border-slate-800" />
                <span className="px-3 text-xs text-slate-500">یا</span>
                <div className="flex-1 border-t border-slate-800" />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">انتخاب فایل از روی کامپیوتر (.glb):</label>
                <input
                  type="file"
                  accept=".glb,.gltf"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={!customUrlInput.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-sky-500 hover:bg-sky-400 text-slate-950 disabled:opacity-50 transition-colors"
                >
                  اعمال کاراکتر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
