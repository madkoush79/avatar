import * as THREE from 'three';
import { PoseProps, FacialExpression } from './types';

// Aliases for humanoid bones across Ready Player Me, VRoid, Mixamo, MakeHuman
const BONE_ALIASES: Record<string, string[]> = {
  Hips: ['Hips', 'mixamorigHips', 'J_Bip_C_Hips', 'root_hips', 'pelvis'],
  Spine: ['Spine', 'mixamorigSpine', 'J_Bip_C_Spine', 'spine_01', 'spine'],
  Spine1: ['Spine1', 'mixamorigSpine1', 'J_Bip_C_Chest', 'spine_02', 'spine1'],
  Spine2: ['Spine2', 'mixamorigSpine2', 'J_Bip_C_UpperChest', 'spine_03', 'spine2'],
  Neck: ['Neck', 'mixamorigNeck', 'J_Bip_C_Neck', 'neck_01', 'neck'],
  Head: ['Head', 'mixamorigHead', 'J_Bip_C_Head', 'head'],
  
  LeftShoulder: ['LeftShoulder', 'mixamorigLeftShoulder', 'J_Bip_L_Shoulder', 'shoulder_l'],
  LeftArm: ['LeftArm', 'mixamorigLeftArm', 'J_Bip_L_UpperArm', 'upperarm_l', 'arm_l'],
  LeftForeArm: ['LeftForeArm', 'mixamorigLeftForeArm', 'J_Bip_L_LowerArm', 'lowerarm_l', 'forearm_l'],
  LeftHand: ['LeftHand', 'mixamorigLeftHand', 'J_Bip_L_Hand', 'hand_l'],

  RightShoulder: ['RightShoulder', 'mixamorigRightShoulder', 'J_Bip_R_Shoulder', 'shoulder_r'],
  RightArm: ['RightArm', 'mixamorigRightArm', 'J_Bip_R_UpperArm', 'upperarm_r', 'arm_r'],
  RightForeArm: ['RightForeArm', 'mixamorigRightForeArm', 'J_Bip_R_LowerArm', 'lowerarm_r', 'forearm_r'],
  RightHand: ['RightHand', 'mixamorigRightHand', 'J_Bip_R_Hand', 'hand_r'],

  LeftUpLeg: ['LeftUpLeg', 'mixamorigLeftUpLeg', 'J_Bip_L_UpperLeg', 'thigh_l', 'leg_l'],
  LeftLeg: ['LeftLeg', 'mixamorigLeftLeg', 'J_Bip_L_LowerLeg', 'calf_l', 'knee_l'],
  LeftFoot: ['LeftFoot', 'mixamorigLeftFoot', 'J_Bip_L_Foot', 'foot_l'],
  LeftToeBase: ['LeftToeBase', 'mixamorigLeftToeBase', 'J_Bip_L_ToeBase', 'toes_l'],

  RightUpLeg: ['RightUpLeg', 'mixamorigRightUpLeg', 'J_Bip_R_UpperLeg', 'thigh_r', 'leg_r'],
  RightLeg: ['RightLeg', 'mixamorigRightLeg', 'J_Bip_R_LowerLeg', 'calf_r', 'knee_r'],
  RightFoot: ['RightFoot', 'mixamorigRightFoot', 'J_Bip_R_Foot', 'foot_r'],
  RightToeBase: ['RightToeBase', 'mixamorigRightToeBase', 'J_Bip_R_ToeBase', 'toes_r'],
};

export interface RiggedAvatar {
  root: THREE.Object3D;
  bones: Map<string, THREE.Bone>;
  baseQuaternions: Map<string, THREE.Quaternion>;
  basePositions: Map<string, THREE.Vector3>;
  targetQuaternions: Map<string, THREE.Quaternion>;
  targetPositions: Map<string, THREE.Vector3>;
  currentQuaternions: Map<string, THREE.Quaternion>;
  currentPositions: Map<string, THREE.Vector3>;
  meshesWithMorphs: THREE.Mesh[];
  hipsHeight: number;
}

export function buildRiggedAvatar(model: THREE.Object3D): RiggedAvatar {
  const bonesMap = new Map<string, THREE.Bone>();
  const baseQuaternions = new Map<string, THREE.Quaternion>();
  const basePositions = new Map<string, THREE.Vector3>();
  const targetQuaternions = new Map<string, THREE.Quaternion>();
  const targetPositions = new Map<string, THREE.Vector3>();
  const currentQuaternions = new Map<string, THREE.Quaternion>();
  const currentPositions = new Map<string, THREE.Vector3>();
  const meshesWithMorphs: THREE.Mesh[] = [];

  // Index all bones by exact name first
  const allBones = new Map<string, THREE.Bone>();
  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      allBones.set(obj.name, obj as THREE.Bone);
      allBones.set(obj.name.toLowerCase(), obj as THREE.Bone);
    }
    if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).morphTargetDictionary) {
      meshesWithMorphs.push(obj as THREE.Mesh);
      // prevent frustum culling issues when avatar moves
      obj.frustumCulled = false;
    }
  });

  // Map standardized bone keys
  for (const [stdKey, aliases] of Object.entries(BONE_ALIASES)) {
    for (const alias of aliases) {
      const match = allBones.get(alias) || allBones.get(alias.toLowerCase());
      if (match) {
        bonesMap.set(stdKey, match);
        baseQuaternions.set(stdKey, match.quaternion.clone());
        basePositions.set(stdKey, match.position.clone());

        targetQuaternions.set(stdKey, match.quaternion.clone());
        targetPositions.set(stdKey, match.position.clone());
        currentQuaternions.set(stdKey, match.quaternion.clone());
        currentPositions.set(stdKey, match.position.clone());
        break;
      }
    }
  }

  const hipsBone = bonesMap.get('Hips');
  const hipsHeight = hipsBone ? hipsBone.position.y : 1.0;

  return {
    root: model,
    bones: bonesMap,
    baseQuaternions,
    basePositions,
    targetQuaternions,
    targetPositions,
    currentQuaternions,
    currentPositions,
    meshesWithMorphs,
    hipsHeight,
  };
}

// Convert PoseProps to Target Quaternions and Positions
export function applyPoseToRig(
  rig: RiggedAvatar,
  props: PoseProps,
  mirror: boolean = false,
  retarget?: Record<string, { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number }>
) {
  for (const [propKey, transform] of Object.entries(props)) {
    const [boneName, type] = propKey.split('.');
    if (!boneName || !type) continue;

    let targetBoneName = boneName;
    if (mirror) {
      if (boneName.startsWith('Left')) targetBoneName = boneName.replace('Left', 'Right');
      else if (boneName.startsWith('Right')) targetBoneName = boneName.replace('Right', 'Left');
    }

    const bone = rig.bones.get(targetBoneName);
    if (!bone) continue;

    const ret = retarget?.[targetBoneName];

    if (type === 'rotation') {
      const rx = (transform.x ?? 0) + (ret?.rx ?? 0);
      let ry = (transform.y ?? 0) + (ret?.ry ?? 0);
      let rz = (transform.z ?? 0) + (ret?.rz ?? 0);

      if (mirror) {
        ry = -ry;
        rz = -rz;
      }

      // Convert Euler to Quaternion (XYZ order)
      const euler = new THREE.Euler(rx, ry, rz, 'XYZ');
      const quat = new THREE.Quaternion().setFromEuler(euler);
      rig.targetQuaternions.set(targetBoneName, quat);
    } else if (type === 'position') {
      const px = ((transform.x ?? 0) + (ret?.x ?? 0)) * (mirror ? -1 : 1);
      const py = (transform.y ?? rig.hipsHeight) + (ret?.y ?? 0);
      const pz = (transform.z ?? 0) + (ret?.z ?? 0);

      rig.targetPositions.set(targetBoneName, new THREE.Vector3(px, py, pz));
    }
  }
}

export interface SpeakingRigOptions {
  isSpeaking: boolean;
  speakingWeight?: number; // 0.0 to 1.0 (smooth blend)
  audioVolume?: number; // 0.0 to 1.0 live acoustic volume
  isPaused?: boolean; // true during sound pauses/silences
}

// Interpolate rig bones towards target transforms with natural breathing and conversational speaking gestures
export function updateRigPose(
  rig: RiggedAvatar,
  factor: number,
  breathing: boolean = true,
  time: number = 0,
  headOffset?: { x: number; y: number },
  speaking?: SpeakingRigOptions
) {
  const speakingWeight = speaking?.speakingWeight ?? (speaking?.isSpeaking ? 1.0 : 0.0);
  const isPaused = speaking?.isPaused ?? false;
  const audioVol = speaking?.audioVolume ?? 0.5;

  // Active energy: when sound is paused, settle to a gentle conversational hold; when sound is active, scale with volume
  const activeEnergy = speakingWeight * (isPaused ? 0.12 : Math.min(1.2, 0.45 + audioVol * 0.65));

  for (const [boneName, bone] of rig.bones.entries()) {
    const targetQ = rig.targetQuaternions.get(boneName);
    const currQ = rig.currentQuaternions.get(boneName);

    if (targetQ && currQ) {
      currQ.slerp(targetQ, factor);
      bone.quaternion.copy(currQ);

      // 1. Natural breathing oscillation to Spine / Spine1
      if (breathing) {
        if (boneName === 'Spine' || boneName === 'Spine1') {
          const breathAngle = Math.sin(time * 2.2) * 0.02;
          bone.rotateX(breathAngle);
        }
      }

      // 2. Head look-at offset (pointer tracking)
      if (headOffset && boneName === 'Head') {
        bone.rotateY(headOffset.x * 0.35);
        bone.rotateX(-headOffset.y * 0.25);
      }

      // 3. Gentle, slow, and dignified conversational head nod (zero body jitter or twitching)
      if (boneName === 'Head' && speakingWeight > 0.01) {
        // Slow natural head nod (frequency ~0.25 Hz, amplitude only ~1.1 degrees)
        const smoothNod = Math.sin(time * 1.6) * 0.02 * speakingWeight;
        // Subtle communicative head tilt (amplitude ~0.7 degrees)
        const smoothTilt = Math.sin(time * 0.8) * 0.012 * speakingWeight;
        // Subtle natural glance (amplitude ~0.8 degrees)
        const smoothYaw = Math.cos(time * 0.6) * 0.014 * speakingWeight;

        bone.rotateX(smoothNod);
        bone.rotateY(smoothYaw);
        bone.rotateZ(smoothTilt);
      }
    }

    const targetP = rig.targetPositions.get(boneName);
    const currP = rig.currentPositions.get(boneName);
    if (targetP && currP) {
      currP.lerp(targetP, factor);
      bone.position.copy(currP);

      if (breathing && boneName === 'Hips') {
        const breathY = Math.sin(time * 2.2) * 0.003;
        bone.position.y += breathY;
      }
    }
  }
}

// Apply facial expressions & morph targets cleanly without double-compounding,
// with strict pause gating and dynamic eyebrow speech response
export function applyMorphTargets(
  rig: RiggedAvatar,
  expressions: FacialExpression,
  time: number = 0
) {
  if (rig.meshesWithMorphs.length === 0) return;

  const isPaused = expressions.isSpeechPaused ?? (expressions.viseme_sil === 1 && expressions.mouthOpen <= 0.02);
  const speechVol = Math.max(0, Math.min(1, expressions.speechVolume ?? 0));

  // If currently paused in audio or text, clamp all vowel/consonant visemes to zero
  const aa = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_aa ?? 0));
  const pp = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_PP ?? 0));
  const u  = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_U ?? 0));
  const o  = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_O ?? 0));
  const e  = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_E ?? 0));
  const i  = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_I ?? 0));
  const ff = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_FF ?? 0));
  const ss = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_SS ?? 0));
  const ch = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_CH ?? 0));
  const kk = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_kk ?? 0));
  const dd = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_DD ?? 0));
  const nn = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_nn ?? 0));
  const rr = isPaused ? 0 : Math.min(1, Math.max(0, expressions.viseme_RR ?? 0));
  const sil = isPaused ? 1.0 : Math.min(1, Math.max(0, expressions.viseme_sil ?? 0));

  const effectiveMouthOpen = isPaused ? 0 : expressions.mouthOpen;
  const effectiveJawOpen = isPaused ? 0 : expressions.jawOpen;

  // Subtle, calm eyebrow lift during active speech
  const speechBrowLift = !isPaused && speechVol > 0.05 ? Math.max(0, Math.sin(time * 1.5)) * 0.06 : 0;
  const effectiveBrowUp = Math.min(1.0, (expressions.browInnerUp ?? 0) + speechBrowLift);

  // Slow, smooth organic muscle interpolation (graceful, calm, and natural lip transitions)
  const lerpSpeed = isPaused ? 0.38 : 0.18;

  rig.meshesWithMorphs.forEach((mesh) => {
    const dict = mesh.morphTargetDictionary;
    const infl = mesh.morphTargetInfluences;
    if (!dict || !infl) return;

    const setTarget = (key: string, targetVal: number, lFactor: number = lerpSpeed) => {
      if (dict[key] !== undefined) {
        const idx = dict[key];
        infl[idx] = THREE.MathUtils.lerp(infl[idx] ?? 0, targetVal, lFactor);
      }
    };

    // 1. Base expressions (eyes, smile, brows)
    setTarget('mouthSmile', expressions.mouthSmile);
    setTarget('mouthSmileLeft', expressions.mouthSmile);
    setTarget('mouthSmileRight', expressions.mouthSmile);
    setTarget('eyeBlinkLeft', expressions.eyeBlinkLeft);
    setTarget('eyeBlinkRight', expressions.eyeBlinkRight);
    setTarget('browInnerUp', effectiveBrowUp);

    // VRoid facial expressions
    setTarget('Fcl_EYE_Close_L', expressions.eyeBlinkLeft);
    setTarget('Fcl_EYE_Close_R', expressions.eyeBlinkRight);
    setTarget('Fcl_ALL_Joy', expressions.mouthSmile);

    // 2. Viseme handling with ZERO compounding
    const hasVisemeAA = dict['viseme_aa'] !== undefined;
    const hasVisemePP = dict['viseme_PP'] !== undefined;
    const hasVisemeU = dict['viseme_U'] !== undefined;
    const hasVisemeO = dict['viseme_O'] !== undefined;

    // --- "آ" (aa) ---
    if (hasVisemeAA) {
      setTarget('viseme_aa', aa);
      setTarget('mouthOpen', effectiveMouthOpen > 0.05 ? effectiveMouthOpen : 0);
      setTarget('jawOpen', effectiveJawOpen > 0.05 ? effectiveJawOpen : 0);
    } else {
      setTarget('mouthOpen', Math.max(effectiveMouthOpen, aa * 0.85));
      setTarget('jawOpen', Math.max(effectiveJawOpen, aa * 0.7));
    }
    setTarget('Fcl_MTH_A', aa);

    // --- "ب / پ / م" (PP - Bilabial closure) ---
    if (hasVisemePP) {
      setTarget('viseme_PP', pp);
    }
    if (pp > 0.15) {
      setTarget('mouthPressLeft', pp * 0.4);
      setTarget('mouthPressRight', pp * 0.4);
      setTarget('mouthRollUpper', pp * 0.15);
      setTarget('mouthRollLower', pp * 0.15);
      setTarget('mouthOpen', 0);
      setTarget('jawOpen', 0);
    } else {
      setTarget('mouthPressLeft', 0);
      setTarget('mouthPressRight', 0);
      setTarget('mouthRollUpper', 0);
      setTarget('mouthRollLower', 0);
    }

    // --- "او" (U - Closed Rounded Pucker) ---
    if (hasVisemeU) {
      setTarget('viseme_U', u);
      setTarget('mouthPucker', 0);
      setTarget('mouthFunnel', 0);
    } else {
      setTarget('mouthPucker', u);
    }
    setTarget('Fcl_MTH_U', u);

    // --- "اُ" (O - Open Round) ---
    if (hasVisemeO) {
      setTarget('viseme_O', o);
      setTarget('mouthFunnel', 0);
    } else {
      setTarget('mouthFunnel', o * 0.7);
    }
    setTarget('Fcl_MTH_O', o);

    // Other standard Oculus visemes
    setTarget('viseme_E', e);
    setTarget('Fcl_MTH_E', e);
    setTarget('viseme_I', i);
    setTarget('Fcl_MTH_I', i);
    setTarget('viseme_FF', ff);
    setTarget('viseme_SS', ss);
    setTarget('viseme_CH', ch);
    setTarget('viseme_kk', kk);
    setTarget('viseme_DD', dd);
    setTarget('viseme_nn', nn);
    setTarget('viseme_RR', rr);
    setTarget('viseme_sil', sil);
  });
}
