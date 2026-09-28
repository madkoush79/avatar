'use client';

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CharacterItem, FigurePose, StudioEnvironment, CameraPreset, FacialExpression } from '@/lib/types';
import { RiggedAvatar, buildRiggedAvatar, applyPoseToRig, updateRigPose, applyMorphTargets } from '@/lib/avatar-rig';
import { Loader2, Maximize2, RotateCcw, Camera, Eye, Zap, Volume2, AlertTriangle, RefreshCw } from 'lucide-react';

export interface AvatarViewportHandle {
  captureSnapshot: (transparent?: boolean) => string | null;
  resetCamera: () => void;
  setCameraPreset: (preset: CameraPreset) => void;
}

interface AvatarViewportProps {
  character: CharacterItem;
  figure: FigurePose;
  mirrorPose?: boolean;
  environment: StudioEnvironment;
  cameraPreset: CameraPreset;
  expressions: FacialExpression;
  autoRotate?: boolean;
  breathing?: boolean;
  blinking?: boolean;
  headTracking?: boolean;
  transitionSpeed?: number; // 0.05 (slow) to 0.2 (fast)
  isSpeaking?: boolean;
  onLoaded?: () => void;
  onError?: (msg: string) => void;
}

export const AvatarViewport = forwardRef<AvatarViewportHandle, AvatarViewportProps>(function AvatarViewport(
  {
    character,
    figure,
    mirrorPose = false,
    environment,
    cameraPreset,
    expressions,
    autoRotate = false,
    breathing = true,
    blinking = true,
    headTracking = true,
    transitionSpeed = 0.08,
    isSpeaking = false,
    onLoaded,
    onError,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [activeBoneCount, setActiveBoneCount] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const currentLoadIdRef = useRef<number>(0);

  // Three.js internal references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rigRef = useRef<RiggedAvatar | null>(null);
  const currentModelRef = useRef<THREE.Object3D | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    keyLight: THREE.DirectionalLight;
    rimLight: THREE.DirectionalLight;
    fillLight: THREE.PointLight;
  } | null>(null);

  // Camera animation target
  const camTargetPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.2, 2.6));
  const camLookTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.9, 0));

  // Blinking loop timer
  const blinkState = useRef<{ isBlinking: boolean; nextBlinkTime: number; blinkProgress: number }>({
    isBlinking: false,
    nextBlinkTime: Date.now() + 2500,
    blinkProgress: 0,
  });

  // Animation and callback refs so they never trigger re-instantiation of WebGL or re-loading of model
  const autoRotateRef = useRef(autoRotate);
  const blinkingRef = useRef(blinking);
  const breathingRef = useRef(breathing);
  const headTrackingRef = useRef(headTracking);
  const transitionSpeedRef = useRef(transitionSpeed);
  const onLoadedRef = useRef(onLoaded);
  const onErrorRef = useRef(onError);
  const loadedModelUrlRef = useRef<string | null>(null);
  const characterRef = useRef(character);

  const isSpeakingRef = useRef(isSpeaking);
  const speakingWeightRef = useRef(0);

  useEffect(() => {
    characterRef.current = character;
    autoRotateRef.current = autoRotate;
    blinkingRef.current = blinking;
    breathingRef.current = breathing;
    headTrackingRef.current = headTracking;
    transitionSpeedRef.current = transitionSpeed;
    onLoadedRef.current = onLoaded;
    onErrorRef.current = onError;
    isSpeakingRef.current = isSpeaking;
  }, [character, autoRotate, blinking, breathing, headTracking, transitionSpeed, isSpeaking, onLoaded, onError]);

  // Expressions Ref for render loop access without re-init
  const expressionsRef = useRef<FacialExpression>(expressions);
  useEffect(() => {
    expressionsRef.current = expressions;
  }, [expressions]);

  // Mouse look-at offset for head tracking
  const mouseOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Camera presets coordinates
  const getCameraCoordinates = useCallback((preset: CameraPreset) => {
    switch (preset) {
      case 'portrait':
        return { pos: new THREE.Vector3(0, 1.55, 0.75), look: new THREE.Vector3(0, 1.5, 0) };
      case 'bust':
        return { pos: new THREE.Vector3(0, 1.35, 1.45), look: new THREE.Vector3(0, 1.25, 0) };
      case 'low_hero':
        return { pos: new THREE.Vector3(0, 0.35, 2.1), look: new THREE.Vector3(0, 1.05, 0) };
      case 'top_view':
        return { pos: new THREE.Vector3(0, 2.6, 1.7), look: new THREE.Vector3(0, 0.9, 0) };
      case 'full':
      default:
        return { pos: new THREE.Vector3(0, 1.15, 2.7), look: new THREE.Vector3(0, 0.88, 0) };
    }
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    captureSnapshot: (transparent = false) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!renderer || !scene || !camera) return null;

      const prevBg = scene.background;
      if (transparent) {
        scene.background = null;
        renderer.setClearAlpha(0);
      }
      renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');

      // Restore background
      scene.background = prevBg;
      renderer.setClearAlpha(1);
      return dataUrl;
    },
    resetCamera: () => {
      const coords = getCameraCoordinates('full');
      camTargetPos.current.copy(coords.pos);
      camLookTarget.current.copy(coords.look);
      if (controlsRef.current) {
        controlsRef.current.target.copy(coords.look);
      }
    },
    setCameraPreset: (preset: CameraPreset) => {
      const coords = getCameraCoordinates(preset);
      camTargetPos.current.copy(coords.pos);
      camLookTarget.current.copy(coords.look);
    },
  }));

  // Update camera target when cameraPreset changes
  useEffect(() => {
    const coords = getCameraCoordinates(cameraPreset);
    camTargetPos.current.copy(coords.pos);
    camLookTarget.current.copy(coords.look);
  }, [cameraPreset, getCameraCoordinates]);

  // Pointer move for head tracking
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!headTracking || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    mouseOffset.current = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  };

  const handlePointerLeave = () => {
    mouseOffset.current = { x: 0, y: 0 };
  };

  // 1. Initialize Three.js Scene, Camera, Renderer, Controls
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.2, 2.6);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 6.0;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // don't go below floor
    controls.target.set(0, 0.9, 0);
    controlsRef.current = controls;

    // Lighting Rig
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(1.8, 3.2, 2.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 1.8);
    rimLight.position.set(-2, 2.5, -2);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xffeedd, 1.2, 10);
    fillLight.position.set(0, 1.5, 2.5);
    scene.add(fillLight);

    lightsRef.current = { ambient, keyLight, rimLight, fillLight };

    // Grid Floor
    const grid = new THREE.GridHelper(10, 20, 0x38bdf8, 0x1e293b);
    grid.position.y = -0.001;
    scene.add(grid);
    gridHelperRef.current = grid;

    // Floor shadow receiver disc
    const floorGeo = new THREE.CircleGeometry(3.5, 48);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth camera interpolation towards target preset
      if (camera && controls) {
        camera.position.lerp(camTargetPos.current, 0.06);
        controls.target.lerp(camLookTarget.current, 0.06);
        controls.autoRotate = autoRotateRef.current;
        controls.autoRotateSpeed = 1.5;
        controls.update();
      }

      // Update Rigged Avatar bones & physics
      if (rigRef.current) {
        // Natural blinking
        let eyeBlink = 0;
        if (blinkingRef.current) {
          const now = Date.now();
          if (!blinkState.current.isBlinking && now > blinkState.current.nextBlinkTime) {
            blinkState.current.isBlinking = true;
            blinkState.current.blinkProgress = 0;
          }
          if (blinkState.current.isBlinking) {
            blinkState.current.blinkProgress += delta * 7;
            if (blinkState.current.blinkProgress >= 1) {
              blinkState.current.isBlinking = false;
              blinkState.current.nextBlinkTime = now + 2500 + Math.random() * 3000;
              eyeBlink = 0;
            } else {
              eyeBlink = Math.sin(blinkState.current.blinkProgress * Math.PI);
            }
          }
        }

        // Combine user expressions with auto-blinking
        const activeExpressions: FacialExpression = {
          ...expressionsRef.current,
          eyeBlinkLeft: Math.max(expressionsRef.current.eyeBlinkLeft, eyeBlink),
          eyeBlinkRight: Math.max(expressionsRef.current.eyeBlinkRight, eyeBlink),
        };

        // Dynamic speaking weight interpolation (gentle, smooth fade)
        const targetWeight = isSpeakingRef.current ? 1.0 : 0.0;
        speakingWeightRef.current = THREE.MathUtils.lerp(
          speakingWeightRef.current,
          targetWeight,
          Math.min(1.0, delta * 3.0)
        );

        const curExpr = expressionsRef.current;
        const isPaused = curExpr.isSpeechPaused ?? (curExpr.viseme_sil === 1 && (curExpr.mouthOpen ?? 0) <= 0.03);
        const speechVolume = curExpr.speechVolume ?? (curExpr.mouthOpen && curExpr.mouthOpen > 0.05 ? curExpr.mouthOpen : 0.5);

        // Smoothly interpolate bones towards figure pose with conversational speaking motion
        updateRigPose(
          rigRef.current,
          transitionSpeedRef.current,
          breathingRef.current,
          time,
          headTrackingRef.current ? mouseOffset.current : undefined,
          {
            isSpeaking: isSpeakingRef.current,
            speakingWeight: speakingWeightRef.current,
            audioVolume: speechVolume,
            isPaused,
          }
        );

        // Apply facial expressions & visemes to 3D meshes with real-time sound pause synchronization
        applyMorphTargets(rigRef.current, activeExpressions, time);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // 2. Update Environment / Background / Lighting
  useEffect(() => {
    const scene = sceneRef.current;
    const lights = lightsRef.current;
    const grid = gridHelperRef.current;
    if (!scene || !lights) return;

    switch (environment) {
      case 'dark_cyber':
        scene.background = new THREE.Color(0x090d16);
        lights.ambient.color.setHex(0x1e293b);
        lights.ambient.intensity = 1.0;
        lights.keyLight.color.setHex(0x38bdf8);
        lights.keyLight.intensity = 2.4;
        lights.rimLight.color.setHex(0xa855f7);
        lights.rimLight.intensity = 2.0;
        lights.fillLight.color.setHex(0x06b6d4);
        if (grid) {
          grid.visible = true;
          (grid.material as THREE.LineBasicMaterial).color.setHex(0x38bdf8);
        }
        break;

      case 'minimal_studio':
        scene.background = new THREE.Color(0xe2e8f0);
        lights.ambient.color.setHex(0xffffff);
        lights.ambient.intensity = 1.2;
        lights.keyLight.color.setHex(0xfffaf0);
        lights.keyLight.intensity = 2.2;
        lights.rimLight.color.setHex(0x94a3b8);
        lights.rimLight.intensity = 1.0;
        lights.fillLight.color.setHex(0xffffff);
        if (grid) {
          grid.visible = true;
          (grid.material as THREE.LineBasicMaterial).color.setHex(0x94a3b8);
        }
        break;

      case 'sunset_gold':
        scene.background = new THREE.Color(0x271912);
        lights.ambient.color.setHex(0x451a03);
        lights.ambient.intensity = 1.1;
        lights.keyLight.color.setHex(0xfbbf24);
        lights.keyLight.intensity = 2.8;
        lights.rimLight.color.setHex(0xf97316);
        lights.rimLight.intensity = 2.2;
        lights.fillLight.color.setHex(0xfde047);
        if (grid) {
          grid.visible = true;
          (grid.material as THREE.LineBasicMaterial).color.setHex(0xf59e0b);
        }
        break;

      case 'matrix_grid':
        scene.background = new THREE.Color(0x021508);
        lights.ambient.color.setHex(0x064e3b);
        lights.ambient.intensity = 0.9;
        lights.keyLight.color.setHex(0x22c55e);
        lights.keyLight.intensity = 2.5;
        lights.rimLight.color.setHex(0x10b981);
        lights.rimLight.intensity = 2.0;
        lights.fillLight.color.setHex(0x4ade80);
        if (grid) {
          grid.visible = true;
          (grid.material as THREE.LineBasicMaterial).color.setHex(0x22c55e);
        }
        break;

      case 'green_screen':
        scene.background = new THREE.Color(0x00ff00);
        lights.ambient.color.setHex(0xffffff);
        lights.ambient.intensity = 1.5;
        lights.keyLight.color.setHex(0xffffff);
        lights.keyLight.intensity = 2.0;
        lights.rimLight.color.setHex(0xffffff);
        lights.rimLight.intensity = 0.5;
        if (grid) grid.visible = false;
        break;

      case 'transparent':
        scene.background = null;
        lights.ambient.color.setHex(0xffffff);
        lights.ambient.intensity = 1.2;
        lights.keyLight.color.setHex(0xffffff);
        lights.keyLight.intensity = 2.2;
        lights.rimLight.color.setHex(0x94a3b8);
        lights.rimLight.intensity = 1.0;
        if (grid) grid.visible = false;
        break;
    }
  }, [environment]);

  const figureRef = useRef(figure);
  const mirrorPoseRef = useRef(mirrorPose);
  useEffect(() => {
    figureRef.current = figure;
    mirrorPoseRef.current = mirrorPose;
  }, [figure, mirrorPose]);

  // 3. Load GLTF Model when character changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // If this model is already loaded and active, never reload!
    if (loadedModelUrlRef.current === character.modelUrl && currentModelRef.current && rigRef.current) {
      return;
    }

    const loadId = ++currentLoadIdRef.current;
    setLoading(true);
    setLoadProgress(0);
    setLoadError(null);

    // Remove previous model if any
    if (currentModelRef.current) {
      scene.remove(currentModelRef.current);
      currentModelRef.current = null;
      rigRef.current = null;
    }

    const loader = new GLTFLoader();

    // Enable MeshoptDecoder (required for VRoid and compressed models)
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    // Enable DRACOLoader
    try {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      loader.setDRACOLoader(dracoLoader);
    } catch (e) {
      console.warn('DracoLoader init warning:', e);
    }

    loader.load(
      character.modelUrl,
      (gltf) => {
        // Prevent stale in-flight loads from overriding current character
        if (loadId !== currentLoadIdRef.current) return;

        const model = gltf.scene;

        // Position feet directly on floor
        const bbox = new THREE.Box3().setFromObject(model);
        if (bbox.min.y !== 0) {
          model.position.y = -bbox.min.y;
        }

        // Enable shadows and configure mesh properties
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            const mesh = o as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
          }
        });

        scene.add(model);
        currentModelRef.current = model;
        loadedModelUrlRef.current = character.modelUrl;

        // Build rigged skeleton
        const rig = buildRiggedAvatar(model);
        rigRef.current = rig;
        setActiveBoneCount(rig.bones.size);

        // Apply current figure from ref
        applyPoseToRig(rig, figureRef.current.props, mirrorPoseRef.current, characterRef.current.retarget);

        setLoading(false);
        setLoadProgress(100);
        setLoadError(null);
        onLoadedRef.current?.();
      },
      (xhr) => {
        if (loadId !== currentLoadIdRef.current) return;
        if (xhr.total > 0) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          setLoadProgress(pct);
        }
      },
      (err: unknown) => {
        if (loadId !== currentLoadIdRef.current) return;
        setLoading(false);
        const errMessage = err instanceof Error ? err.message : String(err);
        const errMsg = `خطا در بارگذاری کاراکتر ${characterRef.current.nameFa}: ${errMessage || 'مشکل در لود فایل ۳ بعدی'}`;
        setLoadError(errMsg);
        onErrorRef.current?.(errMsg);
      }
    );
  }, [character.id, character.modelUrl, retryCount]);

  // 4. Update Figure Pose when figure or mirror changes
  useEffect(() => {
    if (!rigRef.current) return;
    applyPoseToRig(rigRef.current, figure.props, mirrorPose, character.retarget);
  }, [figure, figure.props, mirrorPose, character.retarget]);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full h-full min-h-[460px] lg:min-h-[580px] bg-slate-950 overflow-hidden select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md text-white transition-opacity duration-300">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full border-4 border-sky-500/20 border-t-sky-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-6 h-6 text-sky-400 animate-pulse" />
            </div>
          </div>
          <p className="text-base font-medium text-slate-100 mb-1">
            در حال بارگذاری کاراکتر {character.nameFa}...
          </p>
          <div className="w-56 h-2 bg-slate-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-200"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {loadProgress > 0 ? `${loadProgress}% (${character.fileSize})` : 'آماده‌سازی هندسه ۳ بعدی...'}
          </span>
        </div>
      )}

      {/* Error Overlay */}
      {!loading && loadError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md text-white p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-3">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-slate-100 mb-1">خطا در نمایش کاراکتر</h4>
          <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed font-mono">{loadError}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>تلاش مجدد برای بارگذاری</span>
          </button>
        </div>
      )}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">{character.name}</span>
          <span className="text-slate-500">·</span>
          <span>{figure.nameFa}</span>
          {activeBoneCount > 0 && (
            <>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 font-mono">{activeBoneCount} استخوان فعال</span>
            </>
          )}
        </div>
      </div>

      {/* Speaking & Live Pause Indicator */}
      {isSpeaking && (
        <div className={`absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium shadow-lg transition-all ${
          expressions.isSpeechPaused
            ? 'bg-amber-500/90 text-slate-950 shadow-amber-500/20'
            : 'bg-emerald-500/95 text-white shadow-emerald-500/20 animate-pulse'
        }`}>
          <Volume2 className={`w-4 h-4 ${expressions.isSpeechPaused ? '' : 'animate-bounce'}`} />
          <span>
            {expressions.isSpeechPaused
              ? 'مکث طبیعی صدا (Natural Pause)'
              : 'معلم در حال گفتار انگلیسی و لب‌خوانی زنده'}
          </span>
        </div>
      )}

      {/* Subtle Hint */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden sm:flex items-center gap-3 text-[11px] text-slate-400 bg-slate-900/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-800">
        <span>🖱️ کلیک و درگ: چرخش ۳۶۰°</span>
        <span>·</span>
        <span>اسکرول: زوم</span>
        <span>·</span>
        <span>راست کلیک: جابجایی (Pan)</span>
      </div>
    </div>
  );
});
