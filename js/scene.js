// =====================================================================
//  scene.js — Le salon : baie vitrée sur une forêt dans la brume, mur en
//  enduit, panneau à tasseaux et étagères, meuble TV suspendu, console,
//  télé, lampe arc, bandeau LED, rétroéclairage et ambiance.
//
//  Tout est dessiné en code ; les fichiers présents dans /assets (HDRI,
//  textures PBR, modèles GLB) l'enrichissent automatiquement.
//  La lumière selon l'heure est pilotée par eclairage.js.
// =====================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { creerVue } from './eclairage.js';

// ---------------------------------------------------------------------
//  RESSOURCES OPTIONNELLES — chargées si le fichier existe.
// ---------------------------------------------------------------------
export const OPTIONAL_ASSETS = {
  // Image HDR d'ambiance (.hdr ou .exr) : reflets et lumière d'ambiance réalistes
  hdri: ['assets/hdri/salon.hdr', 'assets/hdri/salon.exr'],
  hdriIntensite: 0.32,
  hdriRotation: 140,                 // degrés : oriente les reflets

  // Textures PBR : un dossier par matériau. Chaque fichier est facultatif :
  // couleur.jpg (couleur), rugosite.jpg (brillance), normale.jpg (relief).
  // "rotation" (degrés) tourne la texture (ex. veines du bois à la verticale).
  textures: {
    parquet: { dossier: 'assets/textures/parquet/', repetition: [3, 3], materiaux: ['floor'], relief: 0.9 },
    enduit:  { dossier: 'assets/textures/enduit/',  repetition: [3, 1.125], materiaux: ['plaster'], relief: 0.5 },
    mur:     { dossier: 'assets/textures/mur/',     repetition: [5, 2], materiaux: ['wall'], relief: 0.08 },
    chene:   { dossier: 'assets/textures/chene/',   repetition: [1, 1], materiaux: ['oak'], relief: 0.3 },
    bois:    { dossier: 'assets/textures/bois/',    repetition: [1, 2], materiaux: ['slat'], relief: 0.4, rotation: 90 },
    tissu:   { dossier: 'assets/textures/tissu/',   repetition: [4, 4], materiaux: ['sofa', 'ottoman'], relief: 0.45 },
    tapis:   { dossier: 'assets/textures/tapis/',   repetition: [3, 2], materiaux: ['rug'], relief: 0.9 },
  },

  // Modèles 3D (GLB). "remplace" = remplace l'objet dessiné en code au même endroit
  // ("canape", "plante" ou "lampe") ; sinon "position": [x, z] place un objet en plus.
  // "echelle" : 1 = taille réelle du fichier, "ajuster" = taille de l'objet remplacé.
  // "teintes" : recolore une matière du fichier (nom de la matière → couleur, reflet du tissu).
  modeles: {
    canape:   { fichier: 'assets/models/canape.glb',   remplace: 'canape', rotation: 180, echelle: 1.06,
                teintes: { GlamVelvetSofa_fabric_champagne: { couleur: '#3a3b3f', reflet: '#8c8e95' } } },
    lampe:    { fichier: 'assets/models/lampe.glb',    remplace: 'lampe', rotation: 0, echelle: 'ajuster' },
    plante:   { fichier: 'assets/models/plante.glb',   position: [-3.45, 0.6], rotation: 40, echelle: 1.15 },
    fauteuil: { fichier: 'assets/models/fauteuil.glb', position: [3.05, -1.35], rotation: -62, echelle: 1,
                teintes: { 'fabric Mystere Peacock Velvet': { couleur: '#e3d7c4', reflet: '#f6efe2' } } },
  },
};

// Positions clés réutilisées par main.js (caméra, zoom télé)
export const LAYOUT = {
  tvCenter: new THREE.Vector3(0, 1.42, -3.42),
  screenSize: { w: 1.43, h: 0.805 },
  screenZ: -3.405,
  sofa: new THREE.Vector3(0, 0, 1.25),
};

// La pièce (mètres) : x de -4 à 4, z de -3.5 (mur de la télé) à 4.5, hauteur 3
const BAIE = { z0: -3.25, z1: -0.25, y0: 0.03, y1: 2.78, profondeur: 0.25, xVitre: -4.2, meneau: -1.25 };
const PAYSAGE = { x: -8.5, z0: -16, z1: 4, y0: -4, y1: 7 };   // panneau de la forêt, dehors
const TASSEAUX = { x0: 1.0, x1: 2.7, nombre: 27 };
const MEUBLE = { x0: -1.7, x1: 2.7, bas: 0.22, haut: 0.62, profondeur: 0.42 };

const rnd = (a, b) => a + Math.random() * (b - a);
const DEG = Math.PI / 180;

/**
 * Construit tout le salon. Retourne la scène et des références utiles.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Material} screenMaterial  matériau de l'écran (menu animé, voir tvmenu.js)
 */
export function buildRoom(renderer, screenMaterial) {
  RectAreaLightUniformsLib.init();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0c10');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.28;

  // ---------- textures procédurales (canvas), remplacées par /assets si présents ----------
  function canvasTex(w, h, draw, rx = 1, ry = 1, srgb = true) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = maxAniso;
    return t;
  }
  function grain(g, x, y, w, h, base, lines, dir = 'h') {
    g.fillStyle = base; g.fillRect(x, y, w, h);
    for (let i = 0; i < lines; i++) {
      g.strokeStyle = `rgba(${Math.random() < .5 ? '40,22,10' : '255,230,200'},${rnd(.03, .12)})`;
      g.lineWidth = rnd(.5, 2.2); g.beginPath();
      if (dir === 'h') { const yy = y + Math.random() * h; g.moveTo(x, yy); for (let k = 0; k <= 8; k++) g.lineTo(x + w * k / 8, yy + Math.sin(k * rnd(.6, 1.4)) * rnd(.5, 3)); }
      else { const xx = x + Math.random() * w; g.moveTo(xx, y); for (let k = 0; k <= 8; k++) g.lineTo(xx + Math.sin(k * rnd(.6, 1.4)) * rnd(.5, 3), y + h * k / 8); }
      g.stroke();
    }
  }
  const floorTex = canvasTex(1024, 1024, (g, w, h) => {
    const rows = 6, ph = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd(0, 300);
      while (x < w) {
        const pw = rnd(380, 620);
        grain(g, x, r * ph, pw, ph, `hsl(${rnd(30, 36)},${rnd(30, 40)}%,${rnd(52, 62)}%)`, 40);
        g.fillStyle = 'rgba(20,10,4,.4)'; g.fillRect(x, r * ph, 2, ph);
        x += pw;
      }
      g.fillStyle = 'rgba(20,10,4,.45)'; g.fillRect(0, r * ph, w, 2);
    }
  }, 3, 3);
  const floorRough = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = rnd(100, 160) | 0; g.fillStyle = `rgba(${v},${v},${v},.25)`; g.fillRect(Math.random() * w, Math.random() * h, rnd(2, 30), 1); }
  }, 3, 3, false);
  const slatTex = canvasTex(256, 1024, (g, w, h) => grain(g, 0, 0, w, h, '#6b4529', 120, 'v'), 1, 1);
  const oakTex = canvasTex(1024, 256, (g, w, h) => grain(g, 0, 0, w, h, '#c9a57a', 160), 1, 1);
  const fabricTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const v = rnd(200, 255) | 0; g.fillStyle = `rgba(${v},${v},${v - 6},.5)`; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(1, 3)); }
  }, 3, 3);
  const plasterTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rnd(225, 255) | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(1, 6), 0, 7); g.fill(); }
  }, 3, 1.125);
  const rugTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#8b857c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40000; i++) { const v = rnd(110, 175) | 0; g.fillStyle = `rgba(${v},${v - 5},${v - 12},.4)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, 3, 2);
  const art2Tex = canvasTex(640, 448, (g, w, h) => {
    g.fillStyle = '#e9e2d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f4a5c'; g.beginPath(); g.arc(w * .3, h * .55, 120, 0, 7); g.fill();
    g.fillStyle = '#d9b26a'; g.fillRect(w * .48, h * .2, 190, 230);
    g.strokeStyle = '#1f1f1f'; g.lineWidth = 5; g.beginPath(); g.moveTo(40, h * .85); g.lineTo(w - 40, h * .85); g.stroke();
  }, 1, 1);

  // ---------- matériaux ----------
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughnessMap: floorRough, roughness: 1, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ color: '#e7e1d8', map: plasterTex, roughness: 0.95 }),          // murs clairs
    plaster: new THREE.MeshStandardMaterial({ color: '#aaa196', map: plasterTex, roughness: 0.9 }),        // enduit
    ceil: new THREE.MeshStandardMaterial({ color: '#e2ddd5', roughness: 1 }),
    oak: new THREE.MeshStandardMaterial({ map: oakTex, roughness: 0.5 }),
    slat: new THREE.MeshStandardMaterial({ map: slatTex, roughness: 0.62 }),
    slatBack: new THREE.MeshStandardMaterial({ color: '#0d0d0e', roughness: 0.85 }),
    anthracite: new THREE.MeshPhysicalMaterial({ color: '#46474a', roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.6 }),
    niche: new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.8 }),
    matteBlack: new THREE.MeshStandardMaterial({ color: '#161617', roughness: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.6 }),
    black: new THREE.MeshPhysicalMaterial({ color: '#0a0a0b', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }),
    white: new THREE.MeshPhysicalMaterial({ color: '#f3f3f5', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    ceramic: new THREE.MeshPhysicalMaterial({ color: '#efebe4', roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }),
    blackCeramic: new THREE.MeshPhysicalMaterial({ color: '#141415', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    sofa: new THREE.MeshPhysicalMaterial({ color: '#3a3b3f', map: fabricTex, roughness: 0.95, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color('#8c8e95') }),
    speakerBody: new THREE.MeshPhysicalMaterial({ color: '#46474a', roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.4 }),
    membrane: new THREE.MeshStandardMaterial({ color: '#232427', roughness: 0.55, side: THREE.DoubleSide }),
    ottoman: new THREE.MeshPhysicalMaterial({ color: '#b2a590', map: fabricTex, roughness: 0.95, sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color('#f3e9d9') }),
    rug: new THREE.MeshPhysicalMaterial({ map: rugTex, roughness: 1, sheen: 0.5, sheenRoughness: 0.9, sheenColor: new THREE.Color('#d6d0c6') }),
    tableTop: new THREE.MeshPhysicalMaterial({ color: '#252527', roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    acrylic: new THREE.MeshPhysicalMaterial({ color: '#dfe8f0', roughness: 0.04, transparent: true, opacity: 0.07, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.03, transparent: true, opacity: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.03, depthWrite: false }),
    amberGlass: new THREE.MeshPhysicalMaterial({ color: '#8a5a2b', roughness: 0.12, transparent: true, opacity: 0.78, clearcoat: 1, clearcoatRoughness: 0.05 }),
    frame: new THREE.MeshStandardMaterial({ color: '#1b1c1e', roughness: 0.45, metalness: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.35, metalness: 0.9 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b08d57', roughness: 0.3, metalness: 1 }),
    stem: new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.8 }),
    dried: new THREE.MeshStandardMaterial({ color: '#c8ab7e', roughness: 0.9, side: THREE.DoubleSide }),
    blueLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.55, 3.0) }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.1, 0.3) }),
    warm: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.1, 1.2) }),
    ledStrip: new THREE.MeshBasicMaterial({ color: new THREE.Color(4.2, 2.7, 1.4) }),
    // matériaux de l'avatar de secours (formes simples)
    skin: new THREE.MeshPhysicalMaterial({ color: '#d9a27c', roughness: 0.62, sheen: 0.3, sheenColor: new THREE.Color('#ffb8a0') }),
    hair: new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.75 }),
    jacket: new THREE.MeshPhysicalMaterial({ color: '#161618', roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color('#40424a') }),
    jeans: new THREE.MeshStandardMaterial({ color: '#2a3446', map: fabricTex, roughness: 0.9 }),
  };

  const add = (geo, mat, x, y, z, parent = scene, shadow = true) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  const rbox = (w, h, d, r = 0.02, s = 4) => new RoundedBoxGeometry(w, h, d, s, r);
  /** Planche dont le fil du bois suit la longueur (axe x avant rotation). */
  const planche = (long, epais, prof, mat, x, y, z, rotY = 0, parent = scene, shadow = true) => {
    const m = add(new THREE.BoxGeometry(long, epais, prof), mat, x, y, z, parent, shadow);
    m.rotation.y = rotY; return m;
  };

  // =================================================================
  //  PIÈCE
  // =================================================================
  const floor = add(new THREE.PlaneGeometry(8, 8), M.floor, 0, 0, 0.5, scene, false); floor.rotation.x = -Math.PI / 2;
  add(new THREE.PlaneGeometry(8, 3), M.plaster, 0, 1.5, -3.5, scene, false);                                // mur de la télé
  const rw = add(new THREE.PlaneGeometry(8, 3), M.plaster, 4, 1.5, 0.5, scene, false); rw.rotation.y = -Math.PI / 2;
  const ce = add(new THREE.PlaneGeometry(8, 8), M.ceil, 0, 3, 0.5, scene, false); ce.rotation.x = Math.PI / 2;
  // mur de la baie, percé : repère local x = 0.5 - z (mur tourné vers la pièce)
  const lw = new THREE.Mesh(wallWithHole(8, 3, { x0: 0.5 - BAIE.z1, x1: 0.5 - BAIE.z0, y0: BAIE.y0, y1: BAIE.y1 }), M.wall);
  lw.position.set(-4, 0, 0.5); lw.rotation.y = Math.PI / 2; lw.receiveShadow = true; scene.add(lw);
  // plinthes discrètes (creux d'ombre)
  add(new THREE.BoxGeometry(8, 0.05, 0.012), M.dark, 0, 0.025, -3.494, scene, false);
  { const b = add(new THREE.BoxGeometry(8, 0.05, 0.012), M.dark, 3.994, 0.025, 0.5, scene, false); b.rotation.y = Math.PI / 2; }
  { const b = add(new THREE.BoxGeometry(4.75, 0.05, 0.012), M.dark, -3.994, 0.025, 2.125, scene, false); b.rotation.y = Math.PI / 2; }

  // mur du fond (derrière le canapé) : visible pendant l'intro, masqué ensuite
  // car la caméra du salon se trouve derrière lui.
  const backWall = new THREE.Group(); backWall.name = 'murDuFond'; scene.add(backWall);
  const bw = add(new THREE.PlaneGeometry(8, 3), M.plaster, 0, 1.5, 4.5, backWall, false); bw.rotation.y = Math.PI;
  add(new THREE.BoxGeometry(8, 0.05, 0.012), M.dark, 0, 0.025, 4.494, backWall, false);
  const backDeco = new THREE.Group(); backDeco.position.set(0.2, 0, 4.5); backDeco.rotation.y = Math.PI; backWall.add(backDeco);
  add(rbox(1.3, 0.92, 0.04, 0.005, 2), M.dark, 0, 1.65, 0.03, backDeco);
  add(new THREE.PlaneGeometry(1.18, 0.8), new THREE.MeshStandardMaterial({ map: art2Tex, roughness: 0.9 }), 0, 1.65, 0.051, backDeco, false);
  add(rbox(1.6, 0.04, 0.24, 0.006), M.matteBlack, -1.9, 1.05, 0.12, backDeco);
  rangeeLivres(backDeco, -2.55, 1.07, 0.12, 6);
  add(new THREE.CylinderGeometry(0.06, 0.05, 0.18, 24), M.ceramic, -1.4, 1.16, 0.12, backDeco);

  // =================================================================
  //  BAIE VITRÉE + PAYSAGE
  // =================================================================
  const bzc = (BAIE.z0 + BAIE.z1) / 2, bl = BAIE.z1 - BAIE.z0, bh = BAIE.y1 - BAIE.y0, byc = (BAIE.y0 + BAIE.y1) / 2;
  const xr = -4 - 0.003 - BAIE.profondeur / 2;   // 3 mm en retrait du mur : aucune face confondue avec lui (sinon ça scintille)
  // embrasure en chêne clair (le fil suit la longueur des planches)
  planche(bl + 0.06, 0.03, BAIE.profondeur, M.oak, xr, BAIE.y1 + 0.015, bzc, Math.PI / 2, scene, true);
  planche(bl + 0.06, 0.03, BAIE.profondeur, M.oak, xr, BAIE.y0 - 0.012, bzc, Math.PI / 2, scene, true);
  for (const z of [BAIE.z0 - 0.015, BAIE.z1 + 0.015]) {
    const m = add(new THREE.BoxGeometry(bh, BAIE.profondeur, 0.03), M.oak, xr, byc, z, scene, true);
    m.rotation.z = Math.PI / 2;
  }
  // menuiserie noire, vitre
  const xv = BAIE.xVitre;
  add(new THREE.BoxGeometry(0.06, 0.05, bl), M.frame, xv, BAIE.y1 - 0.025, bzc, scene, false);
  add(new THREE.BoxGeometry(0.06, 0.05, bl), M.frame, xv, BAIE.y0 + 0.025, bzc, scene, false);
  for (const z of [BAIE.z0 + 0.025, BAIE.z1 - 0.025]) add(new THREE.BoxGeometry(0.06, bh, 0.05), M.frame, xv, byc, z, scene, false);
  add(new THREE.BoxGeometry(0.07, bh, 0.055), M.frame, xv, byc, BAIE.meneau, scene, false);
  const vitre = add(new THREE.PlaneGeometry(bl, bh), M.glass, xv + 0.005, byc, bzc, scene, false);
  vitre.rotation.y = Math.PI / 2; vitre.renderOrder = 3;
  // le paysage (forêt dans la brume, voir eclairage.js)
  const vue = creerVue({ plan: PAYSAGE, fenetre: { x: -4.1, y: 1.4, z: bzc }, anisotropie: maxAniso });
  const paysage = new THREE.Mesh(new THREE.PlaneGeometry(PAYSAGE.z1 - PAYSAGE.z0, PAYSAGE.y1 - PAYSAGE.y0), vue.material);
  paysage.position.set(PAYSAGE.x, (PAYSAGE.y0 + PAYSAGE.y1) / 2, (PAYSAGE.z0 + PAYSAGE.z1) / 2);
  paysage.rotation.y = Math.PI / 2; paysage.name = 'paysage';
  scene.add(paysage);

  // =================================================================
  //  MUR DE LA TÉLÉ : panneau à tasseaux + étagères
  // =================================================================
  const T = TASSEAUX, tw = T.x1 - T.x0, pas = tw / T.nombre;
  add(new THREE.BoxGeometry(tw, 3, 0.012), M.slatBack, (T.x0 + T.x1) / 2, 1.5, -3.493, scene, false);
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(pas * 0.66, 3, 0.03), M.slat, T.nombre);
  const mtx = new THREE.Matrix4(), teinte = new THREE.Color();
  for (let i = 0; i < T.nombre; i++) {
    mtx.makeTranslation(T.x0 + pas * (i + 0.5), 1.5, -3.472);
    slats.setMatrixAt(i, mtx);
    const k = rnd(0.78, 1.08); slats.setColorAt(i, teinte.setRGB(k, k * rnd(0.96, 1.0), k * rnd(0.9, 1.0)));
  }
  slats.castShadow = true; slats.receiveShadow = true; scene.add(slats);

  const zEtagere = -3.457 + 0.13;
  const etagere = (x0, x1, y) => add(rbox(x1 - x0, 0.04, 0.26, 0.004), M.matteBlack, (x0 + x1) / 2, y, zEtagere);
  etagere(0.82, 2.72, 2.12); etagere(1.5, 2.72, 1.62); etagere(1.55, 2.72, 1.14);
  // étagère du haut : vase bouteille, livres posés, sphère en verre ambré
  add(new THREE.LatheGeometry(profil([[0, 0], [0.055, 0], [0.07, 0.06], [0.06, 0.13], [0.022, 0.18], [0.02, 0.24], [0.026, 0.245], [0, 0.245]]), 40), M.blackCeramic, 1.02, 2.14, zEtagere);
  pileLivres(scene, 1.55, 2.14, zEtagere, [[0.26, 0.035, '#efebe4'], [0.24, 0.03, '#2a2a2b'], [0.22, 0.028, '#cdbfae']]);
  add(new THREE.CylinderGeometry(0.035, 0.045, 0.02, 32), M.brass, 2.35, 2.15, zEtagere);
  add(new THREE.SphereGeometry(0.085, 48, 32), M.amberGlass, 2.35, 2.245, zEtagere);
  // étagère du milieu : rangée de livres, petit vase blanc
  rangeeLivres(scene, 1.88, 1.64, zEtagere, 12);
  add(new THREE.LatheGeometry(profil([[0, 0], [0.04, 0], [0.05, 0.05], [0.03, 0.12], [0.034, 0.15], [0, 0.15]]), 32), M.ceramic, 1.66, 1.64, zEtagere);
  // étagère du bas : vase en U et deux soliflores noirs
  const u = new THREE.CatmullRomCurve3([[-0.08, 0.2], [-0.08, 0.06], [-0.04, 0.0], [0.04, 0.0], [0.08, 0.06], [0.08, 0.2]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
  add(new THREE.TubeGeometry(u, 64, 0.032, 24), M.blackCeramic, 2.25, 1.16 + 0.032, zEtagere);
  for (const [x, hh] of [[1.82, 0.16], [1.93, 0.11]]) add(new THREE.LatheGeometry(profil([[0, 0], [0.03, 0], [0.034, hh * 0.4], [0.012, hh * 0.85], [0.014, hh], [0, hh]]), 28), M.blackCeramic, x, 1.16, zEtagere);

  // =================================================================
  //  MEUBLE TV SUSPENDU (façades anthracite, plateau en chêne)
  // =================================================================
  const B = MEUBLE, zf = -3.5 + B.profondeur, ymid = (B.bas + B.haut) / 2;
  const cab = new THREE.Group(); scene.add(cab);
  const xs = [B.x0, -0.35, 1.0, B.x1];                      // gauche | niche | droite
  add(new THREE.BoxGeometry(B.x1 - B.x0, B.haut - B.bas, 0.02), M.niche, (B.x0 + B.x1) / 2, ymid, -3.49, cab);
  add(rbox(xs[1] - xs[0] - 0.004, B.haut - B.bas, B.profondeur - 0.02, 0.004, 2), M.anthracite, (xs[0] + xs[1]) / 2, ymid, -3.48 + (B.profondeur - 0.02) / 2, cab);
  add(rbox(xs[3] - xs[2] - 0.004, B.haut - B.bas, B.profondeur - 0.02, 0.004, 2), M.anthracite, (xs[2] + xs[3]) / 2, ymid, -3.48 + (B.profondeur - 0.02) / 2, cab);
  add(rbox(xs[2] - xs[1] - 0.004, 0.2, B.profondeur - 0.02, 0.004, 2), M.anthracite, (xs[1] + xs[2]) / 2, B.bas + 0.1, -3.48 + (B.profondeur - 0.02) / 2, cab);
  add(new THREE.BoxGeometry(xs[2] - xs[1], 0.012, B.profondeur - 0.03), M.niche, (xs[1] + xs[2]) / 2, B.bas + 0.206, -3.48 + (B.profondeur - 0.03) / 2, cab, false);
  // rainures entre les façades (portes et tiroirs sans poignée)
  for (const x of [-1.025, 1.85]) add(new THREE.BoxGeometry(0.004, B.haut - B.bas - 0.01, 0.004), M.niche, x, ymid, zf + 0.0005, cab, false);
  const plateau = add(rbox(B.x1 - B.x0 + 0.02, 0.055, B.profondeur + 0.035, 0.005, 2), M.oak, (B.x0 + B.x1) / 2, B.haut + 0.0275, -3.5 + (B.profondeur + 0.035) / 2, cab);
  const yTop = B.haut + 0.055;
  // ampli et lecteur dans la niche
  const amp = new THREE.Group(); amp.position.set(0.02, B.bas + 0.212, -3.25); cab.add(amp);
  add(rbox(0.44, 0.13, 0.33, 0.006, 2), M.metal, 0, 0.065, 0, amp);
  add(new THREE.PlaneGeometry(0.12, 0.022), M.amber, 0, 0.08, 0.1655, amp, false);
  for (const x of [-0.16, 0.16]) { const k = add(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 32), M.brass, x, 0.07, 0.172, amp); k.rotation.x = Math.PI / 2; }
  add(rbox(0.36, 0.05, 0.25, 0.004, 2), M.matteBlack, 0.6, B.bas + 0.237, -3.3, cab);
  add(new THREE.CircleGeometry(0.004, 12), M.blueLight, 0.74, B.bas + 0.24, -3.174, cab, false);

  // console de salon (style PS5, sans logo ni marque), debout sur le plateau
  const ps = new THREE.Group(); ps.position.set(1.0, yTop, -3.27); ps.rotation.y = -0.55; cab.add(ps);   // à la jonction enduit / tasseaux
  add(rbox(0.07, 0.36, 0.23, 0.012), M.black, 0, 0.19, 0, ps);
  const wing = new THREE.Shape();
  wing.moveTo(-0.12, 0); wing.lineTo(0.11, 0); wing.quadraticCurveTo(0.15, 0.2, 0.135, 0.405); wing.quadraticCurveTo(0.0, 0.385, -0.15, 0.415); wing.quadraticCurveTo(-0.125, 0.2, -0.12, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 24 });
  for (const s of [-1, 1]) { const w = add(wingGeo, M.white, 0, 0, 0, ps); w.rotation.y = Math.PI / 2; w.position.x = s > 0 ? 0.04 : -0.052; }
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.004, 0.33, 0.004), M.blueLight, s * 0.037, 0.2, 0.118, ps, false);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 24), M.black, 0, 0.006, 0, ps);

  // paire d'enceintes sur pied, de chaque côté du meuble (cliquables : musique, voir musique.js)
  // anthracite comme les façades, cercle en laiton comme la lampe, pieds noirs comme les étagères
  const ledEnceinte = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.25, 0.27) });
  const zonesEnceintes = [];
  for (const [x, rot] of [[-2.15, 0.35], [3.2, -0.45]]) {
    const g = new THREE.Group(); g.position.set(x, 0, -3.1); g.rotation.y = rot; scene.add(g);
    add(new THREE.CylinderGeometry(0.15, 0.16, 0.02, 48), M.matteBlack, 0, 0.01, 0, g);
    add(new THREE.CylinderGeometry(0.02, 0.026, 0.6, 24), M.matteBlack, 0, 0.32, 0, g);
    add(rbox(0.19, 0.014, 0.21, 0.004, 2), M.matteBlack, 0, 0.627, 0, g);
    const e = new THREE.Group(); e.position.y = 0.634; g.add(e);
    const l = 0.21, h = 0.34, p = 0.27;
    add(rbox(l, h, p, 0.042, 6), M.speakerBody, 0, h / 2, 0, e);
    hautParleur(e, 0, h * 0.56, p / 2 + 0.006, l * 0.34);
    add(new THREE.CircleGeometry(0.0045, 16), ledEnceinte, 0, h * 0.14, p / 2 + 0.006, e, false);
    const zone = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.05, 0.38), new THREE.MeshBasicMaterial());
    zone.position.y = 0.5; zone.visible = false; g.add(zone); zonesEnceintes.push(zone);   // zone de clic (pied compris)
  }

  // déco du plateau : vase blanc et branches séchées, coupelle, champignon noir, livres
  add(new THREE.LatheGeometry(profil([[0, 0], [0.07, 0], [0.105, 0.09], [0.1, 0.2], [0.06, 0.3], [0.052, 0.33], [0.058, 0.335], [0, 0.335]]), 48), M.ceramic, -1.32, yTop, -3.3);
  branchesSechees(scene, -1.32, yTop + 0.3, -3.3, M);
  add(new THREE.LatheGeometry(profil([[0, 0], [0.05, 0], [0.09, 0.035], [0.095, 0.05], [0.088, 0.05], [0.045, 0.012], [0, 0.012]]), 40), M.ceramic, -0.98, yTop, -3.22);
  add(new THREE.CylinderGeometry(0.012, 0.016, 0.1, 20), M.matteBlack, -0.8, yTop + 0.05, -3.3);
  add(new THREE.SphereGeometry(0.06, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.matteBlack, -0.8, yTop + 0.095, -3.3);
  pileLivres(scene, 2.3, yTop, -3.25, [[0.3, 0.04, '#1d1d1e'], [0.27, 0.032, '#efebe4'], [0.25, 0.028, '#bfb3a3']]);

  // =================================================================
  //  TÉLÉ, rétroéclairage, bandeau LED du plafond
  // =================================================================
  const tv = new THREE.Group(); tv.position.copy(LAYOUT.tvCenter); scene.add(tv);
  add(rbox(1.46, 0.84, 0.03, 0.006, 2), M.black, 0, 0, 0, tv);
  const screen = add(new THREE.PlaneGeometry(LAYOUT.screenSize.w, LAYOUT.screenSize.h), screenMaterial, 0, 0, 0.0165, tv, false);
  screen.name = 'ecran';
  const tvLight = new THREE.RectAreaLight('#7aa6ff', 3.2, 1.43, 0.8); tvLight.position.set(0, 0, 0.05); tvLight.lookAt(0, 0, 3); tv.add(tvLight);
  const led = new THREE.RectAreaLight('#ffb36e', 14, 1.3, 0.7); led.position.set(0, 1.42, -3.44); led.lookAt(0, 1.42, -6); scene.add(led);
  // bandeau LED dans une fente du plafond, le long du mur de la télé
  add(new THREE.BoxGeometry(8, 0.03, 0.07), M.niche, 0, 3.012, -3.462, scene, false);
  const ledStrip = add(new THREE.PlaneGeometry(8, 0.024), M.ledStrip, 0, 2.994, -3.465, scene, false);
  ledStrip.rotation.x = Math.PI / 2;
  const bandeau = new THREE.RectAreaLight('#ffb978', 25, 8, 0.05);
  bandeau.position.set(0, 2.985, -3.44); bandeau.rotation.x = -Math.PI / 2 + 0.38; scene.add(bandeau);

  // =================================================================
  //  TAPIS, TABLE BASSE, POUF
  // =================================================================
  add(rbox(3.8, 0.014, 2.7, 0.006, 2), M.rug, -0.1, 0.007, -0.3, scene, false);
  const ct = new THREE.Group(); ct.position.set(-0.15, 0, -0.55); scene.add(ct);
  add(rbox(1.3, 0.06, 0.66, 0.012, 3), M.tableTop, 0, 0.345, 0, ct);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.315, 0.58), M.acrylic, s * 0.56, 0.1715, 0, ct, false);
  pileLivres(ct, -0.32, 0.375, 0.06, [[0.3, 0.04, '#efebe4'], [0.27, 0.03, '#d2c6b5'], [0.25, 0.03, '#1d1d1e']], 0.25);
  pileLivres(ct, 0.28, 0.375, -0.12, [[0.26, 0.035, '#2b2b2c'], [0.24, 0.028, '#efebe4']], -0.15);
  add(new THREE.TorusKnotGeometry(0.055, 0.017, 160, 20, 2, 3), M.black, 0.02, 0.375 + 0.075, 0.13, ct);
  const pouf = add(rbox(0.95, 0.4, 0.62, 0.09, 5), M.ottoman, -2.85, 0.2, -1.15); pouf.rotation.y = 0.18;

  // =================================================================
  //  CANAPÉ (remplacé par le modèle GLB s'il existe)
  // =================================================================
  const sofa = new THREE.Group(); sofa.position.copy(LAYOUT.sofa); scene.add(sofa);
  add(rbox(2.5, 0.36, 0.95, 0.06), M.sofa, 0, 0.25, 0, sofa);
  for (const x of [-0.57, 0.57]) add(rbox(1.12, 0.17, 0.76, 0.07), M.sofa, x, 0.5, -0.07, sofa);
  add(rbox(2.5, 0.5, 0.22, 0.09), M.sofa, 0, 0.66, 0.37, sofa);
  for (const x of [-0.57, 0.57]) { const b = add(rbox(1.1, 0.42, 0.18, 0.08), M.sofa, x, 0.74, 0.22, sofa); b.rotation.x = 0.14; }
  for (const x of [-1.33, 1.33]) add(rbox(0.22, 0.6, 0.95, 0.08), M.sofa, x, 0.37, 0, sofa);
  for (const x of [-1.3, 1.3]) for (const z of [-0.4, 0.4]) add(new THREE.CylinderGeometry(0.02, 0.018, 0.08, 12), M.brass, x, 0.04, z, sofa);

  // plante (le modèle GLB est ajouté à côté de la baie s'il existe)
  const plant = new THREE.Group(); scene.add(plant);

  // =================================================================
  //  LAMPE ARC (conservée)
  // =================================================================
  const lamp = new THREE.Group(); lamp.position.set(2.75, 0, -0.35); scene.add(lamp);
  add(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 40), new THREE.MeshStandardMaterial({ color: '#efeae2', roughness: .3 }), 0, 0.025, 0, lamp);
  const arc = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0.0, 2.55, 0), new THREE.Vector3(-1.2, 2.05, -0.7));
  add(new THREE.TubeGeometry(arc, 48, 0.012, 8), M.brass, 0, 0, 0, lamp);
  add(new THREE.SphereGeometry(0.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b08d57', metalness: 1, roughness: .35, side: THREE.DoubleSide }), -1.2, 1.9, -0.7, lamp);
  add(new THREE.SphereGeometry(0.05, 16, 12), M.warm, -1.2, 1.92, -0.7, lamp, false);
  const spot = new THREE.SpotLight('#ffbf80', 20, 0, 0.95, 0.85, 2);
  spot.position.set(-1.2, 1.88, -0.7); lamp.add(spot);
  spot.target.position.set(-1.6, 0, -0.5); lamp.add(spot.target);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.02; spot.shadow.radius = 6;
  const glow = new THREE.PointLight('#ffb070', 1.4, 3, 2); glow.position.set(-1.2, 2.05, -0.7); lamp.add(glow);

  // =================================================================
  //  TABLEAU (mur de la télé, à gauche) et sa liseuse en laiton
  // =================================================================
  const TABLEAU = { x: -2.55, y: 1.72, largeur: 0.88, rapport: 0.826 };     // rapport largeur / hauteur de la toile
  const tH = TABLEAU.largeur / TABLEAU.rapport, tW = TABLEAU.largeur;
  const tableau = new THREE.Group(); tableau.position.set(TABLEAU.x, TABLEAU.y, -3.5); scene.add(tableau);
  const toileTex = new THREE.TextureLoader().load('assets/images/tableau.jpg');
  toileTex.colorSpace = THREE.SRGBColorSpace; toileTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const chant = new THREE.MeshStandardMaterial({ color: '#2a1810', roughness: 0.9 });
  const peinture = new THREE.MeshStandardMaterial({ map: toileTex, roughness: 0.62, bumpMap: toileTex, bumpScale: 0.25 });
  add(new THREE.BoxGeometry(tW, tH, 0.028), [chant, chant, chant, chant, peinture, chant], 0, 0, 0.014 + 0.012, tableau);
  // caisse américaine en noyer : 4 baguettes autour de la toile, avec un jour de 7 mm
  const noyer = new THREE.MeshStandardMaterial({ color: '#3a271b', roughness: 0.5 });
  const jour = 0.007, b = 0.018, prof = 0.046, W = tW + 2 * (jour + b), Hc = tH + 2 * (jour + b);
  add(new THREE.BoxGeometry(W, b, prof), noyer, 0, (Hc - b) / 2, prof / 2, tableau);
  add(new THREE.BoxGeometry(W, b, prof), noyer, 0, -(Hc - b) / 2, prof / 2, tableau);
  add(new THREE.BoxGeometry(b, Hc - 2 * b, prof), noyer, (W - b) / 2, 0, prof / 2, tableau);
  add(new THREE.BoxGeometry(b, Hc - 2 * b, prof), noyer, -(W - b) / 2, 0, prof / 2, tableau);
  add(new THREE.BoxGeometry(W - 2 * b, Hc - 2 * b, 0.004), M.dark, 0, 0, 0.004, tableau, false);   // fond du jour
  // liseuse : platine murale, bras, rampe en laiton avec sa bande lumineuse
  const yL = Hc / 2 + 0.11, zL = 0.22;
  add(rbox(0.07, 0.045, 0.02, 0.006, 2), M.brass, 0, yL + 0.02, 0.01, tableau);
  { const bras = add(new THREE.CylinderGeometry(0.006, 0.006, zL, 12), M.brass, 0, yL + 0.02, zL / 2, tableau); bras.rotation.x = Math.PI / 2; }
  { const rampe = add(new THREE.CylinderGeometry(0.018, 0.018, 0.46, 24), M.brass, 0, yL, zL, tableau); rampe.rotation.z = Math.PI / 2; }
  add(new THREE.BoxGeometry(0.42, 0.004, 0.012), M.warm, 0, yL - 0.017, zL, tableau, false);
  const lumiereTableau = new THREE.SpotLight('#ffcf9a', 4, 0, 1.05, 1, 2);
  lumiereTableau.position.set(0, yL - 0.02, zL); tableau.add(lumiereTableau);
  lumiereTableau.target.position.set(0, -0.35, 0); tableau.add(lumiereTableau.target);

  // =================================================================
  //  LUMIÈRES DU CIEL ET D'AMBIANCE (pilotées par eclairage.js)
  // =================================================================
  // soleil le jour, lune la nuit : un seul projecteur, qui n'entre que par la baie
  const sky = new THREE.DirectionalLight('#8ea2ff', 0.55); sky.position.set(-6, 3.2, -0.6); sky.target.position.set(0, 1.5, 0.5);
  sky.castShadow = true; sky.shadow.mapSize.set(2048, 2048);
  Object.assign(sky.shadow.camera, { left: -6.6, right: 6.6, top: 6.6, bottom: -6.6, near: 1, far: 32 });
  sky.shadow.bias = -0.0005; sky.shadow.normalBias = 0.03; sky.shadow.radius = 4;
  scene.add(sky, sky.target);
  const hemi = new THREE.HemisphereLight('#aab6ff', '#3a2a20', 0.22);
  scene.add(hemi);
  // applique murale hors champ (derrière la caméra) : éclaire doucement le dos du canapé et de l'avatar
  const fill = new THREE.PointLight('#ffcf9e', 5, 9, 2); fill.position.set(2.3, 2.3, 3.7); scene.add(fill);
  // enveloppe invisible : ombre portée par les murs et le plafond, sauf à travers la baie
  const enveloppeSoleil = buildSunShell({
    // ouverture 2,5 cm plus large que la baie : ce sont les planches de l'embrasure qui découpent la lumière
    x: -4, z0: BAIE.z0 - 0.025, z1: BAIE.z1 + 0.025, y0: BAIE.y0 - 0.025, y1: BAIE.y1 + 0.025, epaisseur: BAIE.profondeur + 0.01,
    mullions: [{ z: BAIE.meneau, largeur: 0.055 }],
  });
  scene.add(enveloppeSoleil);

  // ---------- ambiance : poussière dans la lumière de la lampe ----------
  scene.updateMatrixWorld(true);
  const apex = spot.getWorldPosition(new THREE.Vector3());
  const aim = spot.target.getWorldPosition(new THREE.Vector3());
  const atmosphere = buildAtmosphere(apex, aim, spot.angle);
  scene.add(atmosphere.group);

  // ---------- rétroéclairage qui suit le menu (teinte chaude + couleur de la section) ----------
  const ambience = {
    led: new THREE.Color('#ffb36e'), tv: new THREE.Color('#7aa6ff'),
    ledBase: new THREE.Color('#ffb36e'), tvBase: new THREE.Color('#7aa6ff'),
  };

  const room = {
    scene, M, pmrem, screen, tv, backWall, led, tvLight,
    groups: { canape: sofa, plante: plant, lampe: lamp },
    seatRoot: sofa,            // objet sur lequel l'avatar s'assoit (remplacé par le GLB s'il existe)
    shadowLights: [spot, sky],
    atmosphere,
    noAO: [...atmosphere.noAO, enveloppeSoleil, paysage, vitre],   // objets ignorés par l'occlusion ambiante
    // éléments pilotés par eclairage.js (lumière selon l'heure)
    lumieres: { ciel: sky, hemi, lampadaire: spot, halo: glow, applique: fill, tableau: lumiereTableau, tele: tvLight, led, bandeau },
    ampoule: M.warm,
    bandeau: { materiau: M.ledStrip },
    vue,
    enveloppeSoleil,
    // enceintes : zones de clic et LED (pilotées par main.js / musique.js)
    enceinte: {
      zones: zonesEnceintes, led: ledEnceinte,
      eteinte: new THREE.Color(0.25, 0.25, 0.27), allumee: new THREE.Color(2.4, 1.55, 0.75),
      /** Fait pulser la LED selon le niveau de la musique (0 à 1). */
      pulser(n, joue) { ledEnceinte.color.lerpColors(this.eteinte, this.allumee, joue ? 0.35 + 0.65 * Math.min(1, n * 1.6) : 0); },
    },
    envListeners: [],
    /** Rappel appelé quand l'environnement change (HDRI chargé). */
    onEnvironment(cb) { this.envListeners.push(cb); cb(scene.environment); },
    /** Couleur d'ambiance (section du menu) : rétroéclairage et lumière de la télé. */
    setAmbience(hex) {
      const c = new THREE.Color(hex);
      ambience.led.copy(ambience.ledBase).lerp(c, 0.3);
      ambience.tv.copy(ambience.tvBase).lerp(c, 0.35);
    },
    update(dt, t) {
      const k = 1 - Math.exp(-dt * 2.5);
      led.color.lerp(ambience.led, k);
      tvLight.color.lerp(ambience.tv, k);
      atmosphere.update(t);
    },
    /** Hauteur de l'assise et position du dossier sous le point (x, z). */
    seatAt(x, z) {
      const meshes = [];
      this.seatRoot.traverse(o => { if (o.isMesh && o.visible !== false) meshes.push(o); });
      this.seatRoot.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 2.5, z), new THREE.Vector3(0, -1, 0), 0, 3);
      const down = ray.intersectObjects(meshes, false)[0];
      if (!down) return null;
      const y = down.point.y;
      ray.set(new THREE.Vector3(x, y + 0.22, z - 1.5), new THREE.Vector3(0, 0, 1));
      ray.far = 3;
      const back = ray.intersectObjects(meshes, false).find(h => h.point.z > z - 0.6);
      return { y, backZ: back ? back.point.z : null };
    },
  };
  return room;

  // ---------- petits objets ----------
  function profil(points) { return points.map(([x, y]) => new THREE.Vector2(x, y)); }
  /** Haut-parleur coaxial face à +z : membrane, suspension, cercle et dôme en laiton. */
  function hautParleur(parent, x, y, z, r) {
    const cone = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.001, -0.016), new THREE.Vector2(r * 0.3, -0.013), new THREE.Vector2(r * 0.9, 0)], 48), M.membrane);
    cone.rotation.x = Math.PI / 2; cone.position.set(x, y, z); parent.add(cone);
    add(new THREE.TorusGeometry(r * 0.93, r * 0.07, 12, 64), M.matteBlack, x, y, z, parent, false);
    add(new THREE.TorusGeometry(r * 1.06, r * 0.035, 10, 64), M.brass, x, y, z + 0.002, parent, false);
    const dome = add(new THREE.SphereGeometry(r * 0.26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.brass, x, y, z - 0.004, parent, false);
    dome.rotation.x = Math.PI / 2;
  }
  function couleurLivre() { return ['#f1ede6', '#1c1c1d', '#d9cfc0', '#8d8378', '#e9e4da', '#2e2d2b', '#b9ae9e', '#5b5752'][Math.random() * 8 | 0]; }
  /** Livres debout côte à côte (x0 = bord gauche). */
  function rangeeLivres(parent, x0, y, z, n) {
    let x = x0;
    for (let i = 0; i < n; i++) {
      const e = rnd(0.022, 0.045), h = rnd(0.19, 0.27), d = rnd(0.15, 0.19);
      const b = add(new THREE.BoxGeometry(e, h, d), new THREE.MeshStandardMaterial({ color: couleurLivre(), roughness: 0.8 }), x + e / 2, y + h / 2, z, parent);
      if (i === n - 1) { b.rotation.z = -0.22; b.position.x += 0.03; b.position.y -= 0.01; }
      x += e + 0.002;
    }
  }
  /** Pile de livres couchés : [[largeur, épaisseur, couleur], …]. */
  function pileLivres(parent, x, y, z, livres, rot = 0) {
    let yy = y;
    for (const [l, e, c] of livres) {
      const b = add(rbox(l, e, l * 0.72, 0.003, 2), new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }), x + rnd(-0.01, 0.01), yy + e / 2, z, parent);
      b.rotation.y = rot + rnd(-0.08, 0.08); yy += e;
    }
  }
}

/** Bouquet de branches séchées (tiges + petites feuilles en instances). */
function branchesSechees(scene, x, y, z, M) {
  const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
  const leafGeo = new THREE.PlaneGeometry(0.018, 0.032); leafGeo.translate(0, 0.016, 0);
  const leaves = new THREE.InstancedMesh(leafGeo, M.dried, 420);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd(-0.3, 0.3), spread = rnd(0.06, 0.2), h = rnd(0.38, 0.62);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.25, 0),
      new THREE.Vector3(Math.cos(a) * spread * 0.4, h * 0.55, Math.sin(a) * spread * 0.3),
      new THREE.Vector3(Math.cos(a) * spread, h, Math.sin(a) * spread * 0.7));
    const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0025, 5), M.stem);
    stem.castShadow = true; g.add(stem);
    for (let k = 0; k < 46 && n < 420; k++) {
      const t = 0.35 + 0.65 * (k / 46);
      curve.getPoint(t, p);
      e.set(rnd(-1.2, 1.2), rnd(0, Math.PI * 2), rnd(-1.2, 1.2)); q.setFromEuler(e);
      s.setScalar(rnd(0.6, 1.1) * (1.15 - t * 0.5));
      m.compose(p, q, s); leaves.setMatrixAt(n++, m);
    }
  }
  leaves.count = n; leaves.castShadow = true; g.add(leaves);
  return g;
}

/** Mur rectangulaire (w × h, posé sur y = 0, centré en x) percé d'une ouverture, UV comme un plan 0..1. */
function wallWithHole(w, h, hole) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.closePath();
  const path = new THREE.Path();
  path.moveTo(hole.x0, hole.y0); path.lineTo(hole.x0, hole.y1); path.lineTo(hole.x1, hole.y1); path.lineTo(hole.x1, hole.y0); path.closePath();
  shape.holes.push(path);
  const geo = new THREE.ShapeGeometry(shape);
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, pos.getY(i) / h);
  return geo;
}

// ---------------------------------------------------------------------
//  Poussière en suspension et faisceau lumineux discret sous la lampe
// ---------------------------------------------------------------------
function buildAtmosphere(apex, aim, angle) {
  const group = new THREE.Group(); group.name = 'atmosphere';
  const axis = aim.clone().sub(apex).normalize();
  const len = apex.y / Math.max(0.2, -axis.y);           // jusqu'au sol
  const tanA = Math.tan(angle * 0.62);
  const u = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 0, 1)).normalize();
  const w = new THREE.Vector3().crossVectors(axis, u).normalize();

  // poussière
  const N = 420, pos = new Float32Array(N * 3), phase = new Float32Array(N), size = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const along = len * (0.12 + 0.86 * Math.cbrt(Math.random()));
    const r = along * tanA * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    const p = apex.clone().addScaledVector(axis, along).addScaledVector(u, Math.cos(a) * r).addScaledVector(w, Math.sin(a) * r);
    pos.set([p.x, p.y, p.z], i * 3); phase[i] = Math.random(); size[i] = 0.6 + Math.random() * 1.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uApex: { value: apex }, uAxis: { value: axis }, uLen: { value: len }, uTan: { value: tanA },
      uColor: { value: new THREE.Color('#ffd2a1') }, uIntensity: { value: 0.85 }, uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */`
      uniform float uTime, uLen, uTan, uPixelRatio; uniform vec3 uApex, uAxis;
      attribute float aPhase, aSize; varying float vAlpha;
      void main() {
        float ph = aPhase * 6.2831;
        vec3 p = position + vec3(sin(uTime * 0.13 + ph) * 0.06, sin(uTime * 0.09 + ph * 1.7) * 0.05 - mod(uTime * 0.004 + aPhase * 0.3, 0.3), cos(uTime * 0.11 + ph * 2.3) * 0.06);
        vec3 d = p - uApex; float along = dot(d, uAxis); float r = length(d - uAxis * along); float rmax = max(along * uTan, 0.001);
        vAlpha = smoothstep(rmax, rmax * 0.35, r) * smoothstep(0.1, 0.5, along) * smoothstep(uLen, uLen * 0.55, along);
        vAlpha *= 0.55 + 0.45 * sin(uTime * 0.7 + ph * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uPixelRatio * (9.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uIntensity; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(uColor * a * a * vAlpha * uIntensity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(geo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);

  // faisceau (cône ouvert, très léger, plus dense au centre)
  const radius = len * tanA * 1.05;
  const coneGeo = new THREE.ConeGeometry(radius, len, 64, 1, true);
  coneGeo.translate(0, -len / 2, 0);                         // sommet à l'origine, pointe vers -Y
  const coneMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffc58c') }, uIntensity: { value: 0.07 }, uLen: { value: len } },
    vertexShader: /* glsl */`
      uniform float uLen; varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        vH = -position.y / uLen;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uIntensity; varying float vH; varying vec3 vN; varying vec3 vV;
      void main() {
        float facing = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
        float h = clamp(vH, 0.0, 1.0);
        float a = facing * pow(1.0 - h, 1.4) * smoothstep(0.0, 0.12, h) * uIntensity;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.copy(apex);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis);
  cone.renderOrder = 2;
  group.add(cone);

  return {
    group, noAO: [cone],
    update(t) { dustMat.uniforms.uTime.value = t; },
    setPixelRatio(pr) { dustMat.uniforms.uPixelRatio.value = pr; },
    setEnabled(on) { group.visible = on; },
    /** Suit l'allumage de la lampe (0 = éteinte, 1 = allumée). */
    setLevel(k) {
      dustMat.uniforms.uIntensity.value = 0.85 * k;
      coneMat.uniforms.uIntensity.value = 0.07 * k;
      dust.visible = cone.visible = k > 0.002;
    },
  };
}

// ---------------------------------------------------------------------
//  Enveloppe invisible du salon : elle ne fait que porter ombre, pour que
//  le soleil et la lune n'entrent que par l'ouverture de la baie (mur gauche).
// ---------------------------------------------------------------------
function buildSunShell({ x, z0, z1, y0, y1, epaisseur = 0.12, mullions = [], transoms = [] }) {
  const group = new THREE.Group(); group.name = 'enveloppeSoleil';
  const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const R = { x0: -4, x1: 4, z0: -3.5, z1: 4.5, h: 3 }, m = 0.3, t = 0.12, te = epaisseur;
  const box = (sx, sy, sz, px, py, pz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    b.position.set(px, py, pz); b.castShadow = true; b.receiveShadow = false; group.add(b);
  };
  const zc = (R.z0 + R.z1) / 2, zl = R.z1 - R.z0 + 2 * m, xl = R.x1 - R.x0 + 2 * m, xw = x - te / 2 - 0.005;
  // mur de la baie, percé (son épaisseur fait l'embrasure)
  box(te, y0 + m, zl, xw, (y0 - m) / 2, zc);
  box(te, R.h + m - y1, zl, xw, (y1 + R.h + m) / 2, zc);
  box(te, y1 - y0, z0 - (R.z0 - m), xw, (y0 + y1) / 2, (z0 + R.z0 - m) / 2);
  box(te, y1 - y0, R.z1 + m - z1, xw, (y0 + y1) / 2, (z1 + R.z1 + m) / 2);
  // montants et traverses de la menuiserie (ombres fines)
  for (const mu of mullions) box(0.06, y1 - y0, mu.largeur || 0.035, x - te + 0.05, (y0 + y1) / 2, mu.z);
  for (const tr of transoms) box(0.06, tr.hauteur || 0.035, z1 - z0, x - te + 0.05, tr.y, (z0 + z1) / 2);
  // plafond, mur de la télé, mur du fond
  box(xl, t, zl, 0, R.h + t / 2 + 0.01, zc);
  box(xl, R.h + 2 * m, t, 0, R.h / 2, R.z0 - t / 2 - 0.01);
  box(xl, R.h + 2 * m, t, 0, R.h / 2, R.z1 + t / 2 + 0.01);
  return group;
}

// ---------------------------------------------------------------------
//  Chargement des ressources optionnelles
// ---------------------------------------------------------------------

/** Vérifie qu'un fichier existe (sans le télécharger). */
export async function fileExists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    const type = r.headers.get('content-type') || '';
    return r.ok && !type.includes('text/html');
  } catch { return false; }
}

/**
 * Charge HDRI, textures et modèles s'ils existent. Ne bloque jamais :
 * en cas d'absence ou d'erreur, la version procédurale reste en place.
 */
export async function loadOptionalAssets(room, renderer, manager, gltfLoader) {
  const { scene, M } = room;
  const A = OPTIONAL_ASSETS;
  const tasks = [];
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // HDRI (.hdr ou .exr)
  tasks.push((async () => {
    for (const url of [].concat(A.hdri)) {
      if (!(await fileExists(url))) continue;
      const loader = url.endsWith('.exr') ? new EXRLoader(manager) : new RGBELoader(manager);
      const tex = await loader.loadAsync(url);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const env = room.pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      scene.environment = env;
      scene.environmentIntensity = A.hdriIntensite;
      scene.environmentRotation.y = (A.hdriRotation || 0) * DEG;
      room.envListeners.forEach(cb => cb(env));
      return;
    }
  })().catch(e => console.warn('[HDRI] ignoré :', e)));

  // Textures PBR (chaque fichier est facultatif)
  const texLoader = new THREE.TextureLoader(manager);
  const FILES = { map: 'couleur.jpg', roughnessMap: 'rugosite.jpg', normalMap: 'normale.jpg' };
  for (const def of Object.values(A.textures)) {
    tasks.push((async () => {
      const maps = {};
      await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
        const url = def.dossier + file;
        if (!(await fileExists(url))) return;
        const t = await texLoader.loadAsync(url);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...def.repetition); t.anisotropy = maxAniso;
        if (def.rotation) { t.rotation = def.rotation * DEG; t.center.set(0.5, 0.5); }
        if (key === 'map') t.colorSpace = THREE.SRGBColorSpace;
        maps[key] = t;
      }));
      if (!Object.keys(maps).length) return;
      for (const name of def.materiaux) {
        const mat = M[name];
        if (!mat) continue;
        if (maps.map) { mat.map = maps.map; mat.color.set('#ffffff'); }
        if (maps.roughnessMap) { mat.roughnessMap = maps.roughnessMap; mat.roughness = 1; }
        if (maps.normalMap) { mat.normalMap = maps.normalMap; mat.normalScale.set(def.relief ?? 1, def.relief ?? 1); }
        mat.needsUpdate = true;
      }
    })().catch(e => console.warn(`[textures ${def.dossier}] ignoré :`, e)));
  }

  // Modèles GLB
  for (const [key, def] of Object.entries(A.modeles)) {
    tasks.push((async () => {
      if (!(await fileExists(def.fichier))) return;
      const gltf = await gltfLoader.loadAsync(def.fichier);
      const ref = def.remplace ? room.groups[def.remplace] : null;
      const obj = placeModel(scene, gltf.scene, def, ref);
      if (def.remplace === 'canape') room.seatRoot = obj;
    })().catch(e => console.warn(`[modèle ${key}] ignoré :`, e)));
  }
  await Promise.all(tasks);
}

/** Pose un modèle : orientation, échelle, position (au sol), ombres, teintes ; masque l'objet remplacé. */
function placeModel(scene, model, def, ref) {
  const lights = [];
  model.traverse(o => { if (o.isLight) lights.push(o); });
  lights.forEach(l => l.removeFromParent());   // un fichier ne doit pas ajouter ses propres lumières

  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.y = (def.rotation || 0) * DEG;
  holder.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(holder);
  let target = new THREE.Vector3(), floorY = 0;
  if (ref) {
    ref.updateWorldMatrix(true, true);
    const refBox = new THREE.Box3();
    ref.traverse(o => { if (o.isMesh) refBox.expandByObject(o); });
    refBox.getCenter(target); floorY = refBox.min.y;
    if (def.echelle === 'ajuster') {
      const rs = refBox.getSize(new THREE.Vector3()), ms = box.getSize(new THREE.Vector3());
      holder.scale.setScalar(Math.max(rs.x, rs.z) / Math.max(ms.x, ms.z, 1e-6));
    }
    ref.traverse(o => { if (o.isMesh) o.visible = false; });   // on garde ses lumières (lampe)
  } else if (def.position) {
    target.set(def.position[0], 0, def.position[1]);
  }
  if (typeof def.echelle === 'number') holder.scale.setScalar(def.echelle);
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  holder.position.set(target.x - c.x, floorY - box.min.y, target.z - c.z);
  const teintes = def.teintes || {};
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    for (const m of [].concat(o.material)) {
      if (m.map) m.map.anisotropy = 8;
      const t = teintes[m.name];
      if (!t) continue;
      if (t.couleur) m.color.set(t.couleur);
      if (t.reflet && m.sheenColor) m.sheenColor.set(t.reflet);
    }
  });
  scene.add(holder);
  return holder;
}
