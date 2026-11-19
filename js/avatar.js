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
import { creerManette, sdfManette, CONTACTS, MANETTE_FICHIER } from './manette.js';
import { FORME } from './manette_forme.js';
export { MANETTE_FICHIER };

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

  // Manette : position devant les hanches. Les bras, les mains et les doigts viennent la saisir.
  manette: {
    avant: 0.36,           // distance de la manette devant les hanches
    hauteur: 0.20,         // hauteur de la manette au-dessus des hanches
    inclinaison: 12,       // manette inclinée vers le visage (degrés)
  },
  // Prise en main : paumes contre les poignées, doigts enroulés dessous, index sur les gâchettes, pouces sur les joysticks
  prise: {
    ecartPaume: 0.03,      // distance entre l'axe de la poignée et le centre de la paume
    versInterieur: 0.3,    // jointures tournées vers le centre de la manette
    versHaut: 0.5,         // jointures tournées vers le haut
    paumeHaut: 0.35,       // paume tournée un peu vers le haut
    doigts: [72, 82, 55],  // majeur, annulaire, auriculaire : flexion par phalange (degrés)
    index: [45, 55, 40],   // index posé sur la gâchette
    pouce: [10, 20, 15],   // flexion du pouce, dont le bout vient se poser sur le joystick
  },
  // Prise de la nouvelle manette (manette.js) : la paume se pose sur la poignée, les doigts se referment au contact
  prise2: {
    long: 1.489,           // position de la paume le long de la poignée (0 = racine, 1 = coude, 2 = bout)
    rayonPoignee: 0.0215,  // rayon de la poignée (m)
    epaisseurPaume: 0.004, // distance entre la peau de la paume et l'os de la main
    dehorsBas: -0.079,     // la paume vient un peu par-dessous (négatif = par-dessus)
    D: [-0.395, -0.307, 1], // direction poignet → jointures (repère manette, x côté gauche) — réglée par optimisation
    N: [-1, 0.439, -0.375], // direction vers laquelle regarde la paume
    etapes: 4,             // (réglage) 1 paume, 2 doigts, 3 index, 4 pouce
    recul: 0.562,          // poignet en retrait de la paume (fraction de la longueur de la paume)
    serrage: 0.65,         // doigts resserrés les uns contre les autres (0 = écartés comme au repos)
    dosMain: 0.010,        // poignet décalé côté dos de la main
    rayonDoigt: [0.0085, 0.0080, 0.0070],  // majeur, annulaire, auriculaire (index ≈ majeur)
    rayonPouce: 0.0095,
    flexionMax: [85, 105, 75],             // flexion maximale de chaque phalange (degrés)
  },
  coudes:    { ecart: 0.45, arriere: 0.35 }, // coudes vers l'extérieur / vers l'arrière
  avantBras: { torsion: 0 },                 // rotation des avant-bras sur eux-mêmes

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
export function createAvatar(loaded, scene, M, room, coqueManette = null) {
  if (loaded) {
    const av = new RiggedAvatar(loaded.gltf, scene, M, room, loaded.url, coqueManette);
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
  // squelette « Biped » de 3ds Max (Bip01 L Thigh, Bip01 L Calf…), nettoyé en « lthigh », « lcalf »…
  const biped = { Shoulder: 'clavicle', Arm: 'upperarm', ForeArm: 'forearm', Hand: 'hand', UpLeg: 'thigh', Leg: 'calf', Foot: 'foot', Toe: 'toe0' };
  for (const [cle, nom] of Object.entries(biped)) BONE_ALIASES[k + cle].push(s + nom);
  const seg = ['', 'proximal', 'intermediate', 'distal'];
  ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].forEach((f, fi) => {
    const fl = f.toLowerCase();
    for (let i = 1; i <= 3; i++) {
      BONE_ALIASES[k + f + i] = [k + 'hand' + fl + i, k + fl + i, fl + '0' + i + s, k + fl + seg[i],
        s + 'finger' + fi + (i > 1 ? String(i - 1) : '')];   // Biped : Finger0 / Finger01 / Finger02 = pouce…
    }
  });
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
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _s = new THREE.Vector3();
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
//  Rendu réaliste de la peau, des yeux et des tissus
// ---------------------------------------------------------------------
export const RENDU_PEAU = {
  diffusion: [0.50, 0.24, 0.16],  // lumière qui « traverse » la peau près de l'ombre (rouge > vert > bleu)
  pores: 0.000016,                // relief des pores (m)
  duvet: 0.22,                    // reflet velouté sur les bords (duvet, tissus)
  brillance: 0.10,                // film légèrement gras du visage
  saturation: 0.9,                // peau un peu moins orangée
  subdivision: true,              // silhouettes arrondies (doigts, mâchoire, oreilles)
};

export const RENDU_YEUX = {
  rayon: 0.0122,            // rayon de la cornée (m)
  ouverture: 0.72,          // demi-angle de la calotte (radians)
  avance: 0.0006,           // cornée un peu en avant du globe
  paupiereHaut: 34,         // descente de la paupière supérieure au clignement (degrés autour de l'œil)
  paupiereBas: -9,          // remontée de la paupière inférieure
  dureeClignement: 0.17,    // secondes
  intervalle: [2.2, 6.0],   // secondes entre deux clignements
  saccade: [4, 2.2],        // amplitude des petits mouvements du regard (degrés : horizontal, vertical)
};

const GLSL_PEAU = /* glsl */`
  varying float vPeau;
  varying vec3 vObj;
  float h31p(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float bruitP(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31p(i), h31p(i + vec3(1,0,0)), f.x), mix(h31p(i + vec3(0,1,0)), h31p(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31p(i + vec3(0,0,1)), h31p(i + vec3(1,0,1)), f.x), mix(h31p(i + vec3(0,1,1)), h31p(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  vec3 reliefPeau(float h, vec3 n, float faceDir) {
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1) * faceDir;
    vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    return normalize(abs(det) * n - g);
  }
`;

/**
 * Améliore les matériaux de l'avatar : diffusion de la lumière sous la peau (ombres douces et chaudes),
 * pores, léger film brillant, duvet ; tissus veloutés. La peau est repérée par sommet :
 * tête entière + mains (poids des os de la main et des doigts).
 */
/**
 * Subdivision « Phong » : chaque triangle devient quatre, les nouveaux sommets suivent la courbure
 * donnée par les normales. Les silhouettes (doigts, mâchoire, oreilles) s'arrondissent sans changer
 * le visage. Les poids d'os sont mélangés pour que la peau plie toujours correctement.
 */
function subdiviser(g, alpha = 0.75) {
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  if (!P || !N || !g.index) return g;
  const idx = g.index.array;
  // lecture composante par composante : fonctionne aussi pour les attributs entrelacés (fichiers optimisés)
  const lire = (att, k) => { const a = new Array(att.count * k); for (let i = 0; i < att.count; i++) for (let c = 0; c < k; c++) a[i * k + c] = att.getComponent(i, c); return a; };
  const pos = lire(P, 3), nor = lire(N, 3), uv = UV ? lire(UV, 2) : null;
  const si = SI ? lire(SI, 4) : null, sw = SW ? lire(SW, 4) : null;
  const milieux = new Map();
  const p = new THREE.Vector3(), q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), na = new THREE.Vector3(), nb = new THREE.Vector3();
  const milieu = (i, j) => {
    const cle = i < j ? i * 1e7 + j : j * 1e7 + i;
    if (milieux.has(cle)) return milieux.get(cle);
    a.fromArray(pos, 3 * i); b.fromArray(pos, 3 * j); na.fromArray(nor, 3 * i); nb.fromArray(nor, 3 * j);
    q.copy(a).add(b).multiplyScalar(0.5);
    const pa = q.clone().addScaledVector(na, -q.clone().sub(a).dot(na));
    const pb = q.clone().addScaledVector(nb, -q.clone().sub(b).dot(nb));
    p.copy(pa).add(pb).multiplyScalar(0.5).multiplyScalar(alpha).addScaledVector(q, 1 - alpha);
    const k = pos.length / 3;
    pos.push(p.x, p.y, p.z);
    const nn = na.clone().add(nb).normalize(); nor.push(nn.x, nn.y, nn.z);
    if (uv) uv.push((uv[2 * i] + uv[2 * j]) / 2, (uv[2 * i + 1] + uv[2 * j + 1]) / 2);
    if (si) {
      const w = new Map();
      for (const v of [i, j]) for (let c = 0; c < 4; c++) { const os = si[4 * v + c], wt = sw[4 * v + c] * 0.5; if (wt > 0) w.set(os, (w.get(os) || 0) + wt); }
      const tri = [...w.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4), tot = tri.reduce((s, e) => s + e[1], 0) || 1;
      for (let c = 0; c < 4; c++) { si.push(tri[c] ? tri[c][0] : 0); sw.push(tri[c] ? tri[c][1] / tot : 0); }
    }
    milieux.set(cle, k);
    return k;
  };
  const out = [];
  for (let t = 0; t < idx.length; t += 3) {
    const A = idx[t], Bv = idx[t + 1], C = idx[t + 2];
    const ab = milieu(A, Bv), bc = milieu(Bv, C), ca = milieu(C, A);
    out.push(A, ab, ca, ab, Bv, bc, ca, bc, C, ab, bc, ca);
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (uv) r.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (si) { r.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); r.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); }
  r.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(out, 1) : new THREE.Uint16BufferAttribute(out, 1));
  r.groups = g.groups; r.boundingSphere = g.boundingSphere; r.boundingBox = g.boundingBox;
  return r;
}

function ameliorerRendu(model) {
  const R = RENDU_PEAU;
  model.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const ancien = o.material;
    if (!ancien || !ancien.isMeshStandardMaterial || ancien.alphaTest > 0 || ancien.transparent) return;   // cheveux : inchangés
    if (RENDU_PEAU.subdivision) { const vieille = o.geometry; o.geometry = subdiviser(vieille); vieille.dispose(); }
    const nom = (ancien.name || '').toLowerCase();
    const tete = nom.includes('head');
    // --- masque de peau par sommet ---
    const g = o.geometry, n = g.attributes.position.count, peau = new Float32Array(n);
    if (tete) peau.fill(1);
    else if (o.isSkinnedMesh && g.attributes.skinIndex) {
      const os = o.skeleton.bones.map(b => /hand|finger/i.test(b.name));
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      for (let i = 0; i < n; i++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (os[si.getComponent(i, k)]) w += sw.getComponent(i, k);
        peau[i] = THREE.MathUtils.smoothstep(w, 0.35, 0.9);
      }
    }
    g.setAttribute('peau', new THREE.BufferAttribute(peau, 1));
    // --- matériau physique (duvet, film gras) ---
    const m = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(m, ancien);
    m.sheen = R.duvet; m.sheenRoughness = 0.65; m.sheenColor = new THREE.Color(tete ? '#ffcbb2' : '#d9d4cf');
    if (tete) { m.clearcoat = R.brillance; m.clearcoatRoughness = 0.38; }
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float peau;\nvarying float vPeau;\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPeau = peau; vObj = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GLSL_PEAU)
        .replace('#include <color_fragment>', `#include <color_fragment>
          { float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(l), diffuseColor.rgb, ${R.saturation.toFixed(3)}), vPeau); }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { float hp = (bruitP(vObj * 2600.0) - 0.5) + 0.5 * (bruitP(vObj * 5200.0 + 7.0) - 0.5);
            float ht = (bruitP(vObj * 1400.0 + 3.0) - 0.5);
            normal = reliefPeau(${R.pores.toExponential(3)} * (vPeau * hp + (1.0 - vPeau) * 0.6 * ht), normal, faceDirection); }`)
        .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );', `{
          float ndlS = dot( geometryNormal, directLight.direction );
          vec3 wS = vec3(${R.diffusion.map(v => v.toFixed(3)).join(',')}) * vPeau;
          vec3 dS = clamp( ( vec3( ndlS ) + wS ) / ( 1.0 + wS ), 0.0, 1.0 );
          reflectedLight.directDiffuse += dS * directLight.color * BRDF_Lambert( material.diffuseColor );
        }`));
    };
    m.customProgramCacheKey = () => 'peau-avatar';
    o.material = m;
    ancien.dispose();
  });
}

// ---------------------------------------------------------------------
//  Avatar GLB articulé
// ---------------------------------------------------------------------
export class RiggedAvatar {
  constructor(gltf, scene, M, room, url = '', coqueManette = null) {
    this.isFallback = false;
    this.nouvelleManette = !!coqueManette;
    this.isMannequin = /mannequin/i.test(url);
    this.model = gltf.scene;
    this.root = new THREE.Group(); this.root.name = 'avatar';
    this.root.add(this.model); scene.add(this.root);
    this.B = findBones(this.model);
    const B = this.B;
    this.ok = !!(B.hips && B.leftUpLeg && B.rightUpLeg && B.leftArm && B.rightArm && B.leftForeArm && B.rightForeArm && B.leftHand && B.rightHand && B.leftLeg && B.rightLeg && B.leftFoot && B.rightFoot);
    if (!this.ok) { scene.remove(this.root); console.warn('[avatar] Os trouvés :', Object.keys(B)); return; }

    this.bones = []; this.model.traverse(o => { if (o.isBone) this.bones.push(o); });
    if (!this.isMannequin) ameliorerRendu(this.model);
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

    this.controller = coqueManette ? creerManette(coqueManette) : buildController(M);
    scene.add(this.controller);
    if (!this.isMannequin) this.preparerYeux(scene);

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
    this.paume = {};                    // longueur poignet → jointure du majeur
    for (const side of ['left', 'right']) {
      const mid = B[side + 'Middle1'] || B[side + 'Index1'];
      this.paume[side] = mid ? wp(mid).distanceTo(wp(B[side + 'Hand'])) : 0.09;
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

    }

    // --- la manette, puis les mains qui la saisissent ---
    const M = this.repereManette(hips);
    if (this.nouvelleManette) { this.prendreManette(M); this.manetteRel = this.repereMains().invert().multiply(M); return; }
    const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
    M.extractBasis(X, Y, Z);
    const point = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M);
    const direction = (x, y, z) => X.clone().multiplyScalar(x).addScaledVector(Y, y).addScaledVector(Z, z).normalize();
    const Pr = POSE.prise;
    for (const [side, s] of [['left', 1], ['right', -1]]) {
      const S = k => B[side + k];
      // paume contre l'extérieur de la poignée, jointures vers l'avant et le haut
      const poignee = point(s * 0.058, -0.016, -0.034);
      const D = direction(-s * Pr.versInterieur, Pr.versHaut, 1);
      const N = direction(-s, Pr.paumeHaut, 0.15);
      const paume = poignee.addScaledVector(X, s * Pr.ecartPaume);
      const poignet = paume.addScaledVector(D, -0.55 * this.paume[side]).addScaledVector(N, -0.012);
      const elbowPole = U.clone().negate().addScaledVector(L, s * POSE.coudes.ecart).addScaledVector(F, -POSE.coudes.arriere);
      solveTwoBone(S('Arm'), S('ForeArm'), S('Hand'), poignet, elbowPole);
      twist(S('ForeArm'), S('Hand'), s * POSE.avantBras.torsion * DEG);

      const hand = S('Hand'), mid = S('Middle1') || S('Index1');
      if (mid) {
        aim(hand, mid, D);
        // main tournée sur elle-même pour que la paume regarde la poignée
        const axe = wp(mid).sub(wp(hand)).normalize();
        const actuelle = this.palmWorld(side).projectOnPlane(axe).normalize();
        const voulue = N.clone().projectOnPlane(axe).normalize();
        rotateAxis(hand, axe, Math.atan2(actuelle.clone().cross(voulue).dot(axe), actuelle.dot(voulue)));
      }
      // doigts enroulés autour de la poignée, index sur la gâchette
      for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
        const flexion = f === 'Index' ? Pr.index : Pr.doigts;
        for (let i = 1; i <= 3; i++) {
          const b = S(f + i), c = i < 3 ? S(f + (i + 1)) : b && b.children[0];
          if (b && c) rotateAxis(b, this.curlAxis(b, c, side), flexion[i - 1] * DEG);
        }
      }
      // pouce : légèrement plié, son bout vient se poser sur le joystick
      const t1 = S('Thumb1'), t2 = S('Thumb2'), t3 = S('Thumb3');
      for (const [b, c, k] of [[t2, t3, 1], [t3, t3 && t3.children[0], 2]]) if (b && c) rotateAxis(b, this.curlAxis(b, c, side), Pr.pouce[k] * DEG);
      if (t1 && t2) {
        const bout = t3 ? (t3.children[0] ? wp(t3.children[0]) : wp(t3).add(wp(t3).sub(wp(t2)).multiplyScalar(0.8))) : wp(t2);
        const joystick = point(s * 0.022, 0.03, -0.022);
        wp(t1, _a);
        rotateWorld(t1, _q3.setFromUnitVectors(bout.sub(_a).normalize(), joystick.sub(_a).normalize()));
      }
    }
    // la manette suit ensuite les mains (sursauts, respiration)
    this.manetteRel = this.repereMains().invert().multiply(M);
  }

  /**
   * Prise réaliste de la nouvelle manette : la paume épouse la poignée, chaque doigt se referme
   * jusqu'à toucher la coque (sans la traverser), l'index se pose sur la gâchette et le pouce
   * sur le joystick (cinématique inverse), d'après la forme exacte de la manette (manette_forme.js).
   */
  prendreManette(M) {
    const B = this.B, P = POSE.prise2;
    const Minv = M.clone().invert(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();
    M.extractBasis(X, Y, Z);
    const monde = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(M);
    const dirMonde = v => v.clone().transformDirection(M);
    const _l = new THREE.Vector3();
    const distance = v => { _l.copy(v).applyMatrix4(Minv); return sdfManette(_l.x, _l.y, _l.z); };
    const bout = b => (b.children[0] && b.children[0].isBone ? wp(b.children[0]) : wp(b).add(wp(b).sub(wp(b.parent)).multiplyScalar(0.75)));

    for (const [side, s] of [['left', 1], ['right', -1]]) {
      const S = k => B[side + k];
      // --- 1. la paume contre l'extérieur de la poignée ---
      const G = FORME.poignee;
      const racine = new THREE.Vector3(s * G.racine[0], G.racine[1], G.racine[2]);
      const coude = new THREE.Vector3(s * G.coude[0], G.coude[1], G.coude[2]);
      const extremite = new THREE.Vector3(s * G.bout[0], G.bout[1], G.bout[2]);
      const [a0, a1, t] = P.long <= 1 ? [racine, coude, P.long] : [coude, extremite, P.long - 1];
      const axe = a1.clone().sub(a0).normalize();                              // vers le joueur et vers le bas
      const centre = a0.clone().lerp(a1, t);
      const dehors = new THREE.Vector3(s, -P.dehorsBas, 0).projectOnPlane(axe).normalize();
      const paumeL = centre.clone().addScaledVector(dehors, P.rayonPoignee + P.epaisseurPaume);
      const Dl = new THREE.Vector3(s * P.D[0], P.D[1], P.D[2]).normalize();                 // poignet → jointures
      const Nl = new THREE.Vector3(s * P.N[0], P.N[1], P.N[2]).projectOnPlane(Dl).normalize(); // la paume regarde la poignée
      const D = dirMonde(Dl), N = dirMonde(Nl), paume = paumeL.applyMatrix4(M);
      const poignet = paume.clone().addScaledVector(D, -P.recul * this.paume[side]).addScaledVector(N, -P.dosMain);
      const elbowPole = this.U.clone().negate().addScaledVector(this.L, s * POSE.coudes.ecart).addScaledVector(this.F, -POSE.coudes.arriere);
      solveTwoBone(S('Arm'), S('ForeArm'), S('Hand'), poignet, elbowPole);
      const hand = S('Hand'), mid = S('Middle1') || S('Index1');
      if (mid) {
        aim(hand, mid, D);
        const axeMain = wp(mid).sub(wp(hand)).normalize();
        const actuelle = this.palmWorld(side).projectOnPlane(axeMain).normalize();
        const voulue = N.clone().projectOnPlane(axeMain).normalize();
        rotateAxis(hand, axeMain, Math.atan2(actuelle.clone().cross(voulue).dot(axeMain), actuelle.dot(voulue)));
      }

      // doigts resserrés : on réduit l'écart de chaque doigt par rapport au majeur, dans le plan de la paume
      if (S('Middle1') && S('Middle2')) {
        const n = this.palmWorld(side), ref = wp(S('Middle2')).sub(wp(S('Middle1'))).projectOnPlane(n).normalize();
        for (const f of ['Index', 'Ring', 'Pinky']) {
          const b1 = S(f + '1'), b2 = S(f + '2');
          if (!b1 || !b2) continue;
          const v = wp(b2).sub(wp(b1)).projectOnPlane(n).normalize();
          const ang = Math.atan2(v.clone().cross(ref).dot(n), v.dot(ref));
          rotateAxis(b1, n, ang * P.serrage);
        }
      }
      if (P.etapes < 2) continue;
      // --- 2. majeur, annulaire, auriculaire : refermés phalange par phalange jusqu'au contact ---
      for (const [f, r] of [['Middle', P.rayonDoigt[0]], ['Ring', P.rayonDoigt[1]], ['Pinky', P.rayonDoigt[2]]]) {
        const os = [S(f + '1'), S(f + '2'), S(f + '3')];
        if (os.some(o => !o)) continue;
        this.refermer(os, side, distance, r, P.flexionMax, bout);
      }

      if (P.etapes < 3) continue;
      // --- 3. index sur la gâchette ---
      const ix = [S('Index1'), S('Index2'), S('Index3')];
      if (ix.every(Boolean)) {
        const cible = monde(...CONTACTS.gachette(s)).addScaledVector(Z, P.rayonDoigt[0] * 0.9);
        this.ik(ix, () => bout(ix[2]), cible, [null, b => this.curlAxis(b, b.children[0] || b, side), b => this.curlAxis(b, b.children[0] || b, side)], [40, 100, 80]);
        this.degager(ix, side, distance, P.rayonDoigt[0] * 0.85, bout);
      }

      if (P.etapes < 4) continue;
      // --- 4. pouce sur le joystick ---
      const px = [S('Thumb1'), S('Thumb2'), S('Thumb3')];
      if (px.every(Boolean)) {
        const cible = monde(...CONTACTS.stick(s)).addScaledVector(Y, P.rayonPouce);
        const plie = b => { const d = (b.children[0] && b.children[0].isBone ? wp(b.children[0]) : bout(b)).sub(wp(b)).normalize(); return d.cross(Y.clone().negate()).normalize(); };
        this.ik(px, () => bout(px[2]), cible, [null, plie, plie], [55, 60, 70]);
      }
    }
  }

  /**
   * Referme un doigt comme une vraie main : les trois articulations plient ensemble ; dès qu'une
   * phalange touche la manette, elle et les articulations avant elle s'arrêtent, les suivantes continuent.
   * Une phalange déjà enfoncée au départ ne compte comme contact que si elle s'enfonce davantage.
   */
  refermer(os, side, distance, r, maxi, bout) {
    const fin = i => (i < 2 ? wp(os[i + 1]) : bout(os[2]));
    const echantillons = i => { const a = wp(os[i]), b = fin(i); return [0.3, 0.6, 0.9, 1].map(t => a.clone().lerp(b, t)); };
    const ref = [0, 1, 2].map(i => echantillons(i).map(p => Math.min(distance(p), r)));
    const contact = i => echantillons(i).some((p, k) => distance(p) < ref[i][k] - 1e-4);
    const axeDe = j => this.curlAxis(os[j], j < 2 ? os[j + 1] : (os[2].children[0] || os[2]), side);
    const ratio = [1, 1.25, 0.85], total = [0, 0, 0], libre = [true, true, true];
    const pas = 1.5 * DEG;
    for (let it = 0; it < 120 && libre.some(Boolean); it++) {
      for (let j = 0; j < 3; j++) {
        if (!libre[j]) continue;
        const a = pas * ratio[j];
        if (total[j] + a > maxi[j] * DEG) { libre[j] = false; continue; }
        rotateAxis(os[j], axeDe(j), a); total[j] += a;
      }
      for (let i = 0; i < 3; i++) {
        if (contact(i)) {
          for (let j = 0; j <= i; j++) if (libre[j]) { rotateAxis(os[j], axeDe(j), -pas * ratio[j] * 0.5); libre[j] = false; }
        }
      }
    }
  }

  /** Écarte un doigt de la coque s'il la traverse (après la cinématique inverse). */
  degager(os, side, distance, r, bout) {
    for (let it = 0; it < 12; it++) {
      let pire = 0;
      for (let i = 0; i < 3; i++) {
        const a = wp(os[i]), b = i < 2 ? wp(os[i + 1]) : bout(os[2]);
        for (const t of [0.5, 1]) pire = Math.max(pire, r - distance(a.clone().lerp(b, t)));
      }
      if (pire <= 0) return;
      const axe = this.curlAxis(os[1], os[2], side);
      rotateAxis(os[1], axe, -2 * DEG);
    }
  }

  /** Cinématique inverse par descente cyclique (CCD) ; axes[i] = null → rotation libre. limites en degrés. */
  ik(os, bout, cible, axes, limites, iterations = 14) {
    const cumul = os.map(() => 0);
    for (let it = 0; it < iterations; it++) {
      for (let j = os.length - 1; j >= 0; j--) {
        const J = wp(os[j]), v1 = bout().sub(J), v2 = cible.clone().sub(J);
        if (v1.lengthSq() < 1e-10 || v2.lengthSq() < 1e-10) continue;
        if (axes[j]) {
          const axe = axes[j](os[j]);
          const a = v1.projectOnPlane(axe).normalize(), b = v2.projectOnPlane(axe).normalize();
          let ang = Math.atan2(a.clone().cross(b).dot(axe), a.dot(b));
          const lim = limites[j] * DEG;
          ang = THREE.MathUtils.clamp(cumul[j] + ang, -lim * 0.25, lim) - cumul[j];
          cumul[j] += ang; rotateAxis(os[j], axe, ang);
        } else {
          const q = new THREE.Quaternion().setFromUnitVectors(v1.normalize(), v2.normalize());
          const ang = 2 * Math.acos(THREE.MathUtils.clamp(q.w, -1, 1));
          const reste = limites[j] * DEG - cumul[j];
          if (reste <= 0) continue;
          if (ang > reste) q.slerp(new THREE.Quaternion(), 1 - reste / ang);
          cumul[j] += Math.min(ang, reste); rotateWorld(os[j], q);
        }
      }
      if (bout().distanceTo(cible) < 4e-4) break;
    }
  }

  /** Yeux vivants : cornée brillante (reflets), clignements et petits mouvements du regard. */
  preparerYeux(scene) {
    const trouve = re => this.bones.find(b => re.test(cleanName(b.name)));
    const mat = new THREE.MeshPhysicalMaterial({ color: '#000000', roughness: 0.035, metalness: 0, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1.4 });
    this.materials.push(mat);
    this.yeux = [];
    for (const c of ['l', 'r']) {
      const oeil = trouve(new RegExp('^' + c + 'eye$'));
      if (!oeil) continue;
      const haut = trouve(new RegExp('^' + c + 'eyeblinktop$')), bas = trouve(new RegExp('^' + c + 'eyeblinkbottom$'));
      const tete = oeil.parent, qTete = tete.getWorldQuaternion(new THREE.Quaternion()).invert();
      const lat = this.L.clone().applyQuaternion(qTete).normalize();        // axe gauche-droite, repère de la tête
      const centre = oeil.position.clone();
      const paupieres = [haut, bas].map(b => (b && b.parent === tete ? { b, p0: b.position.clone(), q0: b.quaternion.clone() } : null));
      // cornée : calotte de sphère devant l'œil, orientée vers l'avant de l'œil (entre les deux paupières)
      const avant = haut && bas ? wp(haut).add(wp(bas)).multiplyScalar(0.5).sub(wp(oeil)).normalize() : this.F.clone();
      const cornee = new THREE.Mesh(new THREE.SphereGeometry(RENDU_YEUX.rayon, 32, 12, 0, Math.PI * 2, 0, RENDU_YEUX.ouverture), mat);
      cornee.position.copy(wp(oeil)); cornee.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), avant);
      cornee.position.addScaledVector(avant, RENDU_YEUX.avance);
      cornee.renderOrder = 2; cornee.castShadow = false;
      scene.add(cornee); oeil.attach(cornee);
      this.yeux.push({ oeil, tete, lat, centre, haut: paupieres[0], bas: paupieres[1], cornee });
    }
    this.clign = { prochain: 1.5 + Math.random() * 3, t0: -1 };
    this.regard = { yaw: 0, pitch: 0, cy: 0, cp: 0, prochain: 0.8 };
  }

  /** Clignements (fermeture rapide, ouverture plus lente) et saccades du regard. */
  animerYeux(t, dt) {
    if (!this.yeux || !this.yeux.length) return;
    const C = this.clign, Y = RENDU_YEUX;
    if (C.t0 < 0 && t > C.prochain) C.t0 = t;
    let k = 0;
    if (C.t0 >= 0) {
      const u = (t - C.t0) / Y.dureeClignement;
      if (u >= 1) { C.t0 = -1; C.prochain = t + (Math.random() < 0.15 ? 0.22 : Y.intervalle[0] + Math.random() * (Y.intervalle[1] - Y.intervalle[0])); }
      else { k = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65; k = k * k * (3 - 2 * k); }
    }
    const R = this.regard;
    if (t > R.prochain) { R.cy = (Math.random() - 0.5) * Y.saccade[0] * 2 * DEG; R.cp = (Math.random() - 0.5) * Y.saccade[1] * 2 * DEG; R.prochain = t + 0.35 + Math.random() * 2.4; }
    const a = 1 - Math.exp(-Math.min(dt, 0.1) * 30);
    R.yaw += (R.cy - R.yaw) * a; R.pitch += (R.cp - R.pitch) * a;
    const q = new THREE.Quaternion();
    for (const E of this.yeux) {
      for (const [P, ang] of [[E.haut, Y.paupiereHaut], [E.bas, Y.paupiereBas]]) {
        if (!P) continue;
        q.setFromAxisAngle(E.lat, ang * DEG * k);
        P.b.position.copy(P.p0).sub(E.centre).applyQuaternion(q).add(E.centre);
        P.b.quaternion.copy(q).multiply(P.q0);
      }
      rotateAxis(E.oeil, this.U, R.yaw);
      rotateAxis(E.oeil, this.L, R.pitch + k * 0.06);
    }
  }

  /** Repère voulu pour la manette (d'après POSE.manette) : x = gauche du joueur, y = haut, z = vers la télé. */
  repereManette(hips) {
    const Mn = POSE.manette, x = this.L.clone();
    const z = this.F.clone().applyAxisAngle(x, -Mn.inclinaison * DEG);
    const y = new THREE.Vector3().crossVectors(z, x);
    const centre = hips.clone().addScaledVector(this.F, Mn.avant).addScaledVector(this.U, Mn.hauteur);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(centre);
  }

  /** Repère formé par les deux mains : la manette y reste attachée quand les bras bougent. */
  repereMains() {
    const B = this.B, hl = wp(B.leftHand), hr = wp(B.rightHand);
    const ml = B.leftMiddle1 ? wp(B.leftMiddle1) : hl.clone().addScaledVector(this.F, 0.08);
    const mr = B.rightMiddle1 ? wp(B.rightMiddle1) : hr.clone().addScaledVector(this.F, 0.08);
    const x = hl.clone().sub(hr).normalize();
    const z = ml.sub(hl).add(mr.sub(hr));
    z.addScaledVector(x, -z.dot(x)).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    return new THREE.Matrix4().makeBasis(x, y, z).setPosition(hl.add(hr).multiplyScalar(0.5));
  }

  /** Place la manette dans les mains, à chaque image (tilt : petit basculement pendant les sursauts). */
  updateController(tilt = 0) {
    const m = this.repereMains().multiply(this.manetteRel);
    if (tilt) m.multiply(new THREE.Matrix4().makeRotationX(-tilt));
    m.decompose(this.controller.position, this.controller.quaternion, _s);
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
    this.animerYeux(t, dt);

    // avant-bras : la manette se soulève ou tourne pendant un sursaut
    if (e) {
      const up = j.type === 'saut' ? 1 : 0;
      rotateAxis(B.leftForeArm, L, -e * (0.16 * up + (j.type === 'virage' ? 0.14 * j.dir : 0)));
      rotateAxis(B.rightForeArm, L, -e * (0.16 * up - (j.type === 'virage' ? 0.14 * j.dir : 0)));
    }

    // nouvelle manette : les pouces poussent vraiment les joysticks, les index pressent les gâchettes
    if (this.nouvelleManette) { this.jouer(t, e); return; }
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

  /**
   * Gestes de jeu : chaque joystick suit une trajectoire douce (le gauche pour se déplacer, le droit pour la caméra),
   * le pouce le suit par cinématique inverse ; les gâchettes sont pressées par moments et l'index suit.
   */
  jouer(t, e) {
    const B = this.B, A = POSE.animation, man = this.controller, et = man.userData.etat;
    this.updateController();
    man.updateMatrixWorld(true);
    const Mw = man.matrixWorld, Y = new THREE.Vector3().setFromMatrixColumn(Mw, 1).normalize(), Z = new THREE.Vector3().setFromMatrixColumn(Mw, 2).normalize();
    const n = (f, ph) => Math.sin(t * f + ph) * 0.6 + Math.sin(t * f * 2.31 + ph * 1.7) * 0.4;
    const act = A.pouces * (0.6 + 0.4 * Math.sin(t * 0.37)) * (1 + 0.6 * e);
    et.stickG = [n(1.3, 0) * 0.55 * act, (0.35 + n(0.9, 2) * 0.5) * act];        // gauche : avance surtout vers l'avant
    et.stickD = [n(2.1, 4) * 0.6 * act, n(1.7, 1) * 0.3 * act];                   // droit : regarde à gauche / à droite
    const presse = x => THREE.MathUtils.smoothstep(x, 0.55, 0.9);
    et.gachetteG = presse(Math.sin(t * 0.83 + 1.2) * 0.5 + 0.5) * 0.7 * act;
    et.gachetteD = Math.max(presse(Math.sin(t * 1.17) * 0.5 + 0.5), e) * act;
    man.animer();
    const P = POSE.prise2, bout = b => wp(b).add(wp(b).sub(wp(b.parent)).multiplyScalar(0.75));
    for (const [side, s] of [['left', 1], ['right', -1]]) {
      const S = k => B[side + k];
      const px = [S('Thumb1'), S('Thumb2'), S('Thumb3')], ix = [S('Index1'), S('Index2'), S('Index3')];
      if (px.every(Boolean)) {
        const [ax, az] = s > 0 ? et.stickG : et.stickD;
        const cible = man.sommetStick(s, ax, az).applyMatrix4(Mw).addScaledVector(Y, P.rayonPouce);
        const plie = b => { const d = (b.children[0] && b.children[0].isBone ? wp(b.children[0]) : bout(b)).sub(wp(b)).normalize(); return d.cross(Y.clone().negate()).normalize(); };
        this.ik(px, () => bout(px[2]), cible, [null, plie, plie], [12, 25, 25], 4);
      }
      if (ix.every(Boolean)) {
        const cible = man.appuiGachette(s, s > 0 ? et.gachetteG : et.gachetteD).applyMatrix4(Mw).addScaledVector(Z, P.rayonDoigt[0] * 0.9);
        this.ik(ix, () => bout(ix[2]), cible, [null, b => this.curlAxis(b, b.children[0] || b, side), b => this.curlAxis(b, b.children[0] || b, side)], [8, 30, 30], 4);
      }
    }
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
