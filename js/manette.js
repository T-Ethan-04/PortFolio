// =====================================================================
//  manette.js — Manette réaliste : coque lisse (assets/models/manette.glb,
//  générée depuis manette_forme.js) + pièces mobiles dessinées ici :
//  joysticks, croix, boutons, gâchettes, boutons d'épaule, anneau lumineux.
//  Repère : X = gauche du joueur, Y = haut, Z = vers la télé (mètres).
// =====================================================================
import * as THREE from 'three';
import { FORME, dessus, normaleCoque, sdfCoque } from './manette_forme.js';

export const MANETTE_FICHIER = 'assets/models/manette.glb';

export const MANETTE = {
  coque: '#d5d3ce',        // blanc cassé, mat (albédo réaliste : ne « brûle » pas sous la lampe)
  coqueBas: '#c8c5bf',     // coque inférieure, un ton plus chaud
  sombre: '#1c1d20',       // joysticks, croix, gâchettes
  boutons: '#34363b',      // boutons d'action (fumé)
};

// ---------------------------------------------------------------------
//  Relief procédural (grain, picots des poignées, joint de coque)
//  calculé au pixel près en repère objet : net de près comme de loin.
// ---------------------------------------------------------------------
const GLSL_BRUIT = /* glsl */`
  varying vec3 vObj;
  float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float bruit(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  vec3 reliefNormale(float h, vec3 n, float faceDir) {
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1) * faceDir;
    vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    return normalize(abs(det) * n - g);
  }
`;

/** Ajoute à un matériau un relief procédural h(vObj) et une teinte éventuelle. */
function avecRelief(mat, { hauteur, teinte = '', rugosite = '' }) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_BRUIT + `\nfloat hauteurRelief(vec3 p) { ${hauteur} }`)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + teinte)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + rugosite)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = reliefNormale(hauteurRelief(vObj), normal, faceDirection);');
  };
  mat.customProgramCacheKey = () => 'relief:' + hauteur.length + teinte.length + rugosite.length + hauteur.slice(0, 40);
  return mat;
}

// joint de coque : horizontal sur le corps, puis il descend le long des poignées
const JOINT = 'float joint(vec3 p) { return p.y - (-0.0035 + min(0.0, p.z + 0.012) * 0.45); }';

function materiaux() {
  const coque = avecRelief(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.45 }), {
    hauteur: `
      ${'' /* grain fin du plastique */}
      float h = (bruit(p * 4200.0) - 0.5) * 0.0000045 + (bruit(p * 900.0) - 0.5) * 0.000004;
      float j = p.y - (-0.0035 + min(0.0, p.z + 0.012) * 0.45);
      ${'' /* picots sur l'arrière des poignées (coque inférieure) */}
      float zone = smoothstep(-0.0005, -0.004, j) * smoothstep(-0.018, -0.03, p.z);
      vec3 c = fract(p / 0.0017) - 0.5;
      h += zone * 0.000035 * smoothstep(0.32, 0.18, length(c));
      ${'' /* rainure du joint de coque */}
      h -= 0.00006 * (1.0 - smoothstep(0.00012, 0.00042, abs(j)));
      return h;`,
    teinte: `{
      float j = vObj.y - (-0.0035 + min(0.0, vObj.z + 0.012) * 0.45);
      vec3 haut = vec3(${new THREE.Color(MANETTE.coque).toArray().map(v => v.toFixed(4)).join(',')});
      vec3 bas = vec3(${new THREE.Color(MANETTE.coqueBas).toArray().map(v => v.toFixed(4)).join(',')});
      diffuseColor.rgb = mix(bas, haut, smoothstep(-0.0002, 0.0002, j));
      diffuseColor.rgb *= 1.0 - 0.55 * (1.0 - smoothstep(0.00008, 0.0003, abs(j)));
    }`,
    rugosite: `{
      float j = vObj.y - (-0.0035 + min(0.0, vObj.z + 0.012) * 0.45);
      roughnessFactor = mix(0.62, roughnessFactor, smoothstep(-0.0002, 0.0002, j));
    }`,
  });
  const caoutchouc = avecRelief(new THREE.MeshPhysicalMaterial({ color: MANETTE.sombre, roughness: 0.78, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color('#3a3c40'), side: THREE.DoubleSide }), {
    // nervures rayonnantes sur le bord des joysticks + grain
    hauteur: `
      float r = length(p.xz), a = atan(p.z, p.x);
      float bord = smoothstep(0.0068, 0.0080, r);
      return bord * 0.00003 * (0.5 + 0.5 * sin(a * 36.0)) + (bruit(p * 5000.0) - 0.5) * 0.000004;`,
  });
  const plastiqueSombre = new THREE.MeshPhysicalMaterial({ color: MANETTE.sombre, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.3, side: THREE.DoubleSide });
  const fume = new THREE.MeshPhysicalMaterial({ color: MANETTE.boutons, roughness: 0.45, clearcoat: 0.2, clearcoatRoughness: 0.3, metalness: 0, side: THREE.DoubleSide });
  const blanc = new THREE.MeshPhysicalMaterial({ color: MANETTE.coque, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.35 });
  const satin = new THREE.MeshPhysicalMaterial({ color: '#2a2b2f', roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.65, 2.6) });
  const metal = new THREE.MeshStandardMaterial({ color: '#8d9096', metalness: 1, roughness: 0.35 });
  return { coque, caoutchouc, plastiqueSombre, fume, blanc, satin, led, metal };
}

/** Repère posé sur la coque en (x, z) : origine sur la surface, Y = normale. */
function surCoque(x, z, decalage = 0) {
  const y = dessus(x, z);
  const n = new THREE.Vector3(...normaleCoque(x, y, z));
  const o = new THREE.Object3D();
  o.position.set(x, y + decalage, z);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  return o;
}

/** Pièce de révolution ; le profil est réordonné de bas en haut pour que les faces regardent vers l'extérieur. */
const tour = (pts, seg = 48) => {
  const p = pts.map(([r, y]) => new THREE.Vector2(r, y));
  if (p[0].y > p[p.length - 1].y) p.reverse();
  return new THREE.LatheGeometry(p, seg);
};

/** Construit la manette. coqueGLTF : résultat du chargement de manette.glb. */
export function creerManette(coqueGLTF) {
  const g = new THREE.Group(); g.name = 'manette';
  const M = materiaux();
  const ajout = (geo, mat, parent = g, ombre = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = ombre; m.receiveShadow = true; parent.add(m); return m; };

  // ---------- coque ----------
  coqueGLTF.scene.traverse(o => { if (o.isMesh) { o.material = M.coque; o.castShadow = o.receiveShadow = true; } });
  g.add(coqueGLTF.scene);

  // ---------- joysticks (cuvette, soufflet, tige, chapeau creusé à bord nervuré) ----------
  const sticks = [];
  for (const s of [1, -1]) {
    const x = s * FORME.stick[0], z = FORME.stick[1], fond = FORME.cuvette.fond;
    const base = new THREE.Object3D(); base.position.set(x, fond, z); g.add(base);
    ajout(tour([[0.0123, 0.0002], [0.0118, 0.0011], [0.0098, 0.0021], [0.0072, 0.0029], [0.0052, 0.0034], [0.0046, 0.0036]]), M.caoutchouc, base);
    const pivot = new THREE.Group(); pivot.position.y = 0.0016; base.add(pivot);
    ajout(new THREE.CylinderGeometry(0.0040, 0.0043, 0.0075, 24).translate(0, 0.0045, 0), M.plastiqueSombre, pivot);
    const chapeau = ajout(tour([
      [0.0001, 0.0103], [0.0035, 0.0105], [0.0060, 0.0110], [0.0074, 0.0116], [0.0081, 0.0121], [0.0086, 0.0123],
      [0.0090, 0.0121], [0.0093, 0.0115], [0.0093, 0.0101], [0.0090, 0.0090], [0.0080, 0.0084], [0.0045, 0.0081],
    ], 64), M.caoutchouc, pivot);
    chapeau.geometry.computeVertexNormals();
    sticks.push({ pivot, cote: s });
  }

  // ---------- croix directionnelle (gauche du joueur) ----------
  {
    const o = surCoque(FORME.croix[0], FORME.croix[1]); g.add(o);
    const L = 0.0105, l = 0.0039, r = 0.0012;
    const sh = new THREE.Shape();
    const pts = [[l, l], [L, l], [L, -l], [l, -l], [l, -L], [-l, -L], [-l, -l], [-L, -l], [-L, l], [-l, l], [-l, L], [l, L]];
    sh.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: r * 0.8, bevelSegments: 3, curveSegments: 4 });
    geo.rotateX(-Math.PI / 2).translate(0, 0.0004, 0);
    ajout(geo, M.plastiqueSombre, o);
    // petit creux central
    ajout(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0004, 24).translate(0, 0.0031, 0), M.fume, o, false);
  }

  // ---------- quatre boutons d'action (droite du joueur), sans symboles ----------
  const boutons = [];
  for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const o = surCoque(FORME.boutons[0] + dx * FORME.ecartBoutons, FORME.boutons[1] + dz * FORME.ecartBoutons, -0.0006); g.add(o);
    const b = ajout(tour([[0.0001, 0.0040], [0.0025, 0.0039], [0.0040, 0.0035], [0.0047, 0.0027], [0.0048, 0.0004], [0.0049, 0]], 40), M.fume, o);
    boutons.push(b);
  }

  // ---------- bouton central + anneau lumineux, deux petits boutons de menu ----------
  {
    const o = surCoque(FORME.centre[0], FORME.centre[1], -0.0004); g.add(o);
    ajout(tour([[0.0001, 0.0026], [0.0030, 0.0025], [0.0048, 0.0019], [0.0052, 0.0008], [0.0052, 0]], 40), M.fume, o);
    const anneau = ajout(new THREE.RingGeometry(0.0057, 0.0066, 48).rotateX(-Math.PI / 2).translate(0, 0.0007, 0), M.led, o, false);
    anneau.renderOrder = 1;
  }
  for (const s of [1, -1]) {
    const o = surCoque(s * FORME.menus[0], FORME.menus[1], -0.0003); g.add(o);
    const pill = new THREE.CapsuleGeometry(0.0016, 0.0042, 4, 12).rotateZ(Math.PI / 2).rotateY(s * 0.35);
    pill.scale(1, 0.55, 1); ajout(pill.translate(0, 0.0006, 0), M.plastiqueSombre, o);
  }

  // ---------- tranche avant : boutons d'épaule et gâchettes ----------
  const gachettes = [];
  for (const s of [1, -1]) {
    const E = FORME.epaule;
    const ep = new THREE.Shape();
    const w = E.largeur / 2, hh = 0.0026, rr = 0.0022;
    ep.moveTo(-w + rr, -hh); ep.lineTo(w - rr, -hh); ep.quadraticCurveTo(w, -hh, w, -hh + rr); ep.lineTo(w, hh - rr); ep.quadraticCurveTo(w, hh, w - rr, hh);
    ep.lineTo(-w + rr, hh); ep.quadraticCurveTo(-w, hh, -w, hh - rr); ep.lineTo(-w, -hh + rr); ep.quadraticCurveTo(-w, -hh, -w + rr, -hh);
    const geo = new THREE.ExtrudeGeometry(ep, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 3, curveSegments: 6 });
    geo.translate(0, 0, -0.003);
    const epaule = ajout(geo, M.satin); epaule.position.set(s * E.x, E.y, E.z); epaule.rotation.x = -0.45;

    // gâchette : profil courbe (vu de côté), pivot en haut
    const G = FORME.gachette;
    const pr = new THREE.Shape();
    pr.moveTo(-0.001, 0.0); pr.quadraticCurveTo(0.0068, -0.0015, 0.0098, -0.0095); pr.quadraticCurveTo(0.0115, -0.0165, 0.0098, -0.0205);
    pr.quadraticCurveTo(0.0086, -0.0222, 0.0074, -0.0196); pr.quadraticCurveTo(0.0068, -0.0125, 0.0036, -0.0062); pr.quadraticCurveTo(0.0016, -0.0035, -0.0012, -0.0032); pr.closePath();
    const gg = new THREE.ExtrudeGeometry(pr, { depth: G.largeur - 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0009, bevelSegments: 3, curveSegments: 12 });
    gg.translate(0, 0, -(G.largeur - 0.003) / 2); gg.rotateY(-Math.PI / 2);    // profil dans le plan (Z, Y), épaisseur selon X
    const pivot = new THREE.Group(); pivot.position.set(s * G.x, G.pivot[0], G.pivot[1]); g.add(pivot);
    ajout(gg, M.satin, pivot);
    gachettes.push({ pivot, cote: s });
  }

  // ---------- animation des pièces ----------
  const etat = { stickG: [0, 0], stickD: [0, 0], gachetteG: 0, gachetteD: 0 };
  /** Sommet du chapeau d'un joystick (repère manette) pour une inclinaison donnée — pour y garder le pouce. */
  g.sommetStick = (s, ax, az, v = new THREE.Vector3()) => {
    const e = new THREE.Euler(az * 0.38, 0, -ax * 0.38);
    return v.set(0, 0.0119, 0).applyEuler(e).add(new THREE.Vector3(s * FORME.stick[0], FORME.cuvette.fond + 0.0016, FORME.stick[1]));
  };
  /** Point d'appui de l'index sur une gâchette enfoncée de p (0 → 1). */
  g.appuiGachette = (s, p, v = new THREE.Vector3()) => {
    const G = FORME.gachette, e = new THREE.Euler(-p * 0.32, 0, 0);
    return v.set(0, -0.012, 0.0105).applyEuler(e).add(new THREE.Vector3(s * G.x, G.pivot[0], G.pivot[1]));
  };
  g.userData.etat = etat;
  g.animer = () => {
    for (const st of sticks) {
      const [ax, az] = st.cote > 0 ? etat.stickG : etat.stickD;
      st.pivot.rotation.set(az * 0.38, 0, -ax * 0.38);
    }
    for (const gc of gachettes) gc.pivot.rotation.x = -(gc.cote > 0 ? etat.gachetteG : etat.gachetteD) * 0.32;
  };
  /** Couleur de l'anneau lumineux (suit la section du menu). */
  g.setLight = hex => { M.led.color.copy(new THREE.Color(hex)).multiplyScalar(2.4); };
  return g;
}

// ---------------------------------------------------------------------
//  Points de contact pour les doigts (repère de la manette)
// ---------------------------------------------------------------------
export const CONTACTS = {
  /** sommet du chapeau d'un joystick (s = +1 gauche, -1 droite), légèrement côté joueur */
  stick: s => [s * FORME.stick[0], FORME.cuvette.fond + 0.0016 + 0.0115, FORME.stick[1] - 0.0015],
  /** face avant d'une gâchette, là où se pose la pulpe de l'index */
  gachette: s => [s * FORME.gachette.x, FORME.gachette.pivot[0] - 0.012, FORME.gachette.pivot[1] + 0.0105],
};

/** Distance signée à la manette (coque + gâchettes) — pour poser les doigts sans traverser. */
export function sdfManette(x, y, z) {
  let d = sdfCoque(x, y, z);
  for (const s of [1, -1]) {      // gâchettes approchées par des boîtes
    const G = FORME.gachette;
    const qx = Math.abs(x - s * G.x) - G.largeur / 2, qy = Math.abs(y - (G.pivot[0] - 0.0105)) - 0.0105, qz = Math.abs(z - (G.pivot[1] + 0.0055)) - 0.0045;
    const b = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0);
    d = Math.min(d, b);
  }
  return d;
}
