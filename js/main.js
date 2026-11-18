// =====================================================================
//  main.js — Chef d'orchestre : chargement, caméra, intro, interactions,
//  post-traitement, son, qualité adaptative et boucle de rendu.
//
//  Paramètres d'adresse utiles :
//    ?qualite=haute|moyenne|basse   force une qualité
//    ?auto=0                        désactive la baisse automatique
//    ?intro=0                       saute l'intro
//    ?pose                          fige l'animation de l'avatar
//    ?heure=12 · ?heure=23 · ?heure=7h30   force l'heure de l'éclairage
//    ?cycle=60                      fait défiler une journée en 60 s
// =====================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadContent } from './content.js';
import { buildRoom, loadOptionalAssets, LAYOUT } from './scene.js';
import { createGLTFLoader, loadAvatarGLTF, createAvatar } from './avatar.js';
import { TVMenu } from './tvmenu.js';
import { UISound } from './sound.js';
import { createCinematicPass, createSanitizePass } from './effects.js';
import { creerEclairage } from './eclairage.js';

// ---------------------------------------------------------------------
//  Réglages
// ---------------------------------------------------------------------
const ROOM_POS = new THREE.Vector3(1.25, 1.85, 4.55);   // vue de dos (prototype)
const ROOM_TGT = new THREE.Vector3(0.0, 1.12, -2.6);
const ROOM_POS_PORTRAIT = new THREE.Vector3(0.45, 1.95, 4.75);   // écran vertical (téléphone)
const roomPos = () => (innerWidth / innerHeight < 0.8 ? ROOM_POS_PORTRAIT : ROOM_POS).clone();
const CAMERA_Y_MAX = 2.7;   // la caméra reste sous le plafond (3 m) : pas de vue « par-dessus » le salon
const INTRO = { pause: 0.9, duree: 3.2 };               // secondes
const QUALITE = {
  haute:   { pixelRatio: 1.75, ombres: true,  tailleOmbres: 2048, ao: true,  bloom: true,  msaa: 4, cinema: true,  atmosphere: true },
  moyenne: { pixelRatio: 1.25, ombres: true,  tailleOmbres: 1024, ao: false, bloom: true,  msaa: 2, cinema: true,  atmosphere: true },
  basse:   { pixelRatio: 1,    ombres: false, tailleOmbres: 512,  ao: false, bloom: false, msaa: 0, cinema: false, atmosphere: false },
};
const NIVEAUX = ['haute', 'moyenne', 'basse'];
const FPS_MIN = 45;     // en dessous, la qualité baisse d'un cran

const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------
//  Écran de chargement
// ---------------------------------------------------------------------
const progress = { base: 0, avatar: 0, items: 0 };
const RING = 2 * Math.PI * 54;
function showProgress(label) {
  const p = Math.min(1, progress.base * 0.1 + progress.avatar * 0.45 + progress.items * 0.45);
  $('ringFg').style.strokeDashoffset = (RING * (1 - p)).toFixed(1);
  $('loaderPct').textContent = Math.round(p * 100) + ' %';
  if (label) $('loaderText').textContent = label;
}
function showFatal(msg) {
  $('loaderText').textContent = 'Oups';
  const err = $('loaderError');
  err.hidden = false;
  err.querySelector('p').textContent = msg;
}
function hideLoader() {
  const l = $('loader'); l.classList.add('done');
  setTimeout(() => l.remove(), 1000);
}
function announce(text) {
  const sr = $('sr'); sr.textContent = '';
  setTimeout(() => { sr.textContent = text.replace(/\s+/g, ' ').trim(); }, 30);
}

// ---------------------------------------------------------------------
//  Démarrage
// ---------------------------------------------------------------------
main().catch(e => { console.error(e); showFatal('Erreur inattendue : ' + e.message); });

async function main() {
  showProgress('Lecture du contenu');
  let content;
  try { content = await loadContent(); }
  catch (e) { showFatal(e.message); return; }
  const P = content.profil;
  document.title = `${P.nom} · Portfolio`;
  $('brandName').textContent = P.nom;
  $('brandTitle').textContent = P.titre || 'Portfolio';
  $('loaderName').textContent = P.nom;
  $('loaderInitials').textContent = P.nom.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  $('introName').textContent = P.nom;
  $('introRole').textContent = P.titre;
  $('introSeek').textContent = P.recherche;
  progress.base = 0.4; showProgress('Construction du salon');

  // ---------- son ----------
  const sound = new UISound(content.reglages.son !== false);
  const soundBtn = $('soundBtn');
  const refreshSoundBtn = () => {
    soundBtn.setAttribute('aria-pressed', String(sound.enabled));
    soundBtn.title = sound.enabled ? 'Couper le son (M)' : 'Activer le son (M)';
    soundBtn.classList.toggle('off', !sound.enabled);
  };
  refreshSoundBtn();
  const toggleSound = () => { sound.setEnabled(!sound.enabled); refreshSoundBtn(); sound.play('focus'); };
  soundBtn.addEventListener('click', toggleSound);
  const unlockAudio = () => { if (sound.enabled) sound.unlock(); };
  addEventListener('pointerdown', unlockAudio, { capture: true });
  addEventListener('keydown', unlockAudio, { capture: true });

  // ---------- rendu ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  } catch (e) { location.replace('simple.html?raison=webgl'); return; }
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;    // ombres douces
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Salon en 3D : ${P.nom} joue à la console. Le portfolio s'affiche sur la télévision. Appuie sur Entrée pour l'ouvrir.`);
  document.body.prepend(canvas);
  canvas.addEventListener('webglcontextlost', () => location.replace('simple.html?raison=webgl'));

  // ---------- menu télé + salon ----------
  let room = null, avatar = null;
  const menu = new TVMenu(content, {
    onAction: a => runAction(a, P),
    onAnnounce: announce,
    onSound: name => sound.play(name),
    onSection: s => { room && room.setAmbience(s.couleurs[0]); avatar && avatar.setLightColor(s.couleurs[0]); },
    reducedMotion,
  });
  room = buildRoom(renderer, menu.material);
  room.setAmbience(menu.section ? menu.section.couleurs[0] : '#3d8bff');
  const { scene } = room;
  const eclairage = creerEclairage(room, renderer);   // lumière selon l'heure du visiteur
  document.fonts && document.fonts.ready.then(() => { menu.dirty = true; });
  setInterval(() => { menu.dirty = true; }, 30000);   // horloge
  progress.base = 1; showProgress('Chargement de l\'avatar');

  // ---------- caméra ----------
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.05, 50);
  camera.position.copy(roomPos());
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(ROOM_TGT);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.06, enablePan: false, rotateSpeed: 0.5,
    minDistance: 4.6, maxDistance: 7.8, minPolarAngle: 1.2, maxPolarAngle: 1.52,
    minAzimuthAngle: -0.38, maxAzimuthAngle: 0.5,
  });
  controls.enabled = false;
  controls.update();
  function fitFov() {   // écran en portrait : on élargit le champ
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? Math.min(64, 42 + (1 - camera.aspect) * 34) : 42;
    camera.updateProjectionMatrix();
  }
  fitFov();

  // ---------- post-traitement ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth / 2, innerHeight / 2);
  const gtaoSetSize = gtao.setSize.bind(gtao);   // occlusion calculée en demi-résolution (plus rapide)
  gtao.setSize = (w, h) => gtaoSetSize(Math.ceil(w / 2), Math.ceil(h / 2));
  const gtaoHide = gtao.overrideVisibility.bind(gtao);   // le faisceau lumineux ne doit pas créer d'ombre
  gtao.overrideVisibility = () => { gtaoHide(); room.noAO.forEach(o => { o.visible = false; }); };
  gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.2, thickness: 1.2, scale: 1, samples: 16, distanceFallOff: 1 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.8;
  composer.addPass(gtao);
  composer.addPass(createSanitizePass());   // évite les blocs noirs sur Safari
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.45, 1.05);
  composer.addPass(bloom);
  const cinema = createCinematicPass();
  composer.addPass(cinema);
  composer.addPass(new OutputPass());

  // ---------- qualité ----------
  let quality = QUALITE[params.get('qualite')] ? params.get('qualite') : (isMobile ? 'moyenne' : 'haute');
  let mode = 'loading';
  function applyQuality(name) {
    quality = name;
    const q = QUALITE[name];
    const pr = Math.min(devicePixelRatio || 1, q.pixelRatio);
    renderer.setPixelRatio(pr); composer.setPixelRatio(pr);
    if (renderer.shadowMap.enabled !== q.ombres) {
      renderer.shadowMap.enabled = q.ombres;
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
    for (const l of room.shadowLights) {
      if (l.shadow.mapSize.x !== q.tailleOmbres) {
        l.shadow.mapSize.set(q.tailleOmbres, q.tailleOmbres);
        if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
      }
    }
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) {
      if (rt.samples !== q.msaa) { rt.samples = q.msaa; rt.dispose(); }
    }
    bloom.enabled = q.bloom;
    cinema.enabled = q.cinema;
    gtao.enabled = q.ao && mode !== 'tv';
    room.atmosphere.setEnabled(q.atmosphere);
    room.atmosphere.setPixelRatio(pr);
    composer.setSize(innerWidth, innerHeight);
  }
  applyQuality(quality);

  // ---------- chargements (avatar + ressources optionnelles) ----------
  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, loaded, total) => { progress.items = loaded / total; showProgress(); };
  const loader = createGLTFLoader(renderer, manager);
  const onAvatarProgress = e => {
    progress.avatar = e.total ? e.loaded / e.total : Math.min(0.95, e.loaded / 12e6);
    showProgress('Chargement de l\'avatar');
  };
  const [loadedAvatar] = await Promise.all([
    loadAvatarGLTF(loader, onAvatarProgress),
    loadOptionalAssets(room, renderer, manager, loader),
  ]);
  progress.avatar = progress.items = 1;
  showProgress('Installation dans le canapé');
  avatar = createAvatar(loadedAvatar, scene, room.M, room);   // après le canapé : l'assise est détectée
  if (menu.section) avatar.setLightColor(menu.section.couleurs[0]);
  room.onEnvironment(env => avatar.setEnvironment(env));

  // animations fournies dans le fichier GLB : proposées dans un menu
  if (avatar.clips.length) {
    const sel = $('anim');
    avatar.clips.forEach(c => sel.add(new Option(c.name, c.name)));
    sel.parentElement.hidden = false;
    sel.addEventListener('change', () => avatar.playClip(sel.value || null));
  }

  showProgress('Préparation de la scène');
  try { await renderer.compileAsync(scene, camera); } catch { /* compilation au premier rendu */ }
  composer.render();

  // ---------- intro : de trois-quarts face → vue de dos ----------
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  let intro = null;
  const body = document.body;
  function startIntro() {
    if (params.get('intro') === '0' || reducedMotion) return endIntro();
    mode = 'intro';
    const head = avatar.headPosition();
    const pivot = head.clone().add(new THREE.Vector3(0, -0.08, 0));
    const end = roomPos().sub(pivot);
    const a0 = Math.atan2(0.57, -0.82), a1 = Math.atan2(end.x, end.z);    // 3/4 face (côté droit) → dos
    // on vise un peu à gauche du visage : le sujet se place sur le tiers droit, le titre à gauche
    const look = pivot.clone().add(new THREE.Vector3(0.82, 0, 0.57).multiplyScalar(innerWidth / innerHeight > 1 ? 0.34 : 0.05)).add(new THREE.Vector3(0, -0.06, 0));
    intro = { time: 0, pivot, head: look, a0, a1, r0: 1.7, r1: Math.hypot(end.x, end.z), y0: 0.02, y1: end.y, titled: false, untitled: false };
    $('skip').hidden = false;
    $('hint').classList.add('off');
    body.classList.add('intro');
    announce(`${P.nom}, portfolio. Introduction en cours, appuie sur Échap pour passer.`);
  }
  function updateIntro(dt) {
    const I = intro;
    I.time += dt;   // temps cumulé : un ralentissement ne fait pas sauter l'intro
    if (!I.titled && I.time > 0.35) { I.titled = true; body.classList.add('intro-title'); }
    if (!I.untitled && I.time > INTRO.pause + INTRO.duree * 0.62) { I.untitled = true; body.classList.remove('intro-title'); }
    const u = THREE.MathUtils.clamp((I.time - INTRO.pause) / INTRO.duree, 0, 1), k = ease(u);
    const a = THREE.MathUtils.lerp(I.a0, I.a1, k), r = THREE.MathUtils.lerp(I.r0, I.r1, k);
    camera.position.set(I.pivot.x + Math.sin(a) * r, I.pivot.y + THREE.MathUtils.lerp(I.y0, I.y1, k), I.pivot.z + Math.cos(a) * r);
    controls.target.lerpVectors(I.head, ROOM_TGT, k);
    camera.lookAt(controls.target);
    if (u >= 1) endIntro();
  }
  function endIntro() {
    intro = null; mode = 'room';
    room.backWall.visible = false;
    camera.position.copy(roomPos()); controls.target.copy(ROOM_TGT);
    controls.enabled = true; controls.update();
    look.x = look.y = look.tx = look.ty = 0;
    $('skip').hidden = true;
    $('hint').classList.remove('off');
    body.classList.remove('intro', 'intro-title');
    lastInput = performance.now();
    resetFps();
  }
  $('skip').addEventListener('click', endIntro);

  // ---------- zoom sur la télé ----------
  let tween = null;
  const back = $('back'), hintText = $('hintText');
  const roomHint = isMobile ? 'Touche la télé pour commencer · glisse pour tourner' : 'Clique sur la télé ou appuie sur Entrée · glisse pour tourner';
  hintText.textContent = roomHint;
  function tvView() {
    const fov = THREE.MathUtils.degToRad(camera.fov), h = LAYOUT.screenSize.h * 1.1, w = LAYOUT.screenSize.w * 1.1;
    const d = Math.max(h / (2 * Math.tan(fov / 2)), w / (2 * Math.tan(fov / 2) * camera.aspect));
    return { pos: new THREE.Vector3(0, LAYOUT.tvCenter.y, LAYOUT.screenZ + d), tgt: new THREE.Vector3(0, LAYOUT.tvCenter.y, LAYOUT.screenZ) };
  }
  function fly(pos, tgt, done) { tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: tgt, start: performance.now(), dur: 1500, done }; }
  function enterTV() {
    if (mode !== 'room') return;
    mode = 'flying'; controls.enabled = false;
    menu.setHover(false);
    sound.play('enter');
    const v = tvView();
    fly(v.pos, v.tgt, () => {
      mode = 'tv'; gtao.enabled = false; bloom.strength = 0.14;   // texte plus net sur l'écran
      back.classList.add('on');
      hintText.textContent = isMobile ? 'Touche une vignette ou un élément' : 'Flèches pour naviguer · Entrée pour ouvrir · Échap pour revenir';
      menu.select(menu.sel);
    });
  }
  function leaveTV() {
    if (mode !== 'tv') return;
    mode = 'flying'; back.classList.remove('on'); bloom.strength = 0.28;
    menu.hoverAt(null);
    sound.play('leave');
    fly(roomPos(), ROOM_TGT.clone(), () => {
      mode = 'room'; controls.enabled = true; gtao.enabled = QUALITE[quality].ao;
      look.x = look.y = look.tx = look.ty = 0;
      hintText.textContent = roomHint;
      lastInput = performance.now();
      announce('Retour au salon.');
    });
  }
  back.addEventListener('click', leaveTV);

  // ---------- souris / tactile ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let lastInput = performance.now();
  function pick(e) {
    ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    return ray.intersectObject(room.screen)[0];
  }
  let downAt = null, dragging = false;
  const look = { x: 0, y: 0, tx: 0, ty: 0 };   // parallaxe : la caméra suit légèrement la souris
  canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; dragging = true; lastInput = performance.now(); });
  addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    downAt = null;
    if (mode === 'intro') return endIntro();
    const hit = pick(e);
    if (!hit) return;
    if (mode === 'room') enterTV();
    else if (mode === 'tv') menu.clickAt(hit.uv);
  });
  canvas.addEventListener('pointermove', e => {
    lastInput = performance.now();
    if (e.pointerType === 'touch') return;
    if (!dragging) { look.tx = e.clientX / innerWidth - 0.5; look.ty = e.clientY / innerHeight - 0.5; }
    const hit = mode === 'room' || mode === 'tv' ? pick(e) : null;
    let pointer = false;
    if (mode === 'tv') pointer = menu.hoverAt(hit ? hit.uv : null);
    else if (mode === 'room') { pointer = !!hit; menu.setHover(pointer); }
    canvas.style.cursor = pointer ? 'pointer' : (mode === 'room' ? 'grab' : 'default');
  });
  canvas.addEventListener('pointerleave', () => menu.setHover(false));
  canvas.addEventListener('wheel', e => { lastInput = performance.now(); if (mode === 'tv') { menu.wheel(e.deltaY); e.preventDefault(); } }, { passive: false });

  // ---------- clavier ----------
  addEventListener('keydown', e => {
    lastInput = performance.now();
    const tag = e.target && e.target.tagName;
    if (['A', 'BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(tag) && (e.key === 'Enter' || e.key === ' ')) return;
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) { toggleSound(); return; }
    if (mode === 'intro') {
      if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); endIntro(); }
    } else if (mode === 'room') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterTV(); }
    } else if (mode === 'tv') {
      const r = menu.handleKey(e.key);
      if (r) e.preventDefault();
      if (r === 'exit') leaveTV();
    }
  });

  addEventListener('resize', () => {
    fitFov();
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    if (mode === 'tv') { const v = tvView(); camera.position.copy(v.pos); }
  });

  // ---------- surveillance des FPS ----------
  const autoQuality = params.get('auto') !== '0';
  let fpsAcc = 0, fpsFrames = 0, lowCount = 0, fpsWait = 2;
  function resetFps() { fpsAcc = 0; fpsFrames = 0; lowCount = 0; fpsWait = 2; }
  function monitorFps(dt) {
    if (!autoQuality || mode === 'intro' || mode === 'loading' || document.hidden) return;
    if (fpsWait > 0) { fpsWait -= dt; return; }
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc < 2) return;
    const fps = fpsFrames / fpsAcc;
    fpsAcc = 0; fpsFrames = 0;
    if (fps >= FPS_MIN) { lowCount = 0; return; }
    if (++lowCount < 2) return;
    const i = NIVEAUX.indexOf(quality);
    if (i < NIVEAUX.length - 1) {
      applyQuality(NIVEAUX[i + 1]);
      console.info(`[qualité] ${fps.toFixed(0)} FPS → qualité ${quality}`);
      resetFps();
    } else if (fps < 24) {
      $('slowToast').hidden = false;
      lowCount = -1e9;   // une seule fois
    }
  }

  // ---------- boucle ----------
  const clock = new THREE.Clock();
  const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  function loop() {
    requestAnimationFrame(loop);
    const raw = clock.getDelta(), dt = Math.min(raw, 0.1), t = clock.elapsedTime;
    avatar.update(dt, t);
    menu.update(dt);
    eclairage.update(dt, t);
    room.update(dt, t);
    if (intro) updateIntro(dt);
    else if (tween) {
      const k = ease(Math.min((performance.now() - tween.start) / tween.dur, 1));
      camera.position.lerpVectors(tween.p0, tween.p1, k); controls.target.lerpVectors(tween.t0, tween.t1, k); camera.lookAt(controls.target);
      if (k >= 1) { const d = tween.done; tween = null; d && d(); }
    } else if (mode === 'room') {
      // caméra qui dérive doucement quand personne ne touche à rien
      if (!reducedMotion && performance.now() - lastInput > 7000) {
        tmp.copy(camera.position).sub(controls.target).applyAxisAngle(UP, Math.sin(t * 0.1) * 0.03 * dt);
        camera.position.copy(controls.target).add(tmp);
      }
      if (!reducedMotion && !dragging) {
        const kl = 1 - Math.exp(-dt * 2.5);
        look.x += (look.tx - look.x) * kl; look.y += (look.ty - look.y) * kl;
        controls.target.set(ROOM_TGT.x + look.x * 0.5, ROOM_TGT.y - look.y * 0.22, ROOM_TGT.z);
      }
      // vue plongeante limitée selon le recul, pour que la caméra ne passe jamais au-dessus du plafond
      const recul = camera.position.distanceTo(controls.target);
      controls.minPolarAngle = Math.max(1.2, Math.acos(Math.min(1, (CAMERA_Y_MAX - controls.target.y) / recul)));
      controls.update();
      if (camera.position.y > CAMERA_Y_MAX) { camera.position.y = CAMERA_Y_MAX; camera.lookAt(controls.target); }
    }
    const onTV = mode === 'tv' || (mode === 'flying' && tween && tween.t1.z < -3);
    cinema.tick(dt, camera.aspect, onTV);
    composer.render(dt);
    if (raw < 3) monitorFps(raw);   // vrai temps écoulé (ignore un retour d'onglet)
  }

  hideLoader();
  window.__portfolio = {
    scene, camera, avatar, menu, renderer, room, sound, applyQuality, eclairage,
    /** Change l'heure de l'éclairage (ex. 19.5 ou "7h30") ; null = heure réelle. */
    heure: h => eclairage.heure(h),
    get mode() { return mode; }, get quality() { return quality; }, enterTV, leaveTV, endIntro,
    /** Débogage : place la caméra librement (console du navigateur). */
    vue(pos, tgt) { mode = 'debug'; intro = null; camera.position.set(...pos); controls.target.set(...tgt); camera.lookAt(controls.target); },
  };
  startIntro();
  loop();
}

// ---------------------------------------------------------------------
//  Actions des boutons du menu
// ---------------------------------------------------------------------
function runAction(a, profil) {
  if (a.type === 'url') return openUrl(a.url);
  const b = a.bouton;
  if (b.action === 'cv') openUrl(profil.cv);
  else if (b.action === 'email') { if (profil.email) openUrl('mailto:' + profil.email); }
  else if (b.action === 'lien') openUrl(b.cible || b.lien);
}
function openUrl(url) {
  if (!url) return;
  if (/^(mailto|tel):/i.test(url)) location.href = url;
  else window.open(url, '_blank', 'noopener');
}
