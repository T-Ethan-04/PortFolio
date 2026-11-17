// =====================================================================
//  avatar.js — Chargement de l'avatar, pose assise, animation
//  procédurale et manette tenue dans les mains.
//
//  Ordre de chargement : assets/avatar.glb (ton avatar Avaturn / MetaPerson /
//  Ready Player Me…) → assets/mannequin.glb (mannequin en attendant)
//  → avatar en formes simples si aucun fichier n'est utilisable.
//
//  ► Pour ajuster la pose, modifie uniquement l'objet POSE ci-dessous.
//    Angles en degrés, distances en mètres. Recharge la page pour voir.
//    Astuce : ajoute ?pose à l'adresse pour figer l'animation.
//
//  Les os sont trouvés par leur nom, sans tenir compte de la casse ni du
//  préfixe "mixamorig:". Cuisses/genoux et bras/avant-bras sont orientés
//  automatiquement (cinématique inverse) : les pieds touchent le sol et les
//  mains tiennent la manette, quelle que soit la taille de l'avatar.
// =====================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const AVATAR_FICHIERS = ['assets/avatar.glb', 'assets/mannequin.glb'];

// ---------------------------------------------------------------------
//  POSE — tous les réglages de la posture
// ---------------------------------------------------------------------
export const POSE = {
  // Placement sur le canapé
  placement: {
    x: -0.12,              // position gauche/droite du bassin
    z: null,               // profondeur ; null = automatique (calé contre le dossier)
    hauteurBassin: null,   // hauteur des hanches ; null = automatique (posé sur l'assise)
    assise: 0.07,          // hanches au-dessus de la surface du coussin (mode automatique)
    distanceDossier: 0.15, // hanches devant le dossier (mode automatique)
    orientation: 180,      // 180 = face à la télé
    tailleCible: 0,        // taille en mètres (0 = garder celle du fichier, ex. 1.78)
  },

  // Tronc
  bassin:  { bascule: -14 },               // négatif = bassin basculé en arrière, calé dans le canapé
  dos:     { inclinaison: 20, torsion: 0 }, // positif = penché vers l'écran (réparti sur la colonne)
  cou:     { inclinaison: 2 },
  tete:    { inclinaison: 4, rotation: 0 }, // positif = regarde un peu vers le bas ; rotation = gauche/droite
  epaules: { avant: 8, haussement: 0 },    // épaules ramenées vers l'avant / haussées

  // Jambes : hanches → cuisses → genoux → pieds (orientés automatiquement)
  jambes: {
    piedsAvant: 0.50,      // distance des chevilles devant les hanches
    piedsEcart: 0.17,      // écart de chaque cheville par rapport au centre
    genouxEcart: 0.30,     // ouverture des genoux vers l'extérieur (0 = droits)
    piedsRotation: 10,     // pointes de pied tournées vers l'extérieur
  },

  // Bras : épaules → bras → avant-bras → mains (orientés automatiquement vers la manette)
  manette: {
    avant: 0.36,           // distance de la manette devant les hanches
    hauteur: 0.20,         // hauteur de la manette au-dessus des hanches
    ecartMains: 0.075,     // demi-écart entre les poignets
    inclinaison: 20,       // manette inclinée vers le visage
  },
  coudes:    { ecart: 0.45, arriere: 0.35 }, // coudes vers l'extérieur / vers l'arrière
  avantBras: { torsion: 0 },                 // rotation des avant-bras sur eux-mêmes
  mains:     { flexion: -5, versInterieur: 18, torsion: 30 }, // poignets
  doigts:    { flexion: [35, 50, 30], pouce: [5, 15, 10] },   // flexion par phalange

  // Animation procédurale (0 = désactivé, 1 = normal)
  animation: { respiration: 1, tete: 1, pouces: 1, sursauts: true, intervalleSursauts: [5, 12] },
};

// Rendu des matériaux de l'avatar (peau, cheveux… conservés depuis le GLB)
export const AVATAR_RENDU = {
  envMapIntensity: 0.65,   // reflets de l'éclairage d'ambiance sur l'avatar
};

const CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/';
const DEG = Math.PI / 180;

/** Chargeur GLB configuré pour les fichiers compressés (Draco, KTX2, Meshopt). */
export function createGLTFLoader(renderer, manager) {
  const loader = new GLTFLoader(manager);
  const draco = new DRACOLoader(manager).setDecoderPath(CDN + 'draco/gltf/');
  const ktx2 = new KTX2Loader(manager).setTranscoderPath(CDN + 'basis/').detectSupport(renderer);
  loader.setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/** Vérifie qu'un fichier existe (sans le télécharger). */
async function exists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    return r.ok && !(r.headers.get('content-type') || '').includes('text/html');
  } catch { return false; }
}

/** Charge le premier fichier d'avatar disponible. Renvoie { gltf, url } ou null. */
export async function loadAvatarGLTF(loader, onProgress, urls = AVATAR_FICHIERS) {
  for (const url of urls) {
    if (!(await exists(url))) continue;
    try {
      const gltf = await new Promise((res, rej) => loader.load(url, res, onProgress, rej));
      return { gltf, url };
    } catch (e) { console.warn(`[avatar] ${url} illisible :`, e && e.message ? e.message : e); }
  }
  onProgress && onProgress({ loaded: 1, total: 1 });
  return null;
}

/** Crée l'avatar articulé (ou l'avatar de secours) à partir du GLB chargé. */
export function createAvatar(loaded, scene, M, room) {
  if (loaded) {
    const av = new RiggedAvatar(loaded.gltf, scene, M, room, loaded.url);
    if (av.ok) return av;
    console.warn('[avatar] Squelette non reconnu dans', loaded.url, '→ avatar de secours.');
  }
  return new FallbackAvatar(scene, M);
}

// ---------------------------------------------------------------------
//  Recherche des os par nom
// ---------------------------------------------------------------------
const BONE_ALIASES = {
  hips: ['hips', 'pelvis', 'hip'],
  spine: ['spine', 'spine01'],
  spine1: ['spine1', 'spine02', 'chest'],
  spine2: ['spine2', 'spine03', 'upperchest'],
  neck: ['neck', 'neck01'],
  head: ['head'],
};
for (const [S, s] of [['Left', 'l'], ['Right', 'r']]) {
  const k = S.toLowerCase();
  Object.assign(BONE_ALIASES, {
    [k + 'Shoulder']: [k + 'shoulder', 'clavicle' + s, k + 'clavicle'],
    [k + 'Arm']: [k + 'arm', k + 'upperarm', 'upperarm' + s],
    [k + 'ForeArm']: [k + 'forearm', k + 'lowerarm', 'lowerarm' + s, 'forearm' + s],
    [k + 'Hand']: [k + 'hand', 'hand' + s],
    [k + 'UpLeg']: [k + 'upleg', k + 'upperleg', 'thigh' + s, k + 'thigh'],
    [k + 'Leg']: [k + 'leg', k + 'lowerleg', 'calf' + s, k + 'shin'],
    [k + 'Foot']: [k + 'foot', 'foot' + s],
    [k + 'Toe']: [k + 'toebase', k + 'toes', k + 'toe', 'ball' + s],
  });
  const seg = ['', 'proximal', 'intermediate', 'distal'];
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
    const fl = f.toLowerCase();
    for (let i = 1; i <= 3; i++) BONE_ALIASES[k + f + i] = [k + 'hand' + fl + i, k + fl + i, fl + '0' + i + s, k + fl + seg[i]];
  }
}
const cleanName = n => n.toLowerCase().replace(/^.*[:|]/, '').replace(/^mixamorig\d*/, '').replace(/^(armature|rig|def|bip0?1)[_\s.-]+/, '').replace(/[^a-z0-9]/g, '');

function findBones(root) {
  const byName = new Map();
  root.traverse(o => { if (o.isBone) { const n = cleanName(o.name); if (!byName.has(n)) byName.set(n, o); } });
  const out = {};
  for (const [key, aliases] of Object.entries(BONE_ALIASES)) {
    for (const a of aliases) { if (byName.has(a)) { out[key] = byName.get(a); break; } }
  }
  return out;
}

// ---------------------------------------------------------------------
//  Outils de rotation en espace monde (indépendants des axes du rig)
// ---------------------------------------------------------------------
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const wp = (o, v = new THREE.Vector3()) => o.getWorldPosition(v);

/** Applique une rotation exprimée en espace monde à un os. */
function rotateWorld(bone, qWorld) {
  bone.parent.getWorldQuaternion(_q1);
  _q2.copy(_q1).invert().multiply(qWorld).multiply(_q1);
  bone.quaternion.premultiply(_q2);
  bone.updateMatrixWorld(true);
}
function rotateAxis(bone, axis, angle) {
  if (!bone || !angle) return;
  rotateWorld(bone, _q3.setFromAxisAngle(axis, angle));
}
/** Oriente l'os pour que le segment os → enfant pointe dans la direction dir. */
function aim(bone, child, dir) {
  if (!bone || !child) return;
  wp(bone, _a); wp(child, _b);
  const v = _b.sub(_a).normalize();
  rotateWorld(bone, _q3.setFromUnitVectors(v, _c.copy(dir).normalize()));
}
/** Rotation d'un os autour de son propre axe. */
function twist(bone, child, angle) {
  if (!bone || !child || !angle) return;
  wp(bone, _a); wp(child, _b);
  rotateAxis(bone, _d.copy(_b).sub(_a).normalize(), angle);
}
/** Cinématique inverse à deux os (cuisse+jambe, bras+avant-bras). */
function solveTwoBone(a, b, c, target, pole) {
  const A = wp(a), B = wp(b), C = wp(c);
  const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
  const toT = target.clone().sub(A);
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const n = toT.normalize();
  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const p = pole.clone().sub(n.clone().multiplyScalar(pole.dot(n))).normalize();
  const knee = A.clone().add(n.clone().multiplyScalar(cosA * l1)).add(p.multiplyScalar(Math.sqrt(1 - cosA * cosA) * l1));
  aim(a, b, knee.clone().sub(A));
  const end = A.clone().add(n.multiplyScalar(d));
  aim(b, c, end.sub(wp(b)));
}

// ---------------------------------------------------------------------
//  Manette (style DualSense blanche, sans logo)
//  Repère local : X = gauche du joueur, Y = haut, Z = vers la télé
// ---------------------------------------------------------------------
export function buildController(M) {
  const g = new THREE.Group(); g.name = 'manette';
  const add = (geo, mat, x, y, z, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m;
  };
  const rb = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 3, r);
  const darkPlastic = new THREE.MeshPhysicalMaterial({ color: '#16171a', roughness: 0.45, clearcoat: 0.4 });
  const lightBar = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.55, 3.0) });
  add(rb(0.158, 0.03, 0.062, 0.013), M.white, 0, 0, 0);                         // corps
  for (const s of [-1, 1]) {                                                       // poignées
    const gr = add(new THREE.CapsuleGeometry(0.023, 0.062, 6, 14), M.white, s * 0.058, -0.016, -0.034);
    gr.rotation.x = 1.15; gr.rotation.z = -s * 0.22;
  }
  add(rb(0.074, 0.006, 0.04, 0.003), darkPlastic, 0, 0.0145, -0.012, false);      // zone centrale noire
  add(rb(0.062, 0.006, 0.03, 0.004), M.white, 0, 0.0175, 0.014, false);           // pavé tactile
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.002, 0.003, 0.026), lightBar, s * 0.032, 0.0185, 0.014, false); // barres lumineuses
    add(new THREE.CylinderGeometry(0.0085, 0.0095, 0.012, 16), darkPlastic, s * 0.022, 0.022, -0.022, false); // sticks
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.004, 16), darkPlastic, s * 0.022, 0.016, -0.022, false);
  }
  const btn = new THREE.MeshStandardMaterial({ color: '#cfd2d8', roughness: 0.4 });
  for (const [dx, dz] of [[0, 0.009], [0, -0.009], [0.009, 0], [-0.009, 0]]) {    // croix (gauche) et boutons (droite)
    add(new THREE.BoxGeometry(0.007, 0.004, 0.007), darkPlastic, 0.056 + dx, 0.016, 0.004 + dz, false);
    add(new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 12), btn, -0.056 + dx, 0.016, 0.004 + dz, false);
  }
  for (const s of [-1, 1]) add(rb(0.03, 0.012, 0.014, 0.004), M.white, s * 0.055, 0.008, 0.034);  // gâchettes
  /** Couleur de la barre lumineuse (suit la section du menu). */
  g.setLight = hex => { const c = new THREE.Color(hex); lightBar.color.copy(c).multiplyScalar(2.6); };
  return g;
}

// ---------------------------------------------------------------------
//  Avatar GLB articulé
// ---------------------------------------------------------------------
export class RiggedAvatar {
  constructor(gltf, scene, M, room, url = '') {
    this.isFallback = false;
    this.isMannequin = /mannequin/i.test(url);
    this.model = gltf.scene;
    this.root = new THREE.Group(); this.root.name = 'avatar';
    this.root.add(this.model); scene.add(this.root);
    this.B = findBones(this.model);
    const B = this.B;
    this.ok = !!(B.hips && B.leftUpLeg && B.rightUpLeg && B.leftArm && B.rightArm && B.leftForeArm && B.rightForeArm && B.leftHand && B.rightHand && B.leftLeg && B.rightLeg && B.leftFoot && B.rightFoot);
    if (!this.ok) { scene.remove(this.root); console.warn('[avatar] Os trouvés :', Object.keys(B)); return; }

    this.bones = []; this.model.traverse(o => { if (o.isBone) this.bones.push(o); });
    this.materials = [];
    this.model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      if (o.isSkinnedMesh) o.frustumCulled = false; // la pose change la silhouette
      for (const m of [].concat(o.material)) {
        if (m.isMeshStandardMaterial) this.materials.push(m);
        if (m.map) m.map.anisotropy = 8;
      }
    });

    this.setupFrame(room);
    this.rest = this.bones.map(b => b.quaternion.clone());
    this.measureRest();
    this.applyPose();
    this.base = this.bones.map(b => b.quaternion.clone());

    this.controller = buildController(M);
    scene.add(this.controller);

    // animations éventuelles du fichier
    this.clips = gltf.animations || [];
    this.mixer = this.clips.length ? new THREE.AnimationMixer(this.model) : null;
    this.action = null;
    this.frozen = new URLSearchParams(location.search).has('pose');
    this.nextJolt = 3 + Math.random() * 4;
    this.jolt = null;
    this.updateController(0);
  }

  /** Mise à l'échelle, orientation vers la télé et placement sur l'assise. */
  setupFrame(room) {
    const P = POSE.placement, B = this.B, root = this.root;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    const h = box.getSize(new THREE.Vector3()).y;
    const target = P.tailleCible > 0 ? P.tailleCible : (h > 1.2 && h < 2.3 ? h : 1.75);
    root.scale.setScalar(target / h);
    root.updateMatrixWorld(true);

    // l'avant du rig = (gauche) × (haut)
    const left = wp(B.leftUpLeg).sub(wp(B.rightUpLeg)); left.y = 0; left.normalize();
    const fwd = new THREE.Vector3().crossVectors(left, new THREE.Vector3(0, 1, 0));
    root.rotation.y = P.orientation * DEG - Math.atan2(fwd.x, fwd.z);
    root.updateMatrixWorld(true);

    const minY = new THREE.Box3().setFromObject(this.model).min.y;
    this.ankleHeight = Math.max(0.04, wp(B.leftFoot).y - minY);

    // assise : détectée sur le canapé (procédural ou modèle 3D), sinon valeurs par défaut
    const seat = room && room.seatAt ? room.seatAt(P.x, 1.25) : null;
    const hipsY = P.hauteurBassin != null ? P.hauteurBassin : (seat ? seat.y + P.assise : 0.64);
    let hipsZ = P.z != null ? P.z : (seat && seat.backZ != null ? seat.backZ - P.distanceDossier : 1.27);
    hipsZ = THREE.MathUtils.clamp(hipsZ, 0.9, 1.6);
    this.seat = { y: hipsY, z: hipsZ };
    const hips = wp(B.hips);
    root.position.add(new THREE.Vector3(P.x, hipsY, hipsZ).sub(hips));
    root.updateMatrixWorld(true);

    // repère de l'avatar en espace monde
    const o = P.orientation * DEG;
    this.F = new THREE.Vector3(Math.sin(o), 0, Math.cos(o));   // avant
    this.U = new THREE.Vector3(0, 1, 0);                        // haut
    this.L = new THREE.Vector3().crossVectors(this.U, this.F);  // gauche de l'avatar
  }

  /** Mesures en pose de repos : normale des paumes, direction des pieds. */
  measureRest() {
    const B = this.B;
    this.palmLocal = {};
    for (const side of ['left', 'right']) {
      const hand = B[side + 'Hand'], idx = B[side + 'Index1'], mid = B[side + 'Middle1'] || idx, pk = B[side + 'Pinky1'] || B[side + 'Ring1'];
      let n;
      if (idx && mid && pk) {
        const dir = wp(mid).sub(wp(hand)), across = wp(pk).sub(wp(idx));
        n = new THREE.Vector3().crossVectors(dir, across).normalize();
        if (Math.abs(n.y) > 0.3) { if (n.y > 0) n.negate(); }   // au repos, les paumes regardent vers le bas
        else if (side === 'left') n.negate();
      } else n = new THREE.Vector3(0, -1, 0);
      this.palmLocal[side] = n.applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert());
    }
    this.footRest = {};
    for (const side of ['left', 'right']) {
      const foot = B[side + 'Foot'], toe = B[side + 'Toe'];
      if (!toe) continue;
      const d = wp(toe).sub(wp(foot)).normalize();
      this.footRest[side] = { f: d.dot(this.F), u: d.dot(this.U) };
    }
  }

  palmWorld(side, v = new THREE.Vector3()) {
    return v.copy(this.palmLocal[side]).applyQuaternion(this.B[side + 'Hand'].getWorldQuaternion(_q1));
  }

  /** Axe de flexion d'une phalange (vers la paume). */
  curlAxis(bone, child, side) {
    const dir = wp(child).sub(wp(bone)).normalize();
    return dir.cross(this.palmWorld(side)).normalize();
  }

  /** Construit la pose assise à partir de POSE. */
  applyPose() {
    const B = this.B, { F, U, L } = this;
    this.bones.forEach((b, i) => b.quaternion.copy(this.rest[i]));
    this.root.updateMatrixWorld(true);

    // bassin et colonne
    rotateAxis(B.hips, L, POSE.bassin.bascule * DEG);
    const spine = [B.spine, B.spine1, B.spine2].filter(Boolean);
    spine.forEach(b => {
      rotateAxis(b, L, POSE.dos.inclinaison * DEG / spine.length);
      rotateAxis(b, U, POSE.dos.torsion * DEG / spine.length);
    });
    rotateAxis(B.neck, L, POSE.cou.inclinaison * DEG);
    rotateAxis(B.head, L, POSE.tete.inclinaison * DEG);
    rotateAxis(B.head, U, POSE.tete.rotation * DEG);

    const hips = wp(B.hips);
    for (const [side, s] of [['left', 1], ['right', -1]]) {
      const S = k => B[side + k];
      // --- jambes ---
      const J = POSE.jambes;
      const ankle = hips.clone().addScaledVector(F, J.piedsAvant).addScaledVector(L, s * J.piedsEcart);
      ankle.y = this.ankleHeight;
      const kneePole = F.clone().addScaledVector(U, 0.3).addScaledVector(L, s * J.genouxEcart);
      solveTwoBone(S('UpLeg'), S('Leg'), S('Foot'), ankle, kneePole);
      const fr = this.footRest[side];
      if (fr) {
        const h = F.clone().applyAxisAngle(U, s * J.piedsRotation * DEG).multiplyScalar(fr.f);
        aim(S('Foot'), S('Toe'), h.addScaledVector(U, fr.u));
      }

      // --- épaules ---
      rotateAxis(S('Shoulder'), U, -s * POSE.epaules.avant * DEG);
      rotateAxis(S('Shoulder'), F, s * POSE.epaules.haussement * DEG);

      // --- bras vers la manette ---
      const Mn = POSE.manette;
      const center = hips.clone().addScaledVector(F, Mn.avant).addScaledVector(U, Mn.hauteur);
      const wrist = center.clone().addScaledVector(L, s * Mn.ecartMains).addScaledVector(F, -0.05).addScaledVector(U, -0.015);
      const elbowPole = U.clone().negate().addScaledVector(L, s * POSE.coudes.ecart).addScaledVector(F, -POSE.coudes.arriere);
      solveTwoBone(S('Arm'), S('ForeArm'), S('Hand'), wrist, elbowPole);
      twist(S('ForeArm'), S('Hand'), s * POSE.avantBras.torsion * DEG);

      // --- mains ---
      const hand = S('Hand'), mid = S('Middle1') || S('Index1');
      if (mid) {
        const fa = wp(hand).sub(wp(S('ForeArm'))).normalize();
        const dir = fa.applyAxisAngle(U, -s * POSE.mains.versInterieur * DEG).applyAxisAngle(L, POSE.mains.flexion * DEG);
        aim(hand, mid, dir);
        twist(hand, mid, s * POSE.mains.torsion * DEG);
      }
      // --- doigts ---
      for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
        for (let i = 1; i <= 3; i++) {
          const b = S(f + i), c = i < 3 ? S(f + (i + 1)) : b && b.children[0];
          if (b && c) rotateAxis(b, this.curlAxis(b, c, side), POSE.doigts.flexion[i - 1] * DEG);
        }
      }
      for (let i = 1; i <= 3; i++) {
        const b = S('Thumb' + i), c = i < 3 ? S('Thumb' + (i + 1)) : b && b.children[0];
        if (b && c) rotateAxis(b, this.curlAxis(b, c, side), POSE.doigts.pouce[i - 1] * DEG);
      }
    }
  }

  /** Place la manette entre les deux mains, à chaque image. */
  updateController(tilt = 0) {
    const B = this.B;
    const hl = wp(B.leftHand), hr = wp(B.rightHand);
    const ml = B.leftMiddle1 ? wp(B.leftMiddle1) : hl.clone().addScaledVector(this.F, 0.08);
    const mr = B.rightMiddle1 ? wp(B.rightMiddle1) : hr.clone().addScaledVector(this.F, 0.08);
    const lateral = hl.clone().sub(hr).normalize();
    const fwd = ml.sub(hl).add(mr.sub(hr)).normalize();
    fwd.addScaledVector(lateral, -fwd.dot(lateral)).normalize();
    fwd.applyAxisAngle(lateral, -(POSE.manette.inclinaison * DEG * 0.5 + tilt));
    const up = new THREE.Vector3().crossVectors(fwd, lateral);
    const m = new THREE.Matrix4().makeBasis(lateral, up, fwd);
    this.controller.quaternion.setFromRotationMatrix(m);
    this.controller.position.copy(hl).add(hr).multiplyScalar(0.5).addScaledVector(fwd, 0.055).addScaledVector(up, 0.012);
  }

  /** Animation : respiration, tête, pouces, petits sursauts de jeu. */
  update(dt, t) {
    if (this.action) { this.mixer.update(dt); this.updateController(); return; }
    if (this.frozen) return;
    const B = this.B, { F, U, L } = this, A = POSE.animation;
    this.bones.forEach((b, i) => b.quaternion.copy(this.base[i]));
    this.root.updateMatrixWorld(true);

    // respiration
    const br = Math.sin(t * Math.PI * 2 / 4.2) * A.respiration;
    rotateAxis(B.spine2 || B.spine1, L, -br * 0.014);
    rotateAxis(B.leftShoulder, F, br * 0.012);
    rotateAxis(B.rightShoulder, F, -br * 0.012);

    // sursauts de jeu (déclenchés de temps en temps)
    let e = 0;
    if (A.sursauts) {
      if (!this.jolt && t > this.nextJolt) this.jolt = { t0: t, dur: 0.55 + Math.random() * 0.3, type: Math.random() < 0.5 ? 'saut' : 'virage', dir: Math.random() < 0.5 ? 1 : -1 };
      if (this.jolt) {
        const u = (t - this.jolt.t0) / this.jolt.dur;
        if (u >= 1) { this.jolt = null; const [a, b] = A.intervalleSursauts; this.nextJolt = t + a + Math.random() * (b - a); }
        else e = Math.sin(Math.PI * Math.pow(u, 0.55));
      }
    }
    const j = this.jolt;
    if (e) {
      rotateAxis(B.spine1 || B.spine, L, e * 0.06);
      if (j.type === 'virage') rotateAxis(B.spine2 || B.spine1, U, j.dir * e * 0.07);
    }

    // tête : regarde l'écran avec de légers mouvements
    const yaw = (Math.sin(t * 0.31) * 0.05 + Math.sin(t * 0.83 + 1) * 0.02) * A.tete + (j && j.type === 'virage' ? j.dir * e * 0.05 : 0);
    const pitch = Math.sin(t * 0.47) * 0.02 * A.tete - e * 0.04;
    rotateAxis(B.head, U, yaw);
    rotateAxis(B.head, L, pitch);

    // avant-bras : la manette se soulève ou tourne pendant un sursaut
    if (e) {
      const up = j.type === 'saut' ? 1 : 0;
      rotateAxis(B.leftForeArm, L, -e * (0.16 * up + (j.type === 'virage' ? 0.14 * j.dir : 0)));
      rotateAxis(B.rightForeArm, L, -e * (0.16 * up - (j.type === 'virage' ? 0.14 * j.dir : 0)));
    }

    // pouces sur les joysticks + index sur les gâchettes
    const act = (0.55 + 0.45 * Math.sin(t * 0.7)) * A.pouces * (1 + e);
    for (const [side, ph] of [['left', 0], ['right', 2.1]]) {
      const S = k => B[side + k];
      const t2 = S('Thumb2'), t3 = S('Thumb3');
      if (t2 && t3) rotateAxis(t2, this.curlAxis(t2, t3, side), Math.sin(t * 6.3 + ph) * 0.14 * act);
      const t1 = S('Thumb1');
      if (t1 && t2) rotateAxis(t1, this.palmWorld(side), Math.sin(t * 4.1 + ph * 1.7) * 0.1 * act);
      const i1 = S('Index1'), i2 = S('Index2');
      if (i1 && i2) rotateAxis(i1, this.curlAxis(i1, i2, side), Math.max(0, Math.sin(t * 2.3 + ph * 3)) * 0.25 * act);
    }
    this.updateController();
  }

  /** Change l'éclairage d'ambiance appliqué aux matériaux de l'avatar. */
  setEnvironment(env) {
    for (const m of this.materials) { m.envMap = env; m.envMapIntensity = AVATAR_RENDU.envMapIntensity; m.needsUpdate = true; }
  }

  /** Joue une animation du fichier (nom) ou revient à la pose procédurale (null). */
  playClip(name) {
    if (this.action) { this.action.stop(); this.action = null; }
    if (!name || !this.mixer) { this.bones.forEach((b, i) => b.quaternion.copy(this.base[i])); return; }
    const clip = this.clips.find(c => c.name === name);
    if (clip) { this.action = this.mixer.clipAction(clip); this.action.reset().play(); }
  }

  setLightColor(hex) { this.controller.setLight(hex); }
  headPosition(v = new THREE.Vector3()) { return wp(this.B.head || this.B.neck || this.B.hips, v); }
}

// ---------------------------------------------------------------------
//  Avatar de secours (formes simples du prototype)
// ---------------------------------------------------------------------
export class FallbackAvatar {
  constructor(scene, M) {
    this.isFallback = true; this.clips = [];
    const av = new THREE.Group(); av.position.set(-0.1, 0, 1.25); av.name = 'avatar-secours'; scene.add(av);
    this.root = av;
    const add = (geo, mat, x, y, z, parent = av) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    };
    const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 4, r);
    const limb = (a, b, r, mat) => {
      const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A);
      const m = add(new THREE.CapsuleGeometry(r, d.length(), 8, 16), mat, 0, 0, 0);
      m.position.copy(A).add(Bv).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
    };
    this.torso = add(new THREE.CapsuleGeometry(0.15, 0.3, 8, 24), M.jacket, 0, 0.94, 0.05); this.torso.scale.set(1.3, 1, 0.82); this.torso.rotation.x = -0.12;
    const collar = add(new THREE.TorusGeometry(0.07, 0.022, 10, 24), M.jacket, 0, 1.16, 0.03); collar.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.075, 20, 16), M.jacket, s * 0.185, 1.1, 0.04);
    for (const s of [-1, 1]) {
      limb([s * 0.2, 1.1, 0.04], [s * 0.25, 0.86, -0.12], 0.06, M.jacket);
      limb([s * 0.25, 0.86, -0.12], [s * 0.09, 0.9, -0.36], 0.05, M.jacket);
      add(new THREE.SphereGeometry(0.042, 16, 12), M.skin, s * 0.085, 0.905, -0.39);
      limb([s * 0.1, 0.6, 0.0], [s * 0.12, 0.62, -0.46], 0.075, M.jeans);
      limb([s * 0.12, 0.6, -0.46], [s * 0.13, 0.1, -0.52], 0.06, M.jeans);
      add(rbox(0.11, 0.08, 0.27, 0.035), M.white, s * 0.13, 0.04, -0.58);
    }
    const head = this.head = new THREE.Group(); head.position.set(0, 1.24, 0.02); av.add(head);
    add(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 16), M.skin, 0, 0, 0, head);
    const skull = add(new THREE.SphereGeometry(0.11, 32, 24), M.skin, 0, 0.15, -0.01, head); skull.scale.set(0.92, 1.12, 1.02);
    for (const s of [-1, 1]) { const e = add(new THREE.SphereGeometry(0.028, 12, 10), M.skin, s * 0.1, 0.14, 0.0, head); e.scale.set(0.45, 1, 0.8); }
    const hairBack = add(new THREE.SphereGeometry(0.118, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair, 0, 0.165, 0.005, head); hairBack.scale.set(0.95, 1.08, 1.04); hairBack.rotation.x = 0.55;
    const quiff = add(new THREE.SphereGeometry(0.11, 24, 16), M.hair, 0, 0.215, -0.015, head); quiff.scale.set(0.98, 0.5, 1.08); quiff.rotation.x = 0.2;
    // manette : même modèle, tournée vers la télé (repère du groupe = télé vers -Z)
    this.pad = buildController(M); this.pad.position.set(0, 0.92, -0.42); this.pad.rotation.y = Math.PI; av.add(this.pad);
  }
  update(dt, t) {
    this.head.rotation.y = Math.sin(t * 0.7) * 0.06; this.head.rotation.x = 0.1 + Math.sin(t * 1.3) * 0.02;
    this.pad.rotation.z = Math.sin(t * 2.1) * 0.05; this.pad.position.y = 0.92 + Math.sin(t * 3.2) * 0.004;
    this.torso.scale.y = 1 + Math.sin(t * 1.6) * 0.008;
  }
  setEnvironment() {}
  playClip() {}
  setLightColor(hex) { this.pad.setLight(hex); }
  headPosition(v = new THREE.Vector3()) { return this.head.getWorldPosition(v).add(new THREE.Vector3(0, 0.12, 0)); }
}
