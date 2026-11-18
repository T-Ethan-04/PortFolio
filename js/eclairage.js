// =====================================================================
//  eclairage.js — La lumière du salon suit l'heure réelle du visiteur.
//
//  • L'heure vient du navigateur (new Date()), sans aucun service externe.
//  • TOUS les réglages sont dans l'objet ECLAIRAGE juste en dessous.
//  • Entre deux repères horaires, couleurs et intensités sont interpolées
//    selon l'heure et la minute exactes. L'heure est relue chaque minute
//    et la scène glisse en douceur vers le nouvel état (jamais de saut).
//
//  Pour tester (à ajouter à la fin de l'adresse du site) :
//    ?heure=12   ?heure=23   ?heure=7h30   ?heure=19.5   force l'heure
//    ?cycle=60                             une journée entière en 60 s
//  Dans la console du navigateur :
//    __portfolio.heure(19.5)   change l'heure en direct (null = heure réelle)
// =====================================================================
import * as THREE from 'three';

export const ECLAIRAGE = {
  // ------------------------------------------------------------------
  //  1. REPÈRES HORAIRES — heure décimale (19.5 = 19 h 30).
  //  À chaque repère, la scène a exactement l'ambiance indiquée ;
  //  entre deux repères, tout est mélangé progressivement.
  //  La nuit est tenue de 21 h à 6 h (elle apparaît donc deux fois).
  // ------------------------------------------------------------------
  horaires: [
    { heure: 6,  ambiance: 'nuit' },          // fin de la nuit
    { heure: 7,  ambiance: 'aube' },          // aube : ciel orange et rose
    { heure: 8,  ambiance: 'matin' },         // début du jour
    { heure: 12, ambiance: 'midi' },          // lumière maximale
    { heure: 18, ambiance: 'finDeJournee' },  // fin du jour
    { heure: 19, ambiance: 'coucher' },       // crépuscule : orange
    { heure: 20, ambiance: 'heureBleue' },    // crépuscule : violet
    { heure: 21, ambiance: 'nuit' },          // début de la nuit
  ],

  // ------------------------------------------------------------------
  //  2. AMBIANCES — couleurs (#rrggbb) et intensités.
  //   ciel      : ce qu'on voit par la baie vitrée : ciel (haut, milieu, horizon),
  //               forêt au loin, à mi-distance et proche, brume (couleur et
  //               force de 0 à 1), étoiles (0 à 1), luminosité générale
  //   soleil    : lumière qui entre par la baie le jour
  //   lune      : lumière bleutée qui entre par la baie la nuit
  //   ambiance  : lumière diffuse de la pièce (couleur venant du haut, du sol,
  //               intensité) et force des reflets (1 = réglage d'origine)
  //   lampes    : 0 = éteintes, 1 = allumées (lampe arc, applique, ampoule)
  //   bandeau   : bandeau LED du plafond, de 0 à 1
  //   tele      : lueur de l'écran sur la pièce et sur l'avatar
  //   retroeclairage : lumière derrière la télé
  // ------------------------------------------------------------------
  ambiances: {
    nuit: {
      ciel: { haut: '#04060d', milieu: '#0a1222', horizon: '#18233c', loin: '#141c31', moyen: '#0b111d', pres: '#05080d', brume: '#1e2942', brumeForce: 0.45, etoiles: 1, luminosite: 1 },
      soleil: { couleur: '#ffffff', intensite: 0 },
      lune: { couleur: '#8ea8ff', intensite: 1.6 },
      ambiance: { couleurCiel: '#9aa8e0', couleurSol: '#3a2e26', intensite: 0.3, reflets: 0.9 },
      lampes: 1, bandeau: 1, tele: 4.2, retroeclairage: 14,
    },
    aube: {
      ciel: { haut: '#56679a', milieu: '#c98d9e', horizon: '#ffb27a', loin: '#8e7a92', moyen: '#4a4658', pres: '#1d1f26', brume: '#eab9aa', brumeForce: 0.7, etoiles: 0, luminosite: 1.25 },
      soleil: { couleur: '#ffad73', intensite: 7 },
      lune: { couleur: '#8ea8ff', intensite: 0 },
      ambiance: { couleurCiel: '#c7b8d4', couleurSol: '#6b5444', intensite: 0.9, reflets: 1.5 },
      lampes: 0.45, bandeau: 0.6, tele: 3.6, retroeclairage: 12,
    },
    matin: {
      ciel: { haut: '#7fa2c6', milieu: '#b4c6d3', horizon: '#e6ddd0', loin: '#8f9ea6', moyen: '#41544a', pres: '#1b281f', brume: '#e2e5e4', brumeForce: 0.7, etoiles: 0, luminosite: 1.5 },
      soleil: { couleur: '#ffe2c2', intensite: 9 },
      lune: { couleur: '#8ea8ff', intensite: 0 },
      ambiance: { couleurCiel: '#dde6f5', couleurSol: '#a08a76', intensite: 1.6, reflets: 2.0 },
      lampes: 0, bandeau: 0.3, tele: 3.2, retroeclairage: 9,
    },
    midi: {
      ciel: { haut: '#6a98c6', milieu: '#a7c0d2', horizon: '#dde5e8', loin: '#8ea2ab', moyen: '#435a4b', pres: '#1a2a20', brume: '#e8eced', brumeForce: 0.55, etoiles: 0, luminosite: 1.75 },
      soleil: { couleur: '#fff4e6', intensite: 11 },
      lune: { couleur: '#8ea8ff', intensite: 0 },
      ambiance: { couleurCiel: '#e6eefb', couleurSol: '#b09a86', intensite: 2.0, reflets: 2.4 },
      lampes: 0, bandeau: 0.25, tele: 3.2, retroeclairage: 8,
    },
    finDeJournee: {
      ciel: { haut: '#7493bd', milieu: '#bfc3c9', horizon: '#efd3ae', loin: '#999a9e', moyen: '#465243', pres: '#1d261f', brume: '#e8dac6', brumeForce: 0.6, etoiles: 0, luminosite: 1.5 },
      soleil: { couleur: '#ffd29a', intensite: 9 },
      lune: { couleur: '#8ea8ff', intensite: 0 },
      ambiance: { couleurCiel: '#e2dde8', couleurSol: '#a08a76', intensite: 1.5, reflets: 2.0 },
      lampes: 0, bandeau: 0.35, tele: 3.2, retroeclairage: 9,
    },
    coucher: {
      ciel: { haut: '#4b5a8e', milieu: '#d4866a', horizon: '#ffb25a', loin: '#86697a', moyen: '#3c3a48', pres: '#191b21', brume: '#f0b088', brumeForce: 0.6, etoiles: 0, luminosite: 1.3 },
      soleil: { couleur: '#ff9d52', intensite: 7.5 },
      lune: { couleur: '#8ea8ff', intensite: 0 },
      ambiance: { couleurCiel: '#dbb5a6', couleurSol: '#6b5444', intensite: 0.95, reflets: 1.5 },
      lampes: 0.3, bandeau: 0.7, tele: 3.4, retroeclairage: 11,
    },
    heureBleue: {
      ciel: { haut: '#1a1b45', milieu: '#523a74', horizon: '#a96077', loin: '#352f52', moyen: '#221f34', pres: '#100f1b', brume: '#6a5888', brumeForce: 0.5, etoiles: 0.3, luminosite: 1.05 },
      soleil: { couleur: '#ff9a6a', intensite: 0 },
      lune: { couleur: '#8ea8ff', intensite: 0.8 },
      ambiance: { couleurCiel: '#8a84c4', couleurSol: '#3a2e30', intensite: 0.45, reflets: 1.1 },
      lampes: 0.75, bandeau: 0.9, tele: 3.8, retroeclairage: 13,
    },
  },

  // ------------------------------------------------------------------
  //  3. COURSE DU SOLEIL ET DE LA LUNE
  // ------------------------------------------------------------------
  soleil: {
    lever: 6.25,          // le soleil passe l'horizon (6 h 15)
    coucher: 19.75,       // … et disparaît (19 h 45)
    hauteurMidi: 45,      // degrés au-dessus de l'horizon à 12 h (le plus haut)
    directionMatin: -40,  // degrés : le matin, la lumière file vers le mur de la télé…
    directionSoir: 25,    // … le soir, vers le canapé et l'avatar
  },
  lune: { hauteur: 25, direction: 11 },

  // ------------------------------------------------------------------
  //  4. DIVERS
  // ------------------------------------------------------------------
  lampes: { lampadaire: 20, halo: 1.4, applique: 5, tableau: 4 },   // puissance quand lampes = 1
  bandeauLed: 25,       // puissance du bandeau LED quand bandeau = 1
  sansOmbres: 0.45,     // qualité basse (sans ombres) : soleil et lune traversent les murs, on les atténue
  transition: 3,        // secondes pour glisser vers une nouvelle heure
};

// =====================================================================
//  Heure affichée
// =====================================================================
const DEG = Math.PI / 180;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Lit une heure écrite librement : "12", "7.5", "7,5", "7h30", "19:45", "7h". */
export function lireHeure(v) {
  if (v == null || v === '') return null;
  const m = String(v).trim().toLowerCase().match(/^(\d{1,2})(?:[.,](\d+))?(?:\s*[h:]\s*(\d{1,2})?)?$/);
  if (!m) return null;
  let h = +m[1];
  if (m[2]) h += parseFloat('0.' + m[2]);
  if (m[3]) h += +m[3] / 60;
  return h >= 0 && h <= 24 ? h % 24 : null;
}

const params = new URLSearchParams(location.search);
const horloge = {
  fixe: lireHeure(params.get('heure')),                    // null = heure réelle
  cycle: Math.max(0, parseFloat(params.get('cycle')) || 0), // secondes pour 24 h (test)
  depart: performance.now(),
};

function heureReelle() { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }

/** Heure (décimale) que la scène doit montrer. */
export function heureVoulue() {
  const base = horloge.fixe ?? heureReelle();
  if (!horloge.cycle) return base;
  return (base + (performance.now() - horloge.depart) / 1000 / horloge.cycle * 24) % 24;
}

/** Date pour l'horloge de la télé (suit ?heure= quand on teste). */
export function maintenant() {
  const d = new Date();
  if (horloge.fixe === null && !horloge.cycle) return d;
  const h = heureVoulue();
  d.setHours(Math.floor(h), Math.floor((h % 1) * 60 + 1e-6), 0, 0);
  return d;
}

// =====================================================================
//  Vue par la baie vitrée : forêt de sapins dans la brume.
//  Les silhouettes (3 plans : loin, mi-distance, proche) sont dessinées une
//  fois sur un canvas ; un shader les colore selon l'heure et fait dériver
//  la brume. Soleil et lune apparaissent dans le ciel quand ils sont visibles.
// =====================================================================
/**
 * @param plan     panneau du paysage, face à la pièce : { x, z0, z1, y0, y1 } (mètres)
 * @param fenetre  centre de la baie (pour placer soleil et lune) : { x, y, z }
 * @param oeil     hauteur des yeux de la caméra (ligne d'horizon), en mètres
 */
export function creerVue({ plan, fenetre, oeil = 1.85, anisotropie = 4 }) {
  const largeur = plan.z1 - plan.z0, hauteur = plan.y1 - plan.y0;
  const W = 2048, H = Math.round(W * hauteur / largeur);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const px = W / largeur;                                  // pixels par mètre
  const yPx = y => (plan.y1 - y) * px;                     // altitude → ligne du canvas
  const rnd = (a, b) => a + Math.random() * (b - a);

  // silhouette d'un sapin : tronc fin, branches en étages irréguliers, pointe effilée
  function sapin(x, yBase, h, w) {
    const etages = 9 + (Math.random() * 7 | 0), incl = rnd(-0.04, 0.04) * w;
    const cote = s => {
      const pts = [];
      for (let i = 1; i <= etages; i++) {
        const t = i / etages, y = yBase - h + h * Math.pow(t, 1.08) * 0.94;
        const demi = w * 0.5 * Math.pow(t, 0.85) * rnd(0.7, 1.18);
        const cx = x + incl * (1 - t);
        pts.push([cx + s * demi, y + h * rnd(0.005, 0.03)]);                 // bout de branche (tombant)
        if (i < etages) pts.push([cx + s * demi * rnd(0.25, 0.55), y - h * rnd(0.0, 0.025)]);
      }
      return pts;
    };
    const d = cote(1), gch = cote(-1).reverse();
    g.beginPath(); g.moveTo(x + incl, yBase - h - h * 0.03);
    for (const [a, b] of d) g.lineTo(a, b);
    g.lineTo(x + w * 0.04, yBase + 3); g.lineTo(x - w * 0.04, yBase + 3);
    for (const [a, b] of gch) g.lineTo(a, b);
    g.closePath(); g.fill();
  }
  // un plan de forêt : relief (en mètres, selon u = 0..1) + rangées de sapins
  function couche(couleur, relief, arbre) {
    g.fillStyle = couleur;
    const sol = u => relief(u) + arbre.h[0] * 0.3;   // sous les cimes : massif continu, sans trou
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, yPx(sol(x / W)));
    g.lineTo(W, H); g.closePath(); g.fill();
    for (let r = arbre.rangees - 1; r >= 0; r--) {
      for (let x = -60; x < W + 60;) {
        const u = Math.min(1, Math.max(0, x / W)), base = relief(u) - r * arbre.decalage - rnd(0, arbre.enfoncement);
        const k = r === 0 ? 1 : rnd(0.85, 1.15);
        sapin(x, yPx(base), rnd(arbre.h[0], arbre.h[1]) * k * px, rnd(arbre.l[0], arbre.l[1]) * k * px);
        x += rnd(arbre.pas[0], arbre.pas[1]) * px;
      }
    }
  }
  // u = 0 : côté du canapé (à gauche dans la baie) ; u = 1 : côté de la télé (à droite)
  const pente = u => 0.5 - u;
  const loin = u => 2.45 + 0.35 * Math.sin(u * 9 + 1) + 0.18 * Math.sin(u * 23 + 2) + 0.7 * pente(u);
  const moyen = u => 1.35 + 0.25 * Math.sin(u * 7 + 0.5) + 0.12 * Math.sin(u * 19) + 1.3 * pente(u);
  const proche = u => 0.0 + 0.3 * Math.sin(u * 5 + 1.3) + 0.15 * Math.sin(u * 13) + 1.6 * pente(u);
  couche('rgb(255,0,0)', loin, { h: [0.22, 0.42], l: [0.09, 0.15], pas: [0.035, 0.07], enfoncement: 0.12, rangees: 1, decalage: 0 });
  couche('rgb(0,255,0)', moyen, { h: [0.6, 1.1], l: [0.2, 0.32], pas: [0.08, 0.15], enfoncement: 0.25, rangees: 1, decalage: 0 });
  couche('rgb(0,0,255)', proche, { h: [1.9, 3.3], l: [0.55, 0.9], pas: [0.22, 0.45], enfoncement: 0.5, rangees: 1, decalage: 0 });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = anisotropie;
  const v = y => (y - plan.y0) / hauteur;
  const uniforms = {
    uMasque: { value: tex }, uTemps: { value: 0 }, uAspect: { value: largeur / hauteur },
    uHorizonV: { value: v(oeil) }, uLoinV: { value: v(2.3) }, uMoyenV: { value: v(1.3) }, uProcheV: { value: v(0.2) },
    uHaut: { value: new THREE.Color() }, uMilieu: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uLoin: { value: new THREE.Color() }, uMoyen: { value: new THREE.Color() }, uPres: { value: new THREE.Color() },
    uBrume: { value: new THREE.Color() }, uBrumeForce: { value: 0.5 }, uEtoiles: { value: 0 }, uLum: { value: 1 },
    uSoleil: { value: new THREE.Color(0, 0, 0) }, uSoleilUV: { value: new THREE.Vector2(-1, -1) },
    uLune: { value: new THREE.Color(0, 0, 0) }, uLuneUV: { value: new THREE.Vector2(-1, -1) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMasque; uniform float uTemps, uAspect, uHorizonV, uLoinV, uMoyenV, uProcheV;
      uniform vec3 uHaut, uMilieu, uHorizon, uLoin, uMoyen, uPres, uBrume, uSoleil, uLune;
      uniform float uBrumeForce, uEtoiles, uLum; uniform vec2 uSoleilUV, uLuneUV;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float bruit(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * bruit(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec2 uv = vUv;
        // ciel
        float t = clamp((uv.y - uHorizonV) / (1.0 - uHorizonV), 0.0, 1.0);
        vec3 col = mix(uHorizon, uMilieu, smoothstep(0.0, 0.3, t));
        col = mix(col, uHaut, smoothstep(0.25, 1.0, t));
        // étoiles
        vec2 gp = uv * vec2(uAspect * 80.0, 80.0); vec2 id = floor(gp); float h = hash(id);
        float etoile = step(0.986, h) * smoothstep(0.3, 0.0, length(fract(gp) - 0.5));
        col += vec3(0.85, 0.9, 1.0) * etoile * uEtoiles * (0.55 + 0.45 * sin(uTemps * (0.6 + h * 3.0) + h * 40.0)) * smoothstep(uHorizonV, uHorizonV + 0.12, uv.y);
        // soleil et lune
        vec2 ds = (uv - uSoleilUV) * vec2(uAspect, 1.0); float r2 = dot(ds, ds);
        col += uSoleil * (exp(-r2 * 2500.0) * 2.5 + exp(-r2 * 60.0) * 0.45);
        vec2 dl = (uv - uLuneUV) * vec2(uAspect, 1.0); float rl = length(dl);
        col += uLune * (smoothstep(0.011, 0.009, rl) * 1.4 + exp(-rl * rl * 500.0) * 0.22);
        // forêt et brume
        vec4 m = texture2D(uMasque, uv);
        float n1 = fbm(vec2(uv.x * uAspect * 1.6 + uTemps * 0.010, uv.y * 9.0));
        float n2 = fbm(vec2(uv.x * uAspect * 2.4 - uTemps * 0.007, uv.y * 13.0 + 3.0));
        float aiguilles = fbm(uv * vec2(uAspect * 90.0, 160.0));            // branches et aiguilles
        float massif = fbm(uv * vec2(uAspect * 9.0, 14.0));
        col = mix(col, mix(uLoin, uBrume, 0.2 + 0.35 * uBrumeForce), m.r);
        float vallee = smoothstep(uMoyenV - 0.05, uMoyenV + 0.04, uv.y) * (1.0 - smoothstep(uLoinV, uLoinV + 0.07, uv.y));
        col = mix(col, uBrume, uBrumeForce * vallee * (0.35 + 0.65 * smoothstep(0.3, 0.75, n1)));
        float colonnes = fbm(vec2(uv.x * uAspect * 45.0, uv.y * 4.0));        // troncs et colonnes d'arbres
        vec3 moyen = uMoyen * (0.75 + 0.5 * aiguilles) * (0.8 + 0.4 * colonnes);
        col = mix(col, mix(moyen, uBrume, 0.42 * uBrumeForce), m.g);
        float bas = smoothstep(uProcheV - 0.08, uProcheV + 0.05, uv.y) * (1.0 - smoothstep(uMoyenV - 0.02, uMoyenV + 0.06, uv.y));
        col = mix(col, uBrume, uBrumeForce * bas * 0.8 * smoothstep(0.3, 0.8, n2));
        vec3 pres = uPres * (0.55 + 0.9 * aiguilles) * (0.8 + 0.4 * massif) * (0.7 + 0.6 * colonnes);
        pres *= 0.75 + 0.45 * smoothstep(uProcheV - 0.25, uProcheV + 0.3, uv.y);
        col = mix(col, pres, m.b);
        float pied = 1.0 - smoothstep(uProcheV - 0.3, uProcheV + 0.02, uv.y);
        col = mix(col, uBrume, uBrumeForce * pied * 0.25 * smoothstep(0.45, 0.9, n2));
        col = mix(col, uBrume, uBrumeForce * 0.03);
        gl_FragColor = vec4(col * uLum, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  // position dans le paysage d'une direction (vers le soleil ou la lune), vue depuis la baie
  const vers = (dir, out) => {
    if (dir.x > -0.02) return out.set(-1, -1);              // l'astre n'est pas du côté de la baie
    const k = (plan.x - fenetre.x) / dir.x;
    const z = fenetre.z + dir.z * k, y = fenetre.y + dir.y * k;
    return out.set((plan.z1 - z) / largeur, (y - plan.y0) / hauteur);
  };
  return {
    material,
    /** Couleurs du paysage + soleil/lune ({ versSoleil, soleil, versLune, lune }). */
    mettreAJour(ciel, astres) {
      uniforms.uHaut.value.copy(ciel.haut); uniforms.uMilieu.value.copy(ciel.milieu); uniforms.uHorizon.value.copy(ciel.horizon);
      uniforms.uLoin.value.copy(ciel.loin); uniforms.uMoyen.value.copy(ciel.moyen); uniforms.uPres.value.copy(ciel.pres);
      uniforms.uBrume.value.copy(ciel.brume); uniforms.uBrumeForce.value = ciel.brumeForce;
      uniforms.uEtoiles.value = ciel.etoiles; uniforms.uLum.value = ciel.luminosite;
      if (astres) {
        vers(astres.versSoleil, uniforms.uSoleilUV.value); uniforms.uSoleil.value.copy(astres.soleil);
        vers(astres.versLune, uniforms.uLuneUV.value); uniforms.uLune.value.copy(astres.lune);
      }
    },
    update(t) { uniforms.uTemps.value = t; },
  };
}

// =====================================================================
//  Pilotage de la scène
// =====================================================================
function compiler(v) {
  if (typeof v === 'string') return new THREE.Color(v);
  if (typeof v === 'number') return v;
  const o = {}; for (const k in v) o[k] = compiler(v[k]); return o;
}
function copier(v) {
  if (v && v.isColor) return v.clone();
  if (typeof v === 'number') return v;
  const o = {}; for (const k in v) o[k] = copier(v[k]); return o;
}
/** Complète une ambiance avec les réglages d'une autre (clés oubliées). */
function completer(v, base) {
  for (const k in base) {
    if (v[k] === undefined) v[k] = copier(base[k]);
    else if (!base[k].isColor && typeof base[k] === 'object') completer(v[k], base[k]);
  }
  return v;
}
function melanger(out, a, b, t) {
  for (const k in out) {
    if (out[k].isColor) out[k].lerpColors(a[k], b[k], t);
    else if (typeof out[k] === 'number') out[k] = a[k] + (b[k] - a[k]) * t;
    else melanger(out[k], a[k], b[k], t);
  }
}
function directionDepuis(hauteur, orientation, out) {
  // sens de propagation de la lumière : vers +x (on entre par la fenêtre du mur gauche)
  const e = hauteur * DEG, a = orientation * DEG;
  return out.set(Math.cos(e) * Math.cos(a), -Math.sin(e), Math.cos(e) * Math.sin(a)).normalize();
}

/** Hauteur du soleil (degrés), négative sous l'horizon ; maximale à 12 h. */
export function hauteurSoleil(h) {
  const S = ECLAIRAGE.soleil;
  const x = h <= 12 ? (h - S.lever) / (12 - S.lever) : (S.coucher - h) / (S.coucher - 12);
  return x >= 0 ? S.hauteurMidi * Math.sin(Math.min(x, 1) * Math.PI / 2) : Math.max(-30, S.hauteurMidi * x * Math.PI / 2);
}
function orientationSoleil(h) {
  const S = ECLAIRAGE.soleil;
  return h <= 12 ? S.directionMatin * (1 - clamp01((h - S.lever) / (12 - S.lever)))
    : S.directionSoir * clamp01((h - 12) / (S.coucher - 12));
}

/**
 * Relie l'éclairage à la scène.
 * @param room      objet renvoyé par buildRoom (scene.js)
 * @param renderer  pour savoir si les ombres sont actives
 */
export function creerEclairage(room, renderer) {
  const C = ECLAIRAGE;
  const nuit = compiler(C.ambiances.nuit);
  const ambiances = {};
  for (const [nom, a] of Object.entries(C.ambiances)) ambiances[nom] = completer(compiler(a), nuit);
  const reperes = C.horaires
    .filter(r => ambiances[r.ambiance])
    .map(r => ({ heure: ((r.heure % 24) + 24) % 24, etat: ambiances[r.ambiance] }))
    .sort((a, b) => a.heure - b.heure);
  if (!reperes.length) reperes.push({ heure: 0, etat: nuit });

  const etat = copier(nuit);
  function etatA(h) {
    let i = reperes.length - 1;
    for (let k = 0; k < reperes.length; k++) if (reperes[k].heure <= h) i = k;
    const a = reperes[i], b = reperes[(i + 1) % reperes.length];
    let h1 = b.heure, hh = h;
    if (h1 <= a.heure) h1 += 24;
    if (hh < a.heure) hh += 24;
    melanger(etat, a.etat, b.etat, h1 > a.heure ? smooth(0, 1, (hh - a.heure) / (h1 - a.heure)) : 0);
  }

  const L = room.lumieres;
  const dir = new THREE.Vector3();
  const ampouleAllumee = room.ampoule.color.clone(), ampouleEteinte = new THREE.Color(0.5, 0.48, 0.45);
  let envBase = room.scene.environmentIntensity, aAppliquer = false;
  room.onEnvironment(() => { envBase = room.scene.environmentIntensity; aAppliquer = true; });

  const info = { heure: 0, hauteurSoleil: 0, soleilLeve: false };
  const versSoleil = new THREE.Vector3(), versLune = new THREE.Vector3();
  const halo = { versSoleil, versLune, soleil: new THREE.Color(), lune: new THREE.Color() };
  const ledAllumee = room.bandeau.materiau.color.clone(), ledEteinte = new THREE.Color(0.35, 0.33, 0.31);
  room.enveloppeSoleil.visible = true;   // soleil et lune n'entrent que par la baie
  function appliquer(h) {
    etatA(h);
    const e = hauteurSoleil(h), leve = e > 0;
    const attenuation = renderer.shadowMap.enabled ? 1 : C.sansOmbres;
    directionDepuis(Math.max(e, 0.5), orientationSoleil(h), versSoleil).negate();
    directionDepuis(C.lune.hauteur, C.lune.direction, versLune).negate();
    const visibiliteLune = 1 - smooth(-8, 0, e);
    if (leve) {      // le soleil entre par la baie
      dir.copy(versSoleil).negate();
      L.ciel.color.copy(etat.soleil.couleur);
      L.ciel.intensity = etat.soleil.intensite * smooth(0, 4, e) * attenuation;
    } else {         // la lune
      dir.copy(versLune).negate();
      L.ciel.color.copy(etat.lune.couleur);
      L.ciel.intensity = etat.lune.intensite * visibiliteLune * attenuation;
    }
    L.ciel.position.copy(L.ciel.target.position).addScaledVector(dir, -15);
    halo.soleil.copy(etat.soleil.couleur).multiplyScalar(smooth(-3, 3, e) * 1.6);
    halo.lune.setRGB(0.9, 0.94, 1.0).multiplyScalar(visibiliteLune * clamp01(etat.lune.intensite));

    L.hemi.color.copy(etat.ambiance.couleurCiel);
    L.hemi.groundColor.copy(etat.ambiance.couleurSol);
    L.hemi.intensity = etat.ambiance.intensite;
    room.scene.environmentIntensity = envBase * etat.ambiance.reflets;

    const k = clamp01(etat.lampes), P = C.lampes;
    L.lampadaire.intensity = P.lampadaire * k;
    L.halo.intensity = P.halo * k;
    L.applique.intensity = P.applique * k;
    if (L.tableau) L.tableau.intensity = P.tableau * (0.35 + 0.65 * k);   // la liseuse du tableau reste un peu allumée le jour
    room.ampoule.color.lerpColors(ampouleEteinte, ampouleAllumee, k);
    room.atmosphere.setLevel(k);

    const b = clamp01(etat.bandeau);
    L.bandeau.intensity = C.bandeauLed * b;
    room.bandeau.materiau.color.lerpColors(ledEteinte, ledAllumee, Math.sqrt(b));

    L.tele.intensity = etat.tele;
    L.led.intensity = etat.retroeclairage;
    room.vue.mettreAJour(etat.ciel, halo);
    info.heure = h; info.hauteurSoleil = e; info.soleilLeve = leve;
  }

  let cible = heureVoulue(), affichee = cible, ombres = renderer.shadowMap.enabled;
  appliquer(affichee);

  // l'heure est relue au début de chaque minute (et au retour sur l'onglet)
  (function planifier() {
    setTimeout(() => { cible = heureVoulue(); planifier(); }, 60000 - (Date.now() % 60000) + 30);
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cible = heureVoulue(); });

  return {
    etat, info, config: C,
    update(dt, t = 0) {
      room.vue.update(t);
      if (horloge.cycle) cible = heureVoulue();
      const d = (((cible - affichee) % 24) + 36) % 24 - 12;   // écart le plus court, en heures
      if (Math.abs(d) > 1e-6) {
        if (horloge.cycle || Math.abs(d) < 1e-4) affichee = cible;
        else affichee = (affichee + d * (1 - Math.exp(-dt * 3 / C.transition)) + 24) % 24;
        aAppliquer = true;
      }
      if (renderer.shadowMap.enabled !== ombres) { ombres = renderer.shadowMap.enabled; aAppliquer = true; }
      if (aAppliquer) { aAppliquer = false; appliquer(affichee); }
    },
    /** Change l'heure en direct (ex. 19.5 ou "7h30") ; null = retour à l'heure réelle. */
    heure(h) {
      horloge.fixe = h == null ? null : lireHeure(h);
      horloge.depart = performance.now();
      cible = heureVoulue();
      return cible;
    },
  };
}
