// =====================================================================
//  scene.js — Le salon : pièce, meubles, éclairage, console, télé,
//  ambiance (rétroéclairage qui suit le menu, poussière dans la lumière).
//
//  Base = la scène procédurale du prototype (tout est dessiné en code),
//  enrichie automatiquement par les fichiers présents dans /assets
//  (HDRI, textures PBR, modèles GLB). Sans eux, tout fonctionne.
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
  textures: {
    parquet: { dossier: 'assets/textures/parquet/', repetition: [3, 3], materiaux: ['floor'], relief: 0.9 },
    mur:     { dossier: 'assets/textures/mur/',     repetition: [5, 2], materiaux: ['wall'], relief: 0.08 },
    bois:    { dossier: 'assets/textures/bois/',    repetition: [2, 1], materiaux: ['walnut', 'slat'], relief: 0.35 },
    tissu:   { dossier: 'assets/textures/tissu/',   repetition: [5, 5], materiaux: ['sofa', 'rug'], relief: 0.45 },
  },

  // Modèles 3D (GLB). "remplace" = remplace l'objet dessiné en code au même endroit
  // ("canape", "plante" ou "lampe") ; sinon "position": [x, z] place un objet en plus.
  // "echelle" : 1 = taille réelle du fichier, "ajuster" = taille de l'objet remplacé.
  modeles: {
    canape:   { fichier: 'assets/models/canape.glb',   remplace: 'canape', rotation: 180, echelle: 1.06 },
    lampe:    { fichier: 'assets/models/lampe.glb',    remplace: 'lampe', rotation: 0, echelle: 'ajuster' },
    plante:   { fichier: 'assets/models/plante.glb',   position: [-1.72, 0.45], rotation: 40, echelle: 1.15 },
    fauteuil: { fichier: 'assets/models/fauteuil.glb', position: [2.25, -1.95], rotation: -45, echelle: 1 },
  },
};

// Positions clés réutilisées par main.js (caméra, zoom télé)
export const LAYOUT = {
  tvCenter: new THREE.Vector3(0, 1.42, -3.42),
  screenSize: { w: 1.43, h: 0.805 },
  screenZ: -3.405,
  sofa: new THREE.Vector3(0, 0, 1.25),
};

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

  // ---------- textures procédurales (canvas) ----------
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
        const pw = rnd(380, 620), l = rnd(36, 48), hue = rnd(26, 32);
        grain(g, x, r * ph, pw, ph, `hsl(${hue},${rnd(38, 48)}%,${l}%)`, 40);
        g.fillStyle = 'rgba(20,10,4,.55)'; g.fillRect(x, r * ph, 2, ph);
        x += pw;
      }
      g.fillStyle = 'rgba(20,10,4,.6)'; g.fillRect(0, r * ph, w, 2);
    }
  }, 3, 3);
  const floorRough = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = rnd(100, 160) | 0; g.fillStyle = `rgba(${v},${v},${v},.25)`; g.fillRect(Math.random() * w, Math.random() * h, rnd(2, 30), 1); }
    for (let r = 0; r < 6; r++) { g.fillStyle = '#d8d8d8'; g.fillRect(0, r * h / 6, w, 2); }
  }, 3, 3, false);
  const walnutTex = canvasTex(1024, 512, (g, w, h) => grain(g, 0, 0, w, h, '#5a3a24', 220), 1, 1);
  const slatTex = canvasTex(256, 1024, (g, w, h) => grain(g, 0, 0, w, h, '#6b4529', 120, 'v'), 1, 1);
  const fabricTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const v = rnd(200, 255) | 0; g.fillStyle = `rgba(${v},${v},${v - 6},.5)`; g.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(1, 3)); }
  }, 3, 3);
  const plasterTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rnd(232, 255) | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rnd(1, 4), 0, 7); g.fill(); }
  }, 4, 2);
  const rugTex = canvasTex(1024, 768, (g, w, h) => {
    g.fillStyle = '#e9e1d3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40000; i++) { const v = rnd(205, 240) | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 16},.45)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(120,96,70,.45)'; g.lineWidth = 10; g.strokeRect(46, 46, w - 92, h - 92);
    g.lineWidth = 3; g.strokeRect(70, 70, w - 140, h - 140);
  });
  const artTex = canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#efe7da'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c96f4a'; g.beginPath(); g.arc(w * .42, h * .38, 120, 0, 7); g.fill();
    g.fillStyle = '#2f4a5c'; g.fillRect(w * .3, h * .52, 230, 200);
    g.fillStyle = '#d9b26a'; g.beginPath(); g.arc(w * .7, h * .7, 60, 0, 7); g.fill();
    g.strokeStyle = '#1f1f1f'; g.lineWidth = 4; g.beginPath(); g.moveTo(60, h * .82); g.bezierCurveTo(200, h * .6, 300, h * .95, 460, h * .74); g.stroke();
  }, 1, 1);

  // ---------- matériaux ----------
  const M = {
    floor: new THREE.MeshStandardMaterial({ map: floorTex, roughnessMap: floorRough, roughness: 1, metalness: 0 }),
    wall: new THREE.MeshStandardMaterial({ color: '#d6cfc4', map: plasterTex, roughness: 0.95 }),
    ceil: new THREE.MeshStandardMaterial({ color: '#8f8a84', roughness: 1 }),
    walnut: new THREE.MeshStandardMaterial({ map: walnutTex, roughness: 0.55 }),
    slat: new THREE.MeshStandardMaterial({ map: slatTex, roughness: 0.6 }),
    dark: new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.6 }),
    black: new THREE.MeshPhysicalMaterial({ color: '#0a0a0b', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 }),
    white: new THREE.MeshPhysicalMaterial({ color: '#f3f3f5', roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    sofa: new THREE.MeshPhysicalMaterial({ color: '#cfc4b3', map: fabricTex, roughness: 0.95, sheen: 1, sheenRoughness: 0.8, sheenColor: new THREE.Color('#fff4e6') }),
    rug: new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }),
    travertine: new THREE.MeshStandardMaterial({ color: '#d8ccb6', map: plasterTex, roughness: 0.7 }),
    metal: new THREE.MeshStandardMaterial({ color: '#2a2a2c', roughness: 0.35, metalness: 0.9 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b08d57', roughness: 0.3, metalness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#2f5e3a', roughness: 0.55, side: THREE.DoubleSide }),
    stem: new THREE.MeshStandardMaterial({ color: '#4d6b3a', roughness: 0.7 }),
    pot: new THREE.MeshStandardMaterial({ color: '#b9ab98', map: plasterTex, roughness: 0.9 }),
    blueLight: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.55, 3.0) }),
    warm: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.1, 1.2) }),
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

  // ---------- pièce ----------
  const floor = add(new THREE.PlaneGeometry(8, 8), M.floor, 0, 0, 0.5, scene, false); floor.rotation.x = -Math.PI / 2;
  add(new THREE.PlaneGeometry(8, 3), M.wall, 0, 1.5, -3.5, scene, false);
  const lw = add(new THREE.PlaneGeometry(8, 3), M.wall, -4, 1.5, 0.5, scene, false); lw.rotation.y = Math.PI / 2;
  const rw = add(new THREE.PlaneGeometry(8, 3), M.wall, 4, 1.5, 0.5, scene, false); rw.rotation.y = -Math.PI / 2;
  const ce = add(new THREE.PlaneGeometry(8, 8), M.ceil, 0, 3, 0.5, scene, false); ce.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(8, 0.08, 0.015), M.dark, 0, 0.04, -3.49, scene, false);
  for (const s of [-1, 1]) { const b = add(new THREE.BoxGeometry(8, 0.08, 0.015), M.dark, s * 3.99, 0.04, 0.5, scene, false); b.rotation.y = Math.PI / 2; }

  // mur du fond (derrière le canapé) : visible pendant l'intro, masqué ensuite
  // car la caméra du salon se trouve derrière lui.
  const backWall = new THREE.Group(); backWall.name = 'murDuFond'; scene.add(backWall);
  const bw = add(new THREE.PlaneGeometry(8, 3), M.wall, 0, 1.5, 4.5, backWall, false); bw.rotation.y = Math.PI;
  add(new THREE.BoxGeometry(8, 0.08, 0.015), M.dark, 0, 0.04, 4.49, backWall, false);
  const backDeco = new THREE.Group(); backDeco.position.set(0.2, 0, 4.5); backDeco.rotation.y = Math.PI; backWall.add(backDeco);
  const art2Tex = canvasTex(640, 448, (g, w, h) => {
    g.fillStyle = '#e9e2d6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f4a5c'; g.beginPath(); g.arc(w * .3, h * .55, 120, 0, 7); g.fill();
    g.fillStyle = '#d9b26a'; g.fillRect(w * .48, h * .2, 190, 230);
    g.strokeStyle = '#1f1f1f'; g.lineWidth = 5; g.beginPath(); g.moveTo(40, h * .85); g.lineTo(w - 40, h * .85); g.stroke();
  }, 1, 1);
  add(rbox(1.3, 0.92, 0.04, 0.005, 2), M.dark, 0, 1.65, 0.03, backDeco);
  add(new THREE.PlaneGeometry(1.18, 0.8), new THREE.MeshStandardMaterial({ map: art2Tex, roughness: 0.9 }), 0, 1.65, 0.051, backDeco, false);
  add(rbox(1.6, 0.04, 0.24, 0.006), M.walnut, -1.9, 1.05, 0.12, backDeco);
  [['#c96f4a', 0.22], ['#2f4a5c', 0.26], ['#d8ccb6', 0.2], ['#1d2a33', 0.24]].forEach(([c, hb], i) => {
    const bk = add(new THREE.BoxGeometry(0.035, hb, 0.17), new THREE.MeshStandardMaterial({ color: c, roughness: .8 }), -2.45 + i * 0.045, 1.07 + hb / 2, 0.12, backDeco);
    if (i === 3) bk.rotation.z = -0.25;
  });
  add(new THREE.CylinderGeometry(0.06, 0.05, 0.18, 24), M.pot, -1.5, 1.16, 0.12, backDeco);

  // mur à tasseaux derrière la télé
  const slats = new THREE.Group(); scene.add(slats);
  add(new THREE.BoxGeometry(2.9, 2.75, 0.02), M.dark, 0, 1.375, -3.485, slats, false);
  for (let i = 0; i < 29; i++) add(new THREE.BoxGeometry(0.06, 2.75, 0.035), M.slat, -1.4 + i * 0.1, 1.375, -3.46, slats, false);

  // fenêtre : la ville change selon l'heure (voir eclairage.js)
  const vue = creerVue(maxAniso);
  const win = new THREE.Group(); win.position.set(-3.99, 1.55, -0.6); win.rotation.y = Math.PI / 2; scene.add(win);
  add(new THREE.PlaneGeometry(1.5, 1.9), vue.material, 0, 0, 0.005, win, false);
  [[0, 0.97, 1.6, 0.06], [0, -0.97, 1.6, 0.06], [-0.77, 0, 0.06, 1.98], [0.77, 0, 0.06, 1.98], [0, 0, 0.035, 1.9], [0, 0.1, 1.5, 0.035]]
    .forEach(([x, y, w, h]) => add(new THREE.BoxGeometry(w, h, 0.06), M.metal, x, y, 0.03, win, false));
  add(new THREE.PlaneGeometry(0.7, 2.6), new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 1, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 1.05, -0.2, 0.12, win, false);

  // tableau
  const art = new THREE.Group(); art.position.set(2.55, 1.6, -3.47); scene.add(art);
  add(rbox(0.74, 0.94, 0.04, 0.005, 2), M.dark, 0, 0, 0, art);
  add(new THREE.PlaneGeometry(0.62, 0.82), new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.9 }), 0, 0, 0.021, art, false);

  // ---------- meuble TV ----------
  const cab = new THREE.Group(); cab.position.set(0, 0, -3.18); scene.add(cab);
  add(rbox(2.4, 0.42, 0.44, 0.015, 3), M.walnut, 0, 0.29, 0, cab);
  for (const x of [-0.6, 0, 0.6]) add(new THREE.BoxGeometry(0.004, 0.36, 0.005), M.dark, x, 0.29, 0.222, cab, false);
  for (const x of [-1.1, 1.1]) for (const z of [-0.17, 0.17]) add(new THREE.CylinderGeometry(0.015, 0.012, 0.08, 12), M.brass, x, 0.04, z, cab);
  add(rbox(0.95, 0.065, 0.1, 0.02), M.dark, -0.05, 0.535, 0.05, cab);
  add(rbox(0.26, 0.04, 0.19, 0.004), new THREE.MeshStandardMaterial({ color: '#c96f4a', roughness: .8 }), -0.85, 0.52, 0, cab);
  add(rbox(0.24, 0.035, 0.18, 0.004), new THREE.MeshStandardMaterial({ color: '#2f4a5c', roughness: .8 }), -0.85, 0.557, 0, cab);
  add(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 24), M.pot, -0.52, 0.61, -0.05, cab);

  // console de salon (style PS5, sans logo ni marque)
  const ps = new THREE.Group(); ps.position.set(0.88, 0.505, -0.02); ps.rotation.y = -0.8; cab.add(ps);
  add(rbox(0.07, 0.36, 0.23, 0.012), M.black, 0, 0.19, 0, ps);
  const wing = new THREE.Shape();
  wing.moveTo(-0.12, 0); wing.lineTo(0.11, 0); wing.quadraticCurveTo(0.15, 0.2, 0.135, 0.405); wing.quadraticCurveTo(0.0, 0.385, -0.15, 0.415); wing.quadraticCurveTo(-0.125, 0.2, -0.12, 0);
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 24 });
  for (const s of [-1, 1]) { const w = add(wingGeo, M.white, 0, 0, 0, ps); w.rotation.y = Math.PI / 2; w.position.x = s > 0 ? 0.04 : -0.052; }
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.004, 0.33, 0.004), M.blueLight, s * 0.037, 0.2, 0.118, ps, false);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 24), M.black, 0, 0.006, 0, ps);

  // ---------- télé ----------
  const tv = new THREE.Group(); tv.position.copy(LAYOUT.tvCenter); scene.add(tv);
  add(rbox(1.46, 0.84, 0.03, 0.006, 2), M.black, 0, 0, 0, tv);
  const screen = add(new THREE.PlaneGeometry(LAYOUT.screenSize.w, LAYOUT.screenSize.h), screenMaterial, 0, 0, 0.0165, tv, false);
  screen.name = 'ecran';
  const tvLight = new THREE.RectAreaLight('#7aa6ff', 3.2, 1.43, 0.8); tvLight.position.set(0, 0, 0.05); tvLight.lookAt(0, 0, 3); tv.add(tvLight);
  const led = new THREE.RectAreaLight('#8f6bff', 14, 1.3, 0.7); led.position.set(0, 1.42, -3.44); led.lookAt(0, 1.42, -6); scene.add(led);

  // ---------- table basse, tapis ----------
  const rug = add(new THREE.PlaneGeometry(3.4, 2.5), M.rug, 0, 0.004, 0.0, scene, false); rug.rotation.x = -Math.PI / 2;
  add(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 64), M.travertine, -0.15, 0.38, -0.55);
  add(new THREE.CylinderGeometry(0.16, 0.2, 0.355, 48), M.travertine, -0.15, 0.178, -0.55);
  add(rbox(0.22, 0.03, 0.16, 0.004), new THREE.MeshStandardMaterial({ color: '#1d2a33', roughness: .8 }), -0.25, 0.42, -0.5);
  add(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 24), M.white, 0.05, 0.45, -0.62);

  // ---------- canapé ----------
  const sofa = new THREE.Group(); sofa.position.copy(LAYOUT.sofa); scene.add(sofa);
  add(rbox(2.5, 0.36, 0.95, 0.06), M.sofa, 0, 0.25, 0, sofa);
  for (const x of [-0.57, 0.57]) add(rbox(1.12, 0.17, 0.76, 0.07), M.sofa, x, 0.5, -0.07, sofa);
  add(rbox(2.5, 0.5, 0.22, 0.09), M.sofa, 0, 0.66, 0.37, sofa);
  for (const x of [-0.57, 0.57]) { const b = add(rbox(1.1, 0.42, 0.18, 0.08), M.sofa, x, 0.74, 0.22, sofa); b.rotation.x = 0.14; }
  for (const x of [-1.33, 1.33]) add(rbox(0.22, 0.6, 0.95, 0.08), M.sofa, x, 0.37, 0, sofa);
  for (const x of [-1.3, 1.3]) for (const z of [-0.4, 0.4]) add(new THREE.CylinderGeometry(0.02, 0.018, 0.08, 12), M.brass, x, 0.04, z, sofa);
  const pillow = add(rbox(0.42, 0.4, 0.13, 0.1), new THREE.MeshPhysicalMaterial({ color: '#2f4a5c', map: fabricTex, roughness: 1, sheen: 1, sheenColor: new THREE.Color('#7fa0b8') }), -0.95, 0.75, 0.12, sofa);
  pillow.rotation.set(0.25, 0.25, 0.12);

  // ---------- plante ----------
  const plant = new THREE.Group(); plant.position.set(-2.55, 0, -2.85); scene.add(plant);
  add(new THREE.CylinderGeometry(0.24, 0.19, 0.48, 40), M.pot, 0, 0.24, 0, plant);
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.17, 0.08, 0.15, 0.36, 0, 0.46); leafShape.bezierCurveTo(-0.15, 0.36, -0.17, 0.08, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 12);
  for (let i = 0; i < 20; i++) {
    const a = i * 2.39996, h = rnd(0.7, 1.55), r = rnd(0.15, 0.48);
    const end = new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.46, 0), new THREE.Vector3(end.x * 0.3, h * 0.8, end.z * 0.3), end);
    add(new THREE.TubeGeometry(curve, 10, 0.008, 6), M.stem, 0, 0, 0, plant);
    const lf = add(leafGeo, M.leaf, end.x, end.y, end.z, plant);
    lf.rotation.order = 'YXZ'; lf.rotation.y = -a + Math.PI / 2; lf.rotation.x = -rnd(0.7, 1.3); lf.rotation.z = rnd(-.3, .3);
  }

  // ---------- lampe arc ----------
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

  // lumière du ciel : la lune la nuit, le soleil le jour (position et couleur pilotées par eclairage.js)
  const moon = new THREE.DirectionalLight('#8ea2ff', 0.55); moon.position.set(-6, 3.2, -0.6); moon.target.position.set(0, 1.5, 0.5);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -6.6, right: 6.6, top: 6.6, bottom: -6.6, near: 1, far: 32 });
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.03; moon.shadow.radius = 4;
  scene.add(moon, moon.target);
  const hemi = new THREE.HemisphereLight('#aab6ff', '#3a2a20', 0.22);
  scene.add(hemi);

  // enveloppe invisible qui ne laisse passer le soleil que par la fenêtre
  // (la nuit elle est désactivée : la lune garde son rendu d'origine)
  const enveloppeSoleil = buildSunShell({ x: -4, z0: -1.35, z1: 0.15, y0: 0.6, y1: 2.5, mullions: [{ z: -0.6 }], transoms: [{ y: 1.65 }] });
  scene.add(enveloppeSoleil);
  // applique murale hors champ (derrière la caméra) : éclaire doucement le dos du canapé et de l'avatar
  const fill = new THREE.PointLight('#ffcf9e', 5, 9, 2); fill.position.set(2.3, 2.3, 3.7); scene.add(fill);

  // ---------- ambiance : poussière dans la lumière de la lampe ----------
  scene.updateMatrixWorld(true);
  const apex = spot.getWorldPosition(new THREE.Vector3());
  const aim = spot.target.getWorldPosition(new THREE.Vector3());
  const atmosphere = buildAtmosphere(apex, aim, spot.angle);
  scene.add(atmosphere.group);

  // ---------- rétroéclairage qui suit le menu ----------
  const ambience = {
    led: new THREE.Color('#8f6bff'), tv: new THREE.Color('#7aa6ff'),
    ledBase: new THREE.Color('#8f6bff'), tvBase: new THREE.Color('#7aa6ff'),
  };

  const room = {
    scene, M, pmrem, screen, tv, backWall, led, tvLight,
    groups: { canape: sofa, plante: plant, lampe: lamp },
    seatRoot: sofa,            // objet sur lequel l'avatar s'assoit (remplacé par le GLB s'il existe)
    shadowLights: [spot, moon],
    atmosphere,
    noAO: [...atmosphere.noAO, enveloppeSoleil],   // objets ignorés par l'occlusion ambiante
    // éléments pilotés par eclairage.js (lumière selon l'heure)
    lumieres: { ciel: moon, hemi, lampadaire: spot, halo: glow, applique: fill, tele: tvLight, led },
    ampoule: M.warm,
    vue,
    enveloppeSoleil,
    envListeners: [],
    /** Rappel appelé quand l'environnement change (HDRI chargé). */
    onEnvironment(cb) { this.envListeners.push(cb); cb(scene.environment); },
    /** Couleur d'ambiance (section du menu) : rétroéclairage et lumière de la télé. */
    setAmbience(hex) {
      const c = new THREE.Color(hex);
      ambience.led.copy(ambience.ledBase).lerp(c, 0.6);
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
//  le soleil n'entre que par l'ouverture de la fenêtre (mur gauche).
// ---------------------------------------------------------------------
function buildSunShell({ x, z0, z1, y0, y1, mullions = [], transoms = [] }) {
  const group = new THREE.Group(); group.name = 'enveloppeSoleil';
  const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const R = { x0: -4, x1: 4, z0: -3.5, z1: 4.5, h: 3 }, m = 0.3, t = 0.12;
  const box = (sx, sy, sz, px, py, pz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    b.position.set(px, py, pz); b.castShadow = true; b.receiveShadow = false; group.add(b);
  };
  const zc = (R.z0 + R.z1) / 2, zl = R.z1 - R.z0 + 2 * m, xl = R.x1 - R.x0 + 2 * m, xw = x - t / 2 - 0.005;
  // mur de la fenêtre, percé à l'emplacement de la vitre
  box(t, y0 + m, zl, xw, (y0 - m) / 2, zc);
  box(t, R.h + m - y1, zl, xw, (y1 + R.h + m) / 2, zc);
  box(t, y1 - y0, z0 - (R.z0 - m), xw, (y0 + y1) / 2, (z0 + R.z0 - m) / 2);
  box(t, y1 - y0, R.z1 + m - z1, xw, (y0 + y1) / 2, (z1 + R.z1 + m) / 2);
  // montants et traverses de la fenêtre (ombres fines au sol)
  for (const mu of mullions) box(0.06, y1 - y0, mu.largeur || 0.035, x + 0.03, (y0 + y1) / 2, mu.z);
  for (const tr of transoms) box(0.06, tr.hauteur || 0.035, z1 - z0, x + 0.03, tr.y, (z0 + z1) / 2);
  // plafond, mur de la télé, mur du fond
  box(xl, t, zl, 0, R.h + t / 2 + 0.01, zc);
  box(xl, R.h + 2 * m, t, 0, R.h / 2, R.z0 - t / 2 - 0.01);
  box(xl, R.h + 2 * m, t, 0, R.h / 2, R.z1 + t / 2 + 0.01);
  group.visible = false;
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

/** Pose un modèle : orientation, échelle, position (au sol), ombres ; masque l'objet remplacé. */
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
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    for (const m of [].concat(o.material)) if (m.map) m.map.anisotropy = 8;
  });
  scene.add(holder);
  return holder;
}
