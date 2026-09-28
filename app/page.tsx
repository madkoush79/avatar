'use client';

import React, { useState, useRef, useCallback } from 'react';
import { AvatarViewport, AvatarViewportHandle } from '@/components/AvatarViewport';
import { Header } from '@/components/Header';
import { CharacterSelector } from '@/components/CharacterSelector';
import { FigureSelector } from '@/components/FigureSelector';
import { SpeechStudio } from '@/components/SpeechStudio';
import { LiveEnglishTeacher } from '@/components/LiveEnglishTeacher';
import { ExpressionStudio } from '@/components/ExpressionStudio';
import { EnvironmentStudio } from '@/components/EnvironmentStudio';
import { FigureCardModal } from '@/components/FigureCardModal';
import { FigureGalleryModal } from '@/components/FigureGalleryModal';
import { TALKING_HEAD_CHARACTERS } from '@/lib/characters-data';
import { TEN_FIGURE_POSES } from '@/lib/figures-data';
import { 
  CharacterItem, 
  FigurePose, 
  StudioEnvironment, 
  CameraPreset, 
  FacialExpression 
} from '@/lib/types';
import { 
  Activity, 
  Users, 
  Volume2, 
  Smile, 
  Sun, 
  Camera, 
  Sparkles, 
  Layers, 
  Check, 
  FlipHorizontal,
  ChevronLeft,
  ChevronRight,
  Info,
  GraduationCap,
  Radio
} from 'lucide-react';

export default function TalkingHeadStudioPage() {
  const viewportRef = useRef<AvatarViewportHandle | null>(null);

  // Active States
  const [character, setCharacter] = useState<CharacterItem>(TALKING_HEAD_CHARACTERS[0]);
  const [figure, setFigure] = useState<FigurePose>(TEN_FIGURE_POSES[0]);
  const [mirrorPose, setMirrorPose] = useState<boolean>(false);
  const [environment, setEnvironment] = useState<StudioEnvironment>('dark_cyber');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('full');
  const [transitionSpeed, setTransitionSpeed] = useState<number>(0.08);

  // Physics & Automation
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [breathing, setBreathing] = useState<boolean>(true);
  const [blinking, setBlinking] = useState<boolean>(true);
  const [headTracking, setHeadTracking] = useState<boolean>(true);

  // Facial Expressions & Speech
  const [expressions, setExpressions] = useState<FacialExpression>({
    mouthSmile: 0,
    mouthOpen: 0,
    jawOpen: 0,
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    browInnerUp: 0,
    viseme_aa: 0,
    viseme_O: 0,
    viseme_E: 0,
    viseme_I: 0,
  });
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Active Tab in Sidebar
  const [activeTab, setActiveTab] = useState<'live' | 'figures' | 'characters' | 'speech' | 'expressions' | 'environment'>('live');

  // Modals
  const [galleryOpen, setGalleryOpen] = useState<boolean>(false);
  const [cardModalOpen, setCardModalOpen] = useState<boolean>(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  // Handlers
  const handleSelectCharacter = (newChar: CharacterItem) => {
    setCharacter(newChar);
    // Find matching default pose if any
    const defaultFig = TEN_FIGURE_POSES.find((f) => f.id === newChar.defaultPose);
    if (defaultFig) setFigure(defaultFig);
  };

  const handleCustomAvatar = (url: string, name: string) => {
    const customItem: CharacterItem = {
      id: `custom_${Date.now()}`,
      name: name || 'Custom Model',
      nameFa: name || 'کاراکتر سفارشی شما',
      source: 'User Upload / RPM',
      modelUrl: url,
      bodyType: 'F',
      style: 'Custom GLB',
      styleFa: 'مدل سفارشی کاربر',
      tagFa: 'بارگذاری اختصاصی',
      description: 'Custom user-provided 3D model with full figure rigging.',
      descriptionFa: 'مدل بارگذاری شده توسط کاربر با قابلیت اعمال تمام ۱۰ فیگور و لب‌خوانی.',
      fileSize: 'Custom',
      features: ['Full Rigging Support', '10 Figures Compatible'],
      featuresFa: ['پشتیبانی ریگ کامل', 'سازگار با ۱۰ فیگور'],
      defaultPose: 'straight',
    };
    setCharacter(customItem);
  };

  const handleUpdateExpressions = useCallback((partial: Partial<FacialExpression>) => {
    setExpressions((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleResetExpressions = useCallback(() => {
    setExpressions({
      mouthSmile: 0,
      mouthOpen: 0,
      jawOpen: 0,
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0,
      browInnerUp: 0,
      viseme_aa: 0,
      viseme_O: 0,
      viseme_E: 0,
      viseme_I: 0,
      viseme_PP: 0,
      viseme_FF: 0,
      viseme_SS: 0,
      viseme_CH: 0,
      viseme_kk: 0,
      viseme_DD: 0,
      viseme_nn: 0,
      viseme_RR: 0,
      viseme_U: 0,
      viseme_sil: 1,
    });
  }, []);

  const handleError = useCallback((msg: string) => {
    console.warn(msg);
  }, []);

  const handleTakeSnapshot = (transparent = false) => {
    if (!viewportRef.current) return;
    const url = viewportRef.current.captureSnapshot(transparent);
    if (url) {
      setSnapshotUrl(url);
      setCardModalOpen(true);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        character={character}
        figure={figure}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={setCameraPreset}
        onResetCamera={() => viewportRef.current?.resetCamera()}
        onOpenFigureGallery={() => setGalleryOpen(true)}
        onTakeSnapshot={handleTakeSnapshot}
      />

      {/* Main Studio Work Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left: 3D Viewport Canvas */}
        <section className="flex-1 relative flex flex-col min-h-[500px] lg:min-h-0 bg-slate-950">
          <div className="flex-1 w-full h-full relative">
            <AvatarViewport
              ref={viewportRef}
              character={character}
              figure={figure}
              mirrorPose={mirrorPose}
              environment={environment}
              cameraPreset={cameraPreset}
              expressions={expressions}
              autoRotate={autoRotate}
              breathing={breathing}
              blinking={blinking}
              headTracking={headTracking}
              transitionSpeed={transitionSpeed}
              isSpeaking={isSpeaking}
              onError={handleError}
            />

            {/* Quick 10-Figure Bottom Carousel (Floating Bar) */}
            <div className="absolute bottom-4 inset-x-4 z-10 flex justify-center pointer-events-none">
              <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/70 p-2 rounded-2xl shadow-2xl max-w-4xl w-full flex items-center justify-between gap-2 overflow-x-auto">
                <div className="flex items-center gap-1.5 shrink-0 px-2 text-xs text-slate-300 font-semibold border-l border-slate-800">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">۱۰ فیگور:</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                  {TEN_FIGURE_POSES.map((fig) => {
                    const isSelected = figure.id === fig.id;
                    return (
                      <button
                        key={fig.id}
                        onClick={() => setFigure(fig)}
                        className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20 scale-105'
                            : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white'
                        }`}
                      >
                        <span className="font-mono text-[10px] opacity-80">0{fig.index}</span>
                        <span>{fig.nameFa.split(':')[1]?.trim() || fig.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Mirror toggle quick button */}
                <button
                  onClick={() => setMirrorPose(!mirrorPose)}
                  className={`p-2 rounded-xl shrink-0 transition-colors ${
                    mirrorPose
                      ? 'bg-sky-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="قرینه کردن فیگور"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Control Dock */}
        <aside className="w-full lg:w-[420px] xl:w-[460px] bg-slate-950 border-t lg:border-t-0 lg:border-r border-slate-800/80 flex flex-col shrink-0 max-h-[85vh] lg:max-h-none overflow-hidden">
          {/* Studio Tab Navigation */}
          <nav className="flex items-center bg-slate-900/80 border-b border-slate-800/80 p-1.5 gap-1 overflow-x-auto shrink-0">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'live'
                  ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-sky-500/20 text-emerald-300 shadow-sm border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>معلم لایو (Live)</span>
            </button>

            <button
              onClick={() => setActiveTab('figures')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'figures'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>۱۰ فیگور</span>
            </button>

            <button
              onClick={() => setActiveTab('characters')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'characters'
                  ? 'bg-slate-800 text-sky-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>کاراکترها</span>
            </button>

            <button
              onClick={() => setActiveTab('speech')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'speech'
                  ? 'bg-slate-800 text-rose-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>لب‌خوانی</span>
            </button>

            <button
              onClick={() => setActiveTab('expressions')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'expressions'
                  ? 'bg-slate-800 text-amber-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>میمیک</span>
            </button>

            <button
              onClick={() => setActiveTab('environment')}
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all ${
                activeTab === 'environment'
                  ? 'bg-slate-800 text-indigo-400 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
              <span>استودیو</span>
            </button>
          </nav>

          {/* Tab Content Panels */}
          <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
            {activeTab === 'live' && (
              <LiveEnglishTeacher
                onUpdateVisemes={handleUpdateExpressions}
                isSpeaking={isSpeaking}
                setIsSpeaking={setIsSpeaking}
                characterName={character.nameFa || character.name}
              />
            )}

            {activeTab === 'figures' && (
              <FigureSelector
                selectedFigure={figure}
                onSelectFigure={setFigure}
                mirrorPose={mirrorPose}
                onToggleMirror={() => setMirrorPose(!mirrorPose)}
                transitionSpeed={transitionSpeed}
                onChangeTransitionSpeed={setTransitionSpeed}
              />
            )}

            {activeTab === 'characters' && (
              <CharacterSelector
                selectedCharacter={character}
                onSelectCharacter={handleSelectCharacter}
                onCustomAvatarUrl={handleCustomAvatar}
              />
            )}

            {activeTab === 'speech' && (
              <SpeechStudio
                onUpdateVisemes={handleUpdateExpressions}
                isSpeaking={isSpeaking}
                setIsSpeaking={setIsSpeaking}
              />
            )}

            {activeTab === 'expressions' && (
              <ExpressionStudio
                expressions={expressions}
                onUpdateExpression={handleUpdateExpressions}
                onResetExpressions={handleResetExpressions}
              />
            )}

            {activeTab === 'environment' && (
              <EnvironmentStudio
                environment={environment}
                onChangeEnvironment={setEnvironment}
                autoRotate={autoRotate}
                onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
                breathing={breathing}
                onToggleBreathing={() => setBreathing(!breathing)}
                blinking={blinking}
                onToggleBlinking={() => setBlinking(!blinking)}
                headTracking={headTracking}
                onToggleHeadTracking={() => setHeadTracking(!headTracking)}
              />
            )}
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-3 bg-slate-900/50 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-300">{character.name}</span>
              <span>·</span>
              <span className="text-emerald-400 font-mono">فیگور 0{figure.index}</span>
            </div>
            <button
              onClick={() => handleTakeSnapshot(false)}
              className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium"
            >
              <Camera className="w-3 h-3" />
              <span>خروجی کارت</span>
            </button>
          </div>
        </aside>
      </main>

      {/* Modals */}
      <FigureGalleryModal
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        selectedFigure={figure}
        character={character}
        onSelectFigure={setFigure}
      />

      <FigureCardModal
        isOpen={cardModalOpen}
        onClose={() => setCardModalOpen(false)}
        snapshotUrl={snapshotUrl}
        character={character}
        figure={figure}
      />
    </div>
  );
}
