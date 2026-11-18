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
  //   ciel      : ce qu'on voit par la fenêtre (haut, milieu, horizon du ciel,
  //               couleur des immeubles, part des fenêtres allumées de 0 à 1,
  //               reflet du ciel sur les vitres, étoiles de 0 à 1, luminosité)
  //   soleil    : lumière qui entre par la fenêtre le jour
  //   lune      : lumière bleutée de la nuit
  //   ambiance  : lumière diffuse de la pièce (couleur venant du haut, du sol,
  //               intensité) et force des reflets (1 = réglage d'origine)
  //   lampes    : 0 = éteintes, 1 = allumées (lampadaire, applique, ampoule)
  //   tele      : lueur de l'écran sur la pièce et sur l'avatar
  //   retroeclairage : bande lumineuse derrière la télé
  // ------------------------------------------------------------------
  ambiances: {
    nuit: {
      ciel: { haut: '#0a1024', milieu: '#1d2448', horizon: '#3a2c4a', immeubles: '#151723', fenetresAllumees: 0.35, vitres: 0, etoiles: 0.7, luminosite: 1 },
      soleil: { couleur: '#ffffff', intensite: 0 },
      lune: { couleur: '#8ea2ff', intensite: 0.55 },
      ambiance: { couleurCiel: '#aab6ff', couleurSol: '#3a2a20', intensite: 0.22, reflets: 1 },
      lampes: 1, tele: 4.2, retroeclairage: 14,
    },
    aube: {
      ciel: { haut: '#4f6299', milieu: '#d88d9a', horizon: '#ffae6b', immeubles: '#2b2a40', fenetresAllumees: 0.18, vitres: 0.25, etoiles: 0, luminosite: 1.25 },
      soleil: { couleur: '#ffa970', intensite: 6 },
      lune: { couleur: '#8ea2ff', intensite: 0 },
      ambiance: { couleurCiel: '#c9b4d4', couleurSol: '#6b4a3a', intensite: 0.9, reflets: 1.5 },
      lampes: 0.45, tele: 3.6, retroeclairage: 12,
    },
    matin: {
      ciel: { haut: '#5f9be0', milieu: '#a8cbee', horizon: '#f2e0c6', immeubles: '#7c8699', fenetresAllumees: 0.05, vitres: 0.5, etoiles: 0, luminosite: 1.6 },
      soleil: { couleur: '#ffe3c4', intensite: 8 },
      lune: { couleur: '#8ea2ff', intensite: 0 },
      ambiance: { couleurCiel: '#dde7ff', couleurSol: '#a08a76', intensite: 1.7, reflets: 2.2 },
      lampes: 0, tele: 3.2, retroeclairage: 9,
    },
    midi: {
      ciel: { haut: '#3f86e6', milieu: '#86bcf0', horizon: '#d6e9fb', immeubles: '#97a2b6', fenetresAllumees: 0.02, vitres: 0.55, etoiles: 0, luminosite: 1.9 },
      soleil: { couleur: '#fff6ea', intensite: 10 },
      lune: { couleur: '#8ea2ff', intensite: 0 },
      ambiance: { couleurCiel: '#e6efff', couleurSol: '#b09a86', intensite: 2.1, reflets: 2.6 },
      lampes: 0, tele: 3.2, retroeclairage: 8,
    },
    finDeJournee: {
      ciel: { haut: '#5486cc', milieu: '#a3bfdf', horizon: '#f0d0a2', immeubles: '#78808f', fenetresAllumees: 0.06, vitres: 0.5, etoiles: 0, luminosite: 1.55 },
      soleil: { couleur: '#ffd9a8', intensite: 8 },
      lune: { couleur: '#8ea2ff', intensite: 0 },
      ambiance: { couleurCiel: '#e4e0ee', couleurSol: '#a08a76', intensite: 1.7, reflets: 2.2 },
      lampes: 0, tele: 3.2, retroeclairage: 9,
    },
    coucher: {
      ciel: { haut: '#46578f', milieu: '#d9866a', horizon: '#ffb35c', immeubles: '#383350', fenetresAllumees: 0.16, vitres: 0.35, etoiles: 0, luminosite: 1.35 },
      soleil: { couleur: '#ff9f55', intensite: 6.5 },
      lune: { couleur: '#8ea2ff', intensite: 0 },
      ambiance: { couleurCiel: '#dcb6a8', couleurSol: '#6b4a3a', intensite: 1.0, reflets: 1.6 },
      lampes: 0.3, tele: 3.4, retroeclairage: 11,
    },
    heureBleue: {
      ciel: { haut: '#1d1b48', milieu: '#583979', horizon: '#b65f7a', immeubles: '#1b1930', fenetresAllumees: 0.3, vitres: 0.1, etoiles: 0.25, luminosite: 1.05 },
      soleil: { couleur: '#ff9a6a', intensite: 0 },
      lune: { couleur: '#8ea2ff', intensite: 0.3 },
      ambiance: { couleurCiel: '#8c86c8', couleurSol: '#3a2a30', intensite: 0.45, reflets: 1.15 },
      lampes: 0.75, tele: 3.8, retroeclairage: 13,
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
  lampes: { lampadaire: 20, halo: 1.4, applique: 5 },   // puissance quand lampes = 1
  sansOmbres: 0.45,     // qualité basse (sans ombres) : le soleil traverse les murs, on l'atténue
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
//  Vue par la fenêtre : ville dessinée sur un canvas, couleurs selon l'heure
// =====================================================================
export function creerVue(anisotropie = 4) {
  const W = 512, H = 640;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = anisotropie;
  const material = new THREE.MeshBasicMaterial({ map: tex });

  // silhouette de la ville, tirée une fois
  const rnd = (a, b) => a + Math.random() * (b - a);
  const immeubles = [], fenetres = [], etoiles = [];
  for (let x = 0; x < W;) {
    const bw = rnd(30, 80), bh = rnd(120, 380);
    immeubles.push({ x, y: H - bh, w: bw, h: bh, teinte: rnd(0.73, 1.27) });
    for (let yy = H - bh + 8; yy < H - 6; yy += 12)
      for (let xx = x + 5; xx < x + bw - 6; xx += 10)
        fenetres.push({ x: xx, y: yy, rang: Math.random(), vert: rnd(190, 230) | 0, alpha: rnd(0.4, 0.95) });
    x += bw + rnd(2, 10);
  }
  for (let i = 0; i < 70; i++) etoiles.push({ x: Math.random() * W, y: Math.random() * H * 0.55, r: rnd(0.6, 1.5), a: rnd(0.3, 1) });

  const rgb = {};
  const css = (col, k = 1) => {
    col.getRGB(rgb, THREE.SRGBColorSpace);
    const f = v => Math.round(Math.min(1, Math.max(0, v * k)) * 255);
    return `rgb(${f(rgb.r)},${f(rgb.g)},${f(rgb.b)})`;
  };

  function dessiner(ciel) {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, css(ciel.haut)); sky.addColorStop(0.7, css(ciel.milieu)); sky.addColorStop(1, css(ciel.horizon));
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (ciel.etoiles > 0.01) {
      for (const e of etoiles) { g.fillStyle = `rgba(235,240,255,${(e.a * ciel.etoiles).toFixed(3)})`; g.beginPath(); g.arc(e.x, e.y, e.r, 0, 7); g.fill(); }
    }
    for (const b of immeubles) { g.fillStyle = css(ciel.immeubles, b.teinte); g.fillRect(b.x, b.y, b.w, b.h); }
    if (ciel.vitres > 0.01) {           // vitres éteintes : elles reflètent le ciel
      g.globalAlpha = ciel.vitres; g.fillStyle = css(ciel.milieu);
      for (const f of fenetres) g.fillRect(f.x, f.y, 4, 5);
      g.globalAlpha = 1;
    }
    for (const f of fenetres) {
      if (f.rang >= ciel.fenetresAllumees) continue;
      g.fillStyle = `rgba(255,${f.vert},140,${f.alpha.toFixed(2)})`; g.fillRect(f.x, f.y, 4, 5);
    }
    tex.needsUpdate = true;
  }

  let signature = '', dernier = -1e9;
  return {
    material,
    /** Met la vue à jour (redessine seulement si quelque chose a vraiment changé). */
    mettreAJour(ciel, forcer = false) {
      material.color.setScalar(ciel.luminosite);
      const s = [ciel.haut, ciel.milieu, ciel.horizon, ciel.immeubles].map(c => `${Math.round(c.r * 2000)},${Math.round(c.g * 2000)},${Math.round(c.b * 2000)}`).join('|')
        + `|${Math.round(ciel.fenetresAllumees * 500)}|${Math.round(ciel.vitres * 200)}|${Math.round(ciel.etoiles * 200)}`;
      const t = performance.now();
      if (s === signature || (!forcer && t - dernier < 150)) return;
      signature = s; dernier = t;
      dessiner(ciel);
    },
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
  function appliquer(h) {
    etatA(h);
    const e = hauteurSoleil(h), leve = e > 0;
    let intensite;
    if (leve) {      // le soleil entre par la fenêtre (et seulement par elle)
      directionDepuis(e, orientationSoleil(h), dir);
      L.ciel.color.copy(etat.soleil.couleur);
      intensite = etat.soleil.intensite * smooth(0, 4, e) * (renderer.shadowMap.enabled ? 1 : C.sansOmbres);
    } else {         // la lune (comme la version d'origine)
      directionDepuis(C.lune.hauteur, C.lune.direction, dir);
      L.ciel.color.copy(etat.lune.couleur);
      intensite = etat.lune.intensite * (1 - smooth(-8, 0, e));
    }
    L.ciel.intensity = intensite;
    L.ciel.position.copy(L.ciel.target.position).addScaledVector(dir, -15);
    room.enveloppeSoleil.visible = leve;

    L.hemi.color.copy(etat.ambiance.couleurCiel);
    L.hemi.groundColor.copy(etat.ambiance.couleurSol);
    L.hemi.intensity = etat.ambiance.intensite;
    room.scene.environmentIntensity = envBase * etat.ambiance.reflets;

    const k = clamp01(etat.lampes), P = C.lampes;
    L.lampadaire.intensity = P.lampadaire * k;
    L.halo.intensity = P.halo * k;
    L.applique.intensity = P.applique * k;
    room.ampoule.color.lerpColors(ampouleEteinte, ampouleAllumee, k);
    room.atmosphere.setLevel(k);

    L.tele.intensity = etat.tele;
    L.led.intensity = etat.retroeclairage;
    room.vue.mettreAJour(etat.ciel);
    info.heure = h; info.hauteurSoleil = e; info.soleilLeve = leve;
  }

  let cible = heureVoulue(), affichee = cible, ombres = renderer.shadowMap.enabled;
  appliquer(affichee);
  room.vue.mettreAJour(etat.ciel, true);

  // l'heure est relue au début de chaque minute (et au retour sur l'onglet)
  (function planifier() {
    setTimeout(() => { cible = heureVoulue(); planifier(); }, 60000 - (Date.now() % 60000) + 30);
  })();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cible = heureVoulue(); });

  return {
    etat, info, config: C,
    update(dt) {
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
