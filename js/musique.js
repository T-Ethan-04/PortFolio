// =====================================================================
//  musique.js — L'enceinte du salon : un petit lecteur de musique.
//
//  • Rien ne se lance tout seul : la musique démarre quand le visiteur
//    clique sur l'enceinte (ou sur le bouton ♪ en haut à droite).
//  • Les morceaux sont listés dans content.json, rubrique "musique" :
//      "musique": { "volume": 0.6, "pistes": [
//        { "titre": "…", "artiste": "…", "fichier": "assets/musique/morceau.mp3" } ] }
//    Mets les MP3 dans assets/musique/ (morceaux libres de droits uniquement).
//  • Tant qu'aucun morceau n'est listé, l'enceinte joue des ambiances
//    lo-fi composées en direct par le navigateur (aucun fichier).
// =====================================================================

const clamp01 = x => Math.min(1, Math.max(0, x));
const freq = n => 440 * Math.pow(2, (n - 69) / 12);   // note MIDI → Hz

// ---------------------------------------------------------------------
//  Ambiances composées en direct (accords en notes MIDI, une mesure chacun)
// ---------------------------------------------------------------------
export const STATIONS = [
  {
    titre: 'Lo-fi du salon', tempo: 78,
    accords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],      // Fa7M · Mim7 · Rém7 · Do7M
    basses: [41, 40, 38, 36],
    gamme: [60, 62, 64, 67, 69, 72, 74, 76],
  },
  {
    titre: 'Pluie sur la forêt', tempo: 70,
    accords: [[57, 60, 64, 67, 71], [50, 53, 57, 60, 64], [55, 59, 62, 64, 69], [48, 52, 55, 59, 62]],   // Lam9 · Rém9 · Sol6/9 · Do7M9
    basses: [45, 38, 43, 36],
    gamme: [69, 72, 74, 76, 79, 81],
  },
  {
    titre: 'Fin de soirée', tempo: 84,
    accords: [[51, 55, 58, 62], [48, 51, 55, 58, 62], [56, 60, 63, 67], [53, 58, 62, 65]],   // Mib7M · Dom9 · Lab7M · Sib/Fa
    basses: [39, 36, 44, 46],
    gamme: [63, 65, 67, 70, 72, 75],
  },
];

/** Une ambiance lo-fi : piano électrique, basse, batterie feutrée, mélodie, craquements de vinyle. */
class Station {
  constructor(ctx, sortie, def, effets) {
    this.ctx = ctx; this.def = def; this.fx = effets;
    this.bus = ctx.createGain(); this.bus.gain.value = 0; this.bus.connect(sortie);
    const c = ctx;
    // chaîne « lo-fi » : compression douce puis filtre
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -18; this.comp.ratio.value = 3; this.comp.attack.value = 0.01; this.comp.release.value = 0.25;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 5200; this.lp.Q.value = 0.5;
    this.comp.connect(this.lp); this.lp.connect(this.bus);
    // piano : filtre + trémolo, envoyé vers la réverbération et l'écho
    this.keys = c.createGain(); this.keys.gain.value = 0.9;
    const kf = c.createBiquadFilter(); kf.type = 'lowpass'; kf.frequency.value = 2100;
    this.trem = c.createGain(); this.trem.gain.value = 0.88;
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 4.6; lfoG.gain.value = 0.1;
    lfo.connect(lfoG); lfoG.connect(this.trem.gain); lfo.start(); this.lfo = lfo;
    this.keys.connect(kf); kf.connect(this.trem); this.trem.connect(this.comp);
    const sendR = c.createGain(); sendR.gain.value = 0.32; this.trem.connect(sendR); sendR.connect(effets.reverb);
    const sendD = c.createGain(); sendD.gain.value = 0.16; this.trem.connect(sendD); sendD.connect(effets.delay);
    // basse, batterie, mélodie
    this.bass = c.createGain(); this.bass.gain.value = 0.55;
    const bf = c.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 420; this.bass.connect(bf); bf.connect(this.comp);
    this.drums = c.createGain(); this.drums.gain.value = 0.6;
    const df = c.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 4200; this.drums.connect(df); df.connect(this.comp);
    const sendDr = c.createGain(); sendDr.gain.value = 0.08; df.connect(sendDr); sendDr.connect(effets.reverb);
    this.mel = c.createGain(); this.mel.gain.value = 0.22;
    this.mel.connect(this.comp);
    const sendM = c.createGain(); sendM.gain.value = 0.5; this.mel.connect(sendM); sendM.connect(effets.delay);
    const sendMR = c.createGain(); sendMR.gain.value = 0.4; this.mel.connect(sendMR); sendMR.connect(effets.reverb);
    effets.retour.connect(this.comp);
    // craquements de vinyle
    this.vinyle = c.createBufferSource(); this.vinyle.buffer = effets.vinyle; this.vinyle.loop = true;
    const vg = c.createGain(); vg.gain.value = 0.05; this.vinyle.connect(vg); vg.connect(this.bus);
    this.pas = 0; this.derniereNote = def.gamme[2];
  }

  start() {
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(0, t); this.bus.gain.linearRampToValueAtTime(1, t + 1.2);
    this.prochain = t + 0.08;
    this.vinyle.start();
    this.minuteur = setInterval(() => this.planifier(), 40);
    this.planifier();
  }

  stop() {
    clearInterval(this.minuteur);
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t); this.bus.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => {
      try { this.vinyle.stop(); this.lfo.stop(); } catch { /* déjà arrêté */ }
      this.fx.retour.disconnect(this.comp);
      this.bus.disconnect();
    }, 600);
  }

  planifier() {
    const avance = document.hidden ? 1.6 : 0.3;            // onglet en arrière-plan : on prévoit plus loin
    const double = 60 / this.def.tempo / 4;                  // durée d'une double croche
    while (this.prochain < this.ctx.currentTime + avance) {
      this.jouerPas(this.pas, this.prochain, double);
      this.prochain += double; this.pas++;
    }
  }

  jouerPas(pas, t, double) {
    const d = this.def, p16 = pas % 16, mesure = Math.floor(pas / 16), i = mesure % d.accords.length;
    const swing = p16 % 4 === 2 ? double * 0.28 : 0;      // croches « balancées »
    const h = () => (Math.random() - 0.5) * 0.012;          // petit décalage humain
    const tt = t + swing;
    // piano : accord sur le temps, rappel sur le « et » du 2e ou du 3e temps
    if (p16 === 0) this.accord(d.accords[i], t + h(), double * 9, 0.95);
    if (p16 === (mesure % 2 ? 6 : 10)) this.accord(d.accords[i], tt + h(), double * 5, 0.55);
    // basse
    if (p16 === 0) this.basse(d.basses[i], t, double * 6, 1);
    if (p16 === 7 && Math.random() < 0.6) this.basse(d.basses[i], tt, double * 2, 0.6);
    if (p16 === 10) this.basse(d.basses[i] + 7, tt, double * 4, 0.75);
    // batterie
    if (p16 === 0 || p16 === 10 || (p16 === 7 && Math.random() < 0.35)) this.grosseCaisse(tt, p16 === 0 ? 1 : 0.7);
    if (p16 === 4 || p16 === 12) this.caisseClaire(t + h(), 1);
    if (p16 % 2 === 0) this.charleston(tt + h(), p16 % 4 === 0 ? 0.55 : 0.35, p16 === 14 && Math.random() < 0.25);
    // mélodie clairsemée (deux mesures sur quatre)
    if (mesure % 4 >= 2 && p16 % 2 === 0 && Math.random() < 0.22) this.melodie(tt + h(), double * 3);
  }

  accord(notes, t, duree, vel) {
    for (const n of notes) this.piano(n, t + Math.random() * 0.018, duree, vel * (0.85 + Math.random() * 0.2));
  }

  /** Piano électrique : synthèse FM douce (porteuse + modulatrice). */
  piano(n, t, duree, vel) {
    const c = this.ctx, f = freq(n) * Math.pow(2, (Math.random() - 0.5) * 0.004);
    const car = c.createOscillator(), mod = c.createOscillator(), modG = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f;
    modG.gain.setValueAtTime(f * 1.6, t); modG.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.6);
    mod.connect(modG); modG.connect(car.frequency);
    const a = 0.055 * vel;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.006);
    g.gain.exponentialRampToValueAtTime(a * 0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + duree + 0.8);
    car.connect(g); g.connect(this.keys);
    car.start(t); mod.start(t); car.stop(t + duree + 0.9); mod.stop(t + duree + 0.9);
  }

  basse(n, t, duree, vel) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = freq(n);
    const a = 0.32 * vel;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.012);
    g.gain.exponentialRampToValueAtTime(a * 0.4, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
    o.connect(g); g.connect(this.bass); o.start(t); o.stop(t + duree + 0.05);
  }

  grosseCaisse(t, vel) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g); g.connect(this.drums); o.start(t); o.stop(t + 0.4);
  }

  caisseClaire(t, vel) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.fx.bruit; f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    s.connect(f); f.connect(g); g.connect(this.drums); s.start(t, Math.random() * 0.5); s.stop(t + 0.22);
    const o = c.createOscillator(), og = c.createGain();       // corps de la caisse
    o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og); og.connect(this.drums); o.start(t); o.stop(t + 0.14);
  }

  charleston(t, vel, ouvert) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.fx.bruit; f.type = 'highpass'; f.frequency.value = 7000;
    const d = ouvert ? 0.22 : 0.045;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(this.drums); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  }

  melodie(t, duree) {
    const gm = this.def.gamme;
    let k = gm.indexOf(this.derniereNote); if (k < 0) k = 2;
    k = Math.min(gm.length - 1, Math.max(0, k + [-2, -1, -1, 1, 1, 2][Math.random() * 6 | 0]));
    this.derniereNote = gm[k];
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sine'; o.frequency.value = freq(gm[k] + 12);
    vib.frequency.value = 5; vg.gain.value = 3; vib.connect(vg); vg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + duree + 0.6);
    o.connect(g); g.connect(this.mel); o.start(t); vib.start(t); o.stop(t + duree + 0.7); vib.stop(t + duree + 0.7);
  }
}

// ---------------------------------------------------------------------
//  Le lecteur
// ---------------------------------------------------------------------
export class Musique {
  /** @param reglages  rubrique "musique" de content.json ({ volume, pistes }) */
  constructor(reglages = {}) {
    this.fichiers = (reglages.pistes || []).filter(p => p && p.fichier);
    this.volume = clamp01(reglages.volume ?? 0.6);
    this.index = 0; this.joue = false; this.attenue = false; this.muet = false;
    this.ecouteurs = []; this.niveauLisse = 0;
  }

  /** Liste affichée : les MP3 de content.json, sinon les ambiances composées en direct. */
  get liste() {
    return this.fichiers.length
      ? this.fichiers.map(p => ({ type: 'fichier', titre: p.titre || p.fichier.split('/').pop(), artiste: p.artiste || '', fichier: p.fichier }))
      : STATIONS.map(s => ({ type: 'station', titre: s.titre, artiste: 'Composé en direct', station: s }));
  }

  get piste() { const l = this.liste; return l[((this.index % l.length) + l.length) % l.length]; }

  onChange(cb) { this.ecouteurs.push(cb); cb(this.etat()); }
  etat() { const p = this.piste; return { joue: this.joue, titre: p.titre, artiste: p.artiste, index: this.index, total: this.liste.length }; }
  signaler() { const e = this.etat(); this.ecouteurs.forEach(cb => cb(e)); }

  /** Crée la chaîne audio (au premier clic : les navigateurs l'exigent). */
  initialiser() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const c = this.ctx = new AC();
    this.sortie = c.createGain();                       // volume × atténuation × muet
    this.analyse = c.createAnalyser(); this.analyse.fftSize = 512;
    this.sortie.connect(this.analyse); this.analyse.connect(c.destination);
    this.mesure = new Uint8Array(this.analyse.fftSize);
    this.appliquerVolume(0);
    // effets partagés par les ambiances
    const reverb = c.createConvolver(), n = Math.floor(c.sampleRate * 2.6), ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    reverb.buffer = ir;
    const delay = c.createDelay(1.5); delay.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.32;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay);
    const retour = c.createGain(); retour.gain.value = 0.55;
    reverb.connect(retour); dlp.connect(retour);
    const bruit = c.createBuffer(1, c.sampleRate, c.sampleRate), b = bruit.getChannelData(0);
    for (let i = 0; i < b.length; i++) b[i] = Math.random() * 2 - 1;
    const vinyle = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), v = vinyle.getChannelData(0);
    let lisse = 0;
    for (let i = 0; i < v.length; i++) {
      lisse = lisse * 0.97 + (Math.random() * 2 - 1) * 0.03;
      v[i] = lisse * 0.6 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.9 : 0);
    }
    this.effets = { reverb, delay, retour, bruit, vinyle };
    // lecteur de fichiers
    this.audio = new Audio(); this.audio.preload = 'auto'; this.audio.crossOrigin = 'anonymous';
    const src = c.createMediaElementSource(this.audio); src.connect(this.sortie);
    this.audio.addEventListener('ended', () => this.suivant());
    this.audio.addEventListener('error', () => this.fichierIntrouvable());
    return true;
  }

  appliquerVolume(duree = 0.25) {
    if (!this.ctx) return;
    const g = this.muet ? 0 : this.volume * (this.attenue ? 0.4 : 1);
    const t = this.ctx.currentTime;
    this.sortie.gain.cancelScheduledValues(t);
    this.sortie.gain.setValueAtTime(this.sortie.gain.value, t);
    this.sortie.gain.linearRampToValueAtTime(g, t + duree);
  }

  lancerPiste() {
    this.arreterSource();
    const p = this.piste;
    if (p.type === 'station') {
      this.station = new Station(this.ctx, this.sortie, p.station, this.effets);
      this.station.start();
    } else {
      this.audio.src = p.fichier;
      this.audio.play().catch(() => {});
    }
  }

  arreterSource() {
    if (this.station) { this.station.stop(); this.station = null; }
    if (this.audio && !this.audio.paused) this.audio.pause();
  }

  /** Un MP3 de la liste est introuvable : on le retire (et on passe aux ambiances s'il n'en reste aucun). */
  fichierIntrouvable() {
    const p = this.piste, src = this.audio.getAttribute('src');
    if (p.type !== 'fichier' || !src || src !== p.fichier) return;
    console.warn(`[musique] fichier introuvable : ${p.fichier}`);
    this.fichiers = this.fichiers.filter(f => f.fichier !== p.fichier);
    if (this.joue) this.lancerPiste();
    this.signaler();
  }

  lecture() {
    if (!this.initialiser()) return;
    if (this.joue) return;
    this.joue = true;
    if (this.piste.type === 'fichier' && this.audio.src && this.audio.currentTime > 0 && !this.audio.ended) this.audio.play().catch(() => {});
    else this.lancerPiste();
    this.signaler();
  }

  pause() {
    if (!this.joue) return;
    this.joue = false;
    if (this.station) { this.station.stop(); this.station = null; }
    if (this.audio) this.audio.pause();
    this.signaler();
  }

  basculer() { this.joue ? this.pause() : this.lecture(); }

  changer(pas) {
    this.index = (this.index + pas + this.liste.length) % this.liste.length;
    if (this.joue) { if (this.audio) this.audio.currentTime = 0; this.lancerPiste(); }
    else if (this.audio) this.audio.removeAttribute('src');
    this.signaler();
  }
  suivant() { this.changer(1); }
  precedent() { this.changer(-1); }

  setVolume(v) { this.volume = clamp01(v); this.appliquerVolume(0.05); }
  /** Baisse la musique (par exemple quand on navigue dans le menu de la télé). */
  setAttenuation(on) { this.attenue = on; this.appliquerVolume(0.6); }
  setMuet(m) { this.muet = m; this.appliquerVolume(0.2); }

  /** Niveau sonore actuel, de 0 à 1 (pour faire pulser la LED de l'enceinte). */
  niveau() {
    if (!this.ctx || !this.joue) { this.niveauLisse *= 0.9; return this.niveauLisse; }
    this.analyse.getByteTimeDomainData(this.mesure);
    let s = 0;
    for (let i = 0; i < this.mesure.length; i++) { const x = (this.mesure[i] - 128) / 128; s += x * x; }
    const rms = Math.sqrt(s / this.mesure.length);
    this.niveauLisse += (Math.min(1, rms * 4) - this.niveauLisse) * 0.25;
    return this.niveauLisse;
  }
}

/** Relie le petit lecteur (HTML de index.html) à la musique. */
export function brancherLecteur(musique, $) {
  const boite = $('lecteur'), bouton = $('musBtn');
  const titre = $('musTitre'), artiste = $('musArtiste'), play = $('musPlay'), vol = $('musVolume');
  vol.value = String(musique.volume);
  musique.onChange(e => {
    titre.textContent = e.titre; artiste.textContent = e.artiste;
    play.classList.toggle('on', e.joue);
    play.setAttribute('aria-label', e.joue ? 'Mettre en pause' : 'Lancer la musique');
    bouton.classList.toggle('on', e.joue);
    bouton.setAttribute('aria-pressed', String(e.joue));
    bouton.title = e.joue ? 'Mettre la musique en pause' : 'Lancer la musique';
  });
  const montrer = () => { boite.hidden = false; };
  play.addEventListener('click', () => musique.basculer());
  $('musPrev').addEventListener('click', () => musique.precedent());
  $('musNext').addEventListener('click', () => musique.suivant());
  $('musFermer').addEventListener('click', () => { musique.pause(); boite.hidden = true; });
  vol.addEventListener('input', () => musique.setVolume(+vol.value));
  bouton.addEventListener('click', () => { musique.basculer(); montrer(); });
  return { montrer };
}
