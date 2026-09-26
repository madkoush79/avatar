export type BoneTransform = {
  x: number;
  y: number;
  z: number;
};

export type PoseProps = {
  [key: string]: BoneTransform;
};

export interface FigurePose {
  id: string;
  index: number;
  name: string;
  nameFa: string;
  category: 'formal' | 'casual' | 'action' | 'expressive' | 'special';
  badgeFa: string;
  description: string;
  descriptionFa: string;
  props: PoseProps;
  standing?: boolean;
  sitting?: boolean;
  kneeling?: boolean;
  cameraFocus?: 'full' | 'bust' | 'portrait';
}

export interface CharacterItem {
  id: string;
  name: string;
  nameFa: string;
  source: string;
  modelUrl: string;
  bodyType: 'F' | 'M';
  style: string;
  styleFa: string;
  tagFa: string;
  description: string;
  descriptionFa: string;
  fileSize: string;
  features: string[];
  featuresFa: string[];
  defaultPose: string;
  baseline?: {
    headRotateX?: number;
    eyeBlinkLeft?: number;
    eyeBlinkRight?: number;
  };
  retarget?: {
    [key: string]: {
      x?: number;
      y?: number;
      z?: number;
      rx?: number;
      ry?: number;
      rz?: number;
    };
  };
}

export type StudioEnvironment = 
  | 'dark_cyber'
  | 'minimal_studio'
  | 'sunset_gold'
  | 'matrix_grid'
  | 'green_screen'
  | 'transparent';

export type CameraPreset = 'full' | 'bust' | 'portrait' | 'low_hero' | 'top_view';

export interface FacialExpression {
  mouthSmile: number;
  mouthOpen: number;
  jawOpen: number;
  eyeBlinkLeft: number;
  eyeBlinkRight: number;
  browInnerUp: number;
  // Oculus LipSync Visemes
  viseme_aa: number;
  viseme_O: number;
  viseme_E: number;
  viseme_I: number;
  viseme_U?: number;
  viseme_PP?: number;
  viseme_FF?: number;
  viseme_TH?: number;
  viseme_DD?: number;
  viseme_kk?: number;
  viseme_CH?: number;
  viseme_SS?: number;
  viseme_nn?: number;
  viseme_RR?: number;
  viseme_sil?: number;
  // Live speech & audio envelope properties
  speechVolume?: number; // 0.0 to 1.0 real-time volume envelope
  isSpeechPaused?: boolean; // true during sound pauses/silences
}
