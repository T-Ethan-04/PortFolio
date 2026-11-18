// =====================================================================
//  tvmenu.js — Le menu "façon console" affiché sur la télé.
//
//  • L'interface (vignettes, textes, boutons) est dessinée sur un canvas
//    1920×1080 transparent.
//  • Le fond animé (vagues de lumière, reflets, scintillements) est calculé
//    par un shader : il bouge en permanence sans coût pour le canvas.
//  • Toutes les données viennent de content.json : ajouter / retirer une
//    section suffit, le menu s'adapte (défilement au-delà de 6 vignettes).
//
//  Navigation :  ← →  sections   ↑ ↓  contenu   Entrée  ouvrir   Échap  retour
// =====================================================================
import * as THREE from 'three';
import { iconPath } from './icons.js';
import { hasPage, pageParagraphs, elementLink } from './content.js';
import { maintenant } from './eclairage.js';

const W = 1920, H = 1080;
const FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';
const font = (weight, size) => `${weight} ${size}px ${FONT}`;

export class TVMenu {
  /**
   * @param {object} content  données normalisées (content.js)
   * @param {object} opts     { onAction(action), onAnnounce(texte), onSound(nom), onSection(section) }
   */
  constructor(content, opts = {}) {
    this.profil = content.profil;
    this.sections = content.sections;
    this.maxVisible = Math.max(3, content.reglages.vignettesVisibles || 6);
    this.onAction = opts.onAction || (() => {});
    this.onAnnounce = opts.onAnnounce || (() => {});
    this.onSound = opts.onSound || (() => {});
    this.onSection = opts.onSection || (() => {});
    this.instant = !!opts.reducedMotion;

    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.material = createScreenMaterial(this.texture);
    this.uniforms = this.material.uniforms;

    const start = this.sections.findIndex(s => s.id === content.reglages.sectionDepart);
    this.sel = Math.max(0, start);   // section sélectionnée
    this.offset = 0;                 // première vignette visible (défilement)
    this.focus = 'tiles';            // 'tiles' | 'list' | 'button'
    this.item = 0;                   // élément focalisé dans la liste
    this.detail = null;              // sous-page ouverte
    this.hover = null;               // zone survolée à la souris
    this.regions = [];               // zones cliquables du dernier dessin
    this.images = new Map();

    // animation
    this.w = this.sections.map((_, i) => (i === this.sel ? 1 : 0));   // grossissement des vignettes
    this.scroll = 0; this.fade = 1; this.hoverTV = 0; this.hoverTarget = 0;
    this.dirty = true;
    this.targetA = new THREE.Color(); this.targetB = new THREE.Color();
    this.setSectionColors(true);

    // photo de profil facultative (content.json → profil.photo)
    if (this.profil.photo) this.photo = this.getImage(this.profil.photo);

    this.draw();
  }

  get section() { return this.sections[this.sel]; }

  setSectionColors(immediate) {
    const s = this.section;
    if (!s) return;
    this.targetA.set(s.couleurs[0]); this.targetB.set(s.couleurs[1]);
    if (immediate) { this.uniforms.uColA.value.copy(this.targetA); this.uniforms.uColB.value.copy(this.targetB); }
    this.onSection(s);
  }

  /** Survol de la télé depuis le salon (léger halo). */
  setHover(on) { this.hoverTarget = on ? 1 : 0; }

  /** À appeler à chaque image : anime le fond, les vignettes et les fondus. */
  update(dt) {
    const u = this.uniforms;
    u.uTime.value += dt;
    const kc = 1 - Math.exp(-dt * 4);
    u.uColA.value.lerp(this.targetA, kc); u.uColB.value.lerp(this.targetB, kc);
    this.hoverTV += (this.hoverTarget - this.hoverTV) * (1 - Math.exp(-dt * 8));
    u.uHover.value = this.hoverTV;

    let animating = false;
    const kw = this.instant ? 1 : 1 - Math.exp(-dt * 15);
    for (let i = 0; i < this.w.length; i++) {
      const tgt = i === this.sel ? 1 : 0, d = tgt - this.w[i];
      if (Math.abs(d) > 0.002) { this.w[i] += d * kw; animating = true; } else this.w[i] = tgt;
    }
    if (Math.abs(this.scrollTarget - this.scroll) > 0.5) { this.scroll += (this.scrollTarget - this.scroll) * kw; animating = true; }
    else this.scroll = this.scrollTarget ?? 0;
    if (this.fade < 0.995) { this.fade = this.instant ? 1 : this.fade + (1 - this.fade) * (1 - Math.exp(-dt * 9)); animating = true; }
    else this.fade = 1;
    if (animating || this.dirty) this.draw();
  }

  // ------------------------------------------------------------------
  //  Dessin
  // ------------------------------------------------------------------
  draw() {
    const g = this.g;
    this.dirty = false;
    this.regions = [];
    g.clearRect(0, 0, W, H);
    g.save();
    g.textBaseline = 'middle'; g.textAlign = 'left';
    this.drawHeader();
    if (!this.sections.length) {
      g.fillStyle = '#fff'; g.font = font(700, 56);
      g.fillText('Ajoute une section dans content.json', 80, 520);
    } else if (this.detail) this.drawDetail();
    else this.drawHome();
    g.restore();
    this.texture.needsUpdate = true;
  }

  drawHeader() {
    const g = this.g;
    // profil (photo ou initiales)
    g.save();
    g.beginPath(); g.arc(110, 80, 30, 0, 7); g.closePath();
    if (this.photo && this.photo.ok) {
      g.clip();
      const im = this.photo.el, k = Math.max(60 / im.width, 60 / im.height);
      g.drawImage(im, 110 - im.width * k / 2, 80 - im.height * k / 2, im.width * k, im.height * k);
    } else {
      g.fillStyle = '#3d8bff'; g.fill();
      g.fillStyle = '#fff'; g.font = font(700, 24); g.textAlign = 'center';
      g.fillText(initials(this.profil.nom), 110, 81);
    }
    g.restore();
    g.textAlign = 'left'; g.fillStyle = '#fff'; g.font = font(600, 28); g.fillText(this.profil.nom, 156, 81);
    // barre d'état : manette, wifi, heure
    const d = maintenant();   // heure réelle (ou heure forcée avec ?heure=)
    g.textAlign = 'right'; g.fillStyle = '#d7e3ff'; g.font = font(500, 28);
    g.fillText(d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), 1830, 81);
    g.textAlign = 'left';
    drawIcon(g, 'gamepad', 1690, 81, 1.25, 2, 'rgba(215,227,255,.85)');
    g.strokeStyle = 'rgba(215,227,255,.85)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(1630, 95, 8 + i * 8, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }
    g.fillStyle = 'rgba(215,227,255,.85)'; g.beginPath(); g.arc(1630, 95, 3, 0, 7); g.fill();
  }

  drawFooter(text) {
    const g = this.g;
    g.fillStyle = '#c9d6f5'; g.font = font(500, 24); g.textAlign = 'right';
    g.fillText(text, 1840, 1040); g.textAlign = 'left';
  }

  /** Écran d'accueil : vignettes + contenu de la section sélectionnée. */
  drawHome() {
    const g = this.g, s = this.section, N = this.sections.length;
    this.ensureVisible();

    // --- vignettes (grossissement animé, défilement fluide) ---
    g.font = font(600, 30);
    const xs = [], sizes = [];
    let x = 80;
    for (let i = 0; i < N; i++) {
      const w = this.w[i], sz = 150 + 60 * w;
      const labelGap = Math.max(120, g.measureText(this.sections[i].label).width + 70);
      xs.push(x); sizes.push(sz);
      x += sz + 26 + (labelGap - 26) * w;
    }
    this.scrollTarget = xs[this.offset] - 80;
    if (this.scroll === undefined || Number.isNaN(this.scroll)) this.scroll = this.scrollTarget;
    for (let i = 0; i < N; i++) {
      const t = this.sections[i], w = this.w[i], sz = sizes[i];
      const tx = xs[i] - this.scroll, ty = 180 - 30 * w;
      if (tx > W || tx + sz < 0) continue;
      const hov = this.isHover('tile', i);
      // vignette inactive
      g.globalAlpha = 1 - w;
      g.fillStyle = `rgba(8,16,40,${hov ? .38 : .5})`; rr(g, tx, ty, sz, sz, 22); g.fill();
      g.strokeStyle = `rgba(255,255,255,${hov ? .5 : .16})`; g.lineWidth = 2; g.stroke();
      // vignette active (dégradé de la section)
      if (w > 0.01) {
        g.globalAlpha = w;
        g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 40; g.shadowOffsetY = 14;
        const tg = g.createLinearGradient(tx, ty, tx + sz, ty + sz);
        tg.addColorStop(0, t.couleurs[0]); tg.addColorStop(1, t.couleurs[1]);
        g.fillStyle = tg; rr(g, tx, ty, sz, sz, 22); g.fill(); g.restore();
        g.strokeStyle = this.focus === 'tiles' ? '#fff' : 'rgba(255,255,255,.45)';
        g.lineWidth = this.focus === 'tiles' ? 6 : 3;
        rr(g, tx - 7, ty - 7, sz + 14, sz + 14, 28); g.stroke();
        g.fillStyle = '#fff'; g.font = font(600, 30);
        g.fillText(t.label, tx + sz + 30, ty + sz / 2 + 2);
      }
      g.globalAlpha = 1;
      drawIcon(g, t.icone, tx + sz / 2, ty + sz / 2, 2.6 + 1.0 * w, 1.6, '#fff');
      this.regions.push({ kind: 'tile', index: i, x: tx, y: ty, w: sz, h: sz });
    }
    const end = Math.min(N, this.offset + this.maxVisible);
    if (this.offset > 0) this.drawChevron(44, 255, '‹', 'prev');
    if (end < N) this.drawChevron(1876, 255, '›', 'next');

    // --- contenu (fondu + léger glissement) ---
    g.save();
    g.globalAlpha = this.fade;
    g.translate(0, (1 - this.fade) * 26);

    g.fillStyle = '#fff'; g.font = font(800, fitFont(g, s.titre, 800, 96, 1760));
    g.fillText(s.titre, 80, 462);
    g.fillStyle = '#d7e3ff'; g.font = font(400, 36);
    g.fillText(ellipsize(g, s.sousTitre, 1760), 82, 530);

    const n = s.elements.length;
    const top = 580, bottom = s.bouton ? 900 : 1000, gapY = 12;
    const rowH = n ? Math.max(44, Math.min(68, (bottom - top) / n - gapY)) : 0;
    const fs = rowH >= 60 ? 30 : rowH >= 52 ? 27 : 24;
    s.elements.forEach((el, i) => {
      const y = top + i * (rowH + gapY);
      const focused = this.focus === 'list' && this.item === i;
      const hov = this.isHover('item', i);
      const actionable = hasPage(el) || !!elementLink(el);
      if (focused) {
        g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 24; g.shadowOffsetY = 8;
        g.fillStyle = '#eef2fd'; rr(g, 80, y, 880, rowH, 14); g.fill(); g.restore();
      } else {
        g.fillStyle = `rgba(10,20,50,${hov && actionable ? .45 : .36})`; rr(g, 80, y, 880, rowH, 14); g.fill();
        g.strokeStyle = `rgba(255,255,255,${hov && actionable ? .3 : .09})`; g.lineWidth = 1.5; g.stroke();
      }
      g.fillStyle = focused ? '#0b1630' : '#f2f5ff'; g.font = font(focused ? 600 : 500, fs);
      g.fillText(ellipsize(g, el.texte, actionable ? 760 : 820), 110, y + rowH / 2 + 1);
      if (actionable) {
        g.fillStyle = focused ? '#0b1630' : 'rgba(255,255,255,.55)'; g.font = font(600, fs); g.textAlign = 'right';
        g.fillText(hasPage(el) ? '›' : '↗', 935, y + rowH / 2); g.textAlign = 'left';
      }
      this.regions.push({ kind: 'item', index: i, x: 80, y, w: 880, h: rowH });
    });

    if (s.bouton) {
      const by = Math.min(n ? top + n * (rowH + gapY) + 14 : top + 10, 924);
      g.font = font(700, 30);
      const bw = Math.max(320, g.measureText(s.bouton.texte).width + 100);
      const focused = this.focus === 'button', hov = this.isHover('button', 0);
      g.fillStyle = hov && !focused ? '#d5def6' : '#e8edfb'; rr(g, 80, by, bw, 76, 38); g.fill();
      if (focused) { g.strokeStyle = '#fff'; g.lineWidth = 4; rr(g, 73, by - 7, bw + 14, 90, 45); g.stroke(); }
      g.fillStyle = '#07122b'; g.textAlign = 'center'; g.fillText(s.bouton.texte, 80 + bw / 2, by + 39); g.textAlign = 'left';
      this.regions.push({ kind: 'button', index: 0, x: 80, y: by, w: bw, h: 76 });
    }

    // --- panneau de droite : aperçu de l'élément ou visuel de la section ---
    const el = this.focus === 'list' ? s.elements[this.item] : null;
    const px = 1040, py = 440, pw = 800, ph = 540;
    const ag = g.createLinearGradient(px, py, px + pw, py + ph);
    ag.addColorStop(0, s.couleurs[0]); ag.addColorStop(1, s.couleurs[1]);
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 50; g.shadowOffsetY = 20;
    g.fillStyle = ag; rr(g, px, py, pw, ph, 30); g.fill(); g.restore();
    // reflet en haut du panneau
    const sh = g.createLinearGradient(px, py, px, py + ph * 0.6);
    sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; rr(g, px, py, pw, ph, 30); g.fill();
    if (el && (el.detail || el.page)) {
      g.fillStyle = 'rgba(6,12,30,.55)'; rr(g, px, py, pw, ph, 30); g.fill();
      drawIcon(g, s.icone, px + 70, py + 70, 1.6, 2, 'rgba(255,255,255,.85)');
      g.fillStyle = '#fff'; g.font = font(700, 38);
      const tl = wrap(g, el.texte, pw - 110).slice(0, 2);
      tl.forEach((l, k) => g.fillText(l, px + 55, py + 140 + k * 48));
      g.fillStyle = '#e4ebff'; g.font = font(400, 30);
      const dy = py + 150 + tl.length * 48;
      const preview = el.detail || pageParagraphs(el)[0] || '';
      const maxLines = Math.floor((py + ph - 90 - dy) / 42);
      clampLines(wrap(g, preview, pw - 110), maxLines).forEach((l, k) => g.fillText(l, px + 55, dy + k * 42));
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = font(600, 24);
      g.fillText(hasPage(el) ? '✕  Ouvrir la fiche' : '', px + 55, py + ph - 45);
    } else {
      drawIcon(g, s.icone, px + pw / 2, py + ph / 2 - 10, 11, 1.1, 'rgba(255,255,255,.92)');
    }
    g.restore();

    this.drawFooter('✕ Ouvrir     ○ Retour     ← → Sections     ↑ ↓ Contenu');
  }

  drawChevron(cx, cy, ch, kind) {
    const g = this.g, hov = this.isHover(kind, 0);
    g.fillStyle = hov ? 'rgba(255,255,255,.4)' : 'rgba(10,20,50,.6)';
    g.beginPath(); g.arc(cx, cy, 26, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#fff'; g.font = font(700, 40); g.textAlign = 'center'; g.fillText(ch, cx, cy - 3); g.textAlign = 'left';
    this.regions.push({ kind, index: 0, x: cx - 30, y: cy - 30, w: 60, h: 60 });
  }

  /** Sous-page : texte long, image, lien externe. */
  drawDetail() {
    const g = this.g, d = this.detail, el = d.el, s = d.section;
    g.save();
    g.globalAlpha = this.fade;
    g.translate(0, (1 - this.fade) * 26);
    // voile pour la lisibilité
    g.fillStyle = 'rgba(4,10,28,.35)'; g.fillRect(0, 120, W, H - 120);
    // fil d'Ariane
    g.font = font(600, 26);
    const bw = g.measureText(s.label).width + 90;
    const pg = g.createLinearGradient(80, 140, 80 + bw, 190);
    pg.addColorStop(0, s.couleurs[0]); pg.addColorStop(1, s.couleurs[1]);
    g.fillStyle = pg; rr(g, 80, 140, bw, 52, 26); g.fill();
    drawIcon(g, s.icone, 112, 166, 1.05, 2.2, '#fff');
    g.fillStyle = '#fff'; g.fillText(s.label, 140, 167);

    // titre
    const title = (el.page && el.page.titre) || el.texte;
    g.font = font(800, 60);
    const tl = clampLines(wrap(g, title, 1760), 2);
    tl.forEach((l, k) => g.fillText(l, 80, 262 + k * 72));
    const bodyTop = 262 + tl.length * 72 + 10;

    // image (optionnelle)
    const img = el.page && el.page.image ? this.getImage(el.page.image) : null;
    const hasImg = img && img.ok;
    const bodyW = hasImg ? 900 : 1500;
    const bodyBottom = 900;
    if (hasImg) {
      const ix = 1060, iy = bodyTop + 10, iw = 780, ih = bodyBottom - iy;
      g.save(); rr(g, ix, iy, iw, ih, 24); g.clip();
      const k = Math.max(iw / img.el.width, ih / img.el.height);
      const dw = img.el.width * k, dh = img.el.height * k;
      g.drawImage(img.el, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
      g.restore();
    }

    // corps (défilant)
    const blocks = [];
    if (el.page && el.page.titre && el.texte !== el.page.titre) blocks.push({ f: font(600, 34), c: '#ffffff', t: el.texte, lh: 46 });
    if (el.detail) blocks.push({ f: font(400, 34), c: '#d7e3ff', t: el.detail, lh: 48 });
    pageParagraphs(el).forEach(p => blocks.push({ f: font(400, 30), c: '#eef2ff', t: p, lh: 44 }));
    const lines = [];
    blocks.forEach((b, bi) => {
      g.font = b.f;
      wrap(g, b.t, bodyW).forEach(l => lines.push({ ...b, t: l }));
      if (bi < blocks.length - 1) lines.push({ spacer: 22 });
    });
    const total = lines.reduce((h, l) => h + (l.spacer || l.lh), 0);
    const viewH = bodyBottom - bodyTop;
    d.maxScroll = Math.max(0, total - viewH);
    d.scroll = Math.min(Math.max(0, d.scroll), d.maxScroll);
    g.save(); g.beginPath(); g.rect(70, bodyTop, bodyW + 40, viewH); g.clip();
    let y = bodyTop + 26 - d.scroll;
    for (const l of lines) {
      if (l.spacer) { y += l.spacer; continue; }
      g.font = l.f; g.fillStyle = l.c; g.fillText(l.t, 80, y); y += l.lh;
    }
    g.restore();
    if (d.maxScroll > 0) { // barre de défilement
      const bx = 80 + bodyW + 30, th = viewH * viewH / total;
      g.fillStyle = 'rgba(255,255,255,.15)'; rr(g, bx, bodyTop, 6, viewH, 3); g.fill();
      g.fillStyle = '#fff'; rr(g, bx, bodyTop + (viewH - th) * d.scroll / d.maxScroll, 6, th, 3); g.fill();
    }

    // boutons
    const link = elementLink(el);
    d.buttons = [];
    if (link) d.buttons.push({ kind: 'dlink', label: link.texte + '  ↗', url: link.url });
    d.buttons.push({ kind: 'dback', label: '←  Retour' });
    let bx = 80;
    d.buttons.forEach((b, i) => {
      g.font = font(700, 30);
      const w = Math.max(260, g.measureText(b.label).width + 90), by = 940;
      const focused = d.btn === i, hov = this.isHover(b.kind, 0);
      const primary = b.kind === 'dlink';
      g.fillStyle = primary ? (hov ? '#d5def6' : '#e8edfb') : `rgba(255,255,255,${hov ? .26 : .14})`;
      rr(g, bx, by, w, 72, 36); g.fill();
      if (focused) { g.strokeStyle = '#fff'; g.lineWidth = 4; rr(g, bx - 7, by - 7, w + 14, 86, 43); g.stroke(); }
      g.fillStyle = primary ? '#07122b' : '#fff'; g.textAlign = 'center'; g.fillText(b.label, bx + w / 2, by + 37); g.textAlign = 'left';
      this.regions.push({ kind: b.kind, index: 0, x: bx, y: by, w, h: 72 });
      bx += w + 28;
    });
    g.restore();
    this.drawFooter((d.maxScroll > 0 ? '↑ ↓ Défiler     ' : '') + '✕ Valider     ○ Retour');
  }

  getImage(src) {
    if (!this.images.has(src)) {
      const rec = { el: new Image(), ok: false };
      rec.el.onload = () => { rec.ok = true; this.dirty = true; };
      rec.el.onerror = () => console.warn('[menu] image introuvable :', src);
      rec.el.src = src;
      this.images.set(src, rec);
    }
    return this.images.get(src);
  }

  // ------------------------------------------------------------------
  //  Navigation clavier — retourne 'exit' pour quitter la télé
  // ------------------------------------------------------------------
  handleKey(key) {
    if (!this.sections.length) return key === 'Escape' || key === 'Backspace' ? 'exit' : false;
    if (this.detail) return this.keyDetail(key);
    const s = this.section, n = s.elements.length, hasBtn = !!s.bouton;
    switch (key) {
      case 'ArrowRight': this.moveSection(1); return true;
      case 'ArrowLeft': this.moveSection(-1); return true;
      case 'ArrowDown':
        if (this.focus === 'tiles') { if (n) this.setFocus('list', 0); else if (hasBtn) this.setFocus('button'); }
        else if (this.focus === 'list') { if (this.item < n - 1) this.setFocus('list', this.item + 1); else if (hasBtn) this.setFocus('button'); else this.onSound('limit'); }
        else this.onSound('limit');
        return true;
      case 'ArrowUp':
        if (this.focus === 'button') { if (n) this.setFocus('list', n - 1); else this.setFocus('tiles'); }
        else if (this.focus === 'list') { if (this.item > 0) this.setFocus('list', this.item - 1); else this.setFocus('tiles'); }
        else this.onSound('limit');
        return true;
      case 'Enter': case ' ':
        if (this.focus === 'tiles') return this.handleKey('ArrowDown');
        if (this.focus === 'list') this.activateItem(this.item);
        else if (this.focus === 'button') this.activateButton();
        return true;
      case 'Home': this.select(0); return true;
      case 'End': this.select(this.sections.length - 1); return true;
      case 'Escape': case 'Backspace':
        if (this.focus !== 'tiles') { this.setFocus('tiles'); this.onSound('back'); return true; }
        return 'exit';
    }
    return false;
  }

  keyDetail(key) {
    const d = this.detail;
    switch (key) {
      case 'ArrowDown': if (d.scroll < d.maxScroll) { d.scroll += 90; this.dirty = true; this.onSound('focus'); } else this.onSound('limit'); return true;
      case 'ArrowUp': if (d.scroll > 0) { d.scroll -= 90; this.dirty = true; this.onSound('focus'); } else this.onSound('limit'); return true;
      case 'ArrowLeft': if (d.btn > 0) { d.btn--; this.dirty = true; this.onSound('move'); this.announceDetailButton(); } else this.onSound('limit'); return true;
      case 'ArrowRight': if (d.btn < d.buttons.length - 1) { d.btn++; this.dirty = true; this.onSound('move'); this.announceDetailButton(); } else this.onSound('limit'); return true;
      case 'Enter': case ' ': this.activateDetailButton(d.buttons[d.btn]); return true;
      case 'Escape': case 'Backspace': this.closeDetail(); return true;
    }
    return false;
  }

  // ------------------------------------------------------------------
  //  Souris / tactile (coordonnées UV de l'écran)
  // ------------------------------------------------------------------
  regionAt(uv) {
    const x = uv.x * W, y = (1 - uv.y) * H;
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  }

  /** Survol : retourne true si la zone est cliquable. */
  hoverAt(uv) {
    const r = uv ? this.regionAt(uv) : null;
    const key = r ? r.kind + ':' + r.index : null;
    if (key !== this.hover) { this.hover = key; this.dirty = true; }
    if (!r) return false;
    if (r.kind === 'item') { const el = this.section.elements[r.index]; return hasPage(el) || !!elementLink(el); }
    return true;
  }

  clickAt(uv) {
    const r = this.regionAt(uv);
    if (!r) return;
    switch (r.kind) {
      case 'tile': if (r.index === this.sel) this.handleKey('ArrowDown'); else this.select(r.index); break;
      case 'prev': this.moveSection(-1); break;
      case 'next': this.moveSection(1); break;
      case 'item': this.setFocus('list', r.index, true); this.activateItem(r.index); break;
      case 'button': this.setFocus('button', this.item, true); this.activateButton(); break;
      case 'dlink': case 'dback': this.activateDetailButton(this.detail.buttons.find(b => b.kind === r.kind)); break;
    }
  }

  wheel(dy) {
    if (!this.detail) return;
    this.detail.scroll += dy; this.dirty = true;
  }

  // ------------------------------------------------------------------
  //  Actions
  // ------------------------------------------------------------------
  select(i) {
    const prev = this.sel;
    this.sel = (i + this.sections.length) % this.sections.length;
    this.focus = 'tiles'; this.item = 0;
    if (prev !== this.sel) { this.fade = 0; this.onSound('move'); this.setSectionColors(); }
    this.dirty = true;
    const s = this.section, n = s.elements.length;
    this.onAnnounce(`${s.label} (${this.sel + 1} sur ${this.sections.length}). ${s.titre}. ${s.sousTitre}. ${n} élément${n > 1 ? 's' : ''}. Flèche bas pour lire.`);
  }

  moveSection(d) { this.select(this.sel + d); }

  goToSection(id) {
    const i = this.sections.findIndex(s => s.id === id);
    if (i >= 0) { this.select(i); this.onSound('open'); }
  }

  setFocus(focus, item = this.item, silent = false) {
    this.focus = focus; this.item = item;
    this.dirty = true;
    if (!silent) this.onSound('focus');
    const s = this.section;
    if (focus === 'list') {
      const el = s.elements[item];
      this.onAnnounce(`${el.texte}. ${el.detail || ''} ${hasPage(el) ? 'Entrée pour ouvrir la fiche.' : elementLink(el) ? 'Entrée pour ouvrir le lien.' : ''}`);
    } else if (focus === 'button') this.onAnnounce(`Bouton : ${s.bouton.texte}`);
    else this.onAnnounce(`Section ${s.label}`);
  }

  activateItem(i) {
    const el = this.section.elements[i];
    if (!el) return;
    if (hasPage(el)) this.openDetail(el);
    else { const l = elementLink(el); if (l) { this.onSound('open'); this.onAction({ type: 'url', url: l.url }); } else this.onSound('limit'); }
  }

  activateButton() {
    const b = this.section.bouton;
    if (!b) return;
    if (b.action === 'section') this.goToSection(b.cible);
    else { this.onSound('open'); this.onAction({ type: 'bouton', bouton: b }); }
  }

  openDetail(el) {
    this.detail = { el, section: this.section, scroll: 0, maxScroll: 0, btn: 0, buttons: [] };
    this.hover = null; this.fade = 0; this.dirty = true;
    this.onSound('open');
    const paras = pageParagraphs(el).join(' ');
    this.onAnnounce(`Fiche : ${(el.page && el.page.titre) || el.texte}. ${el.detail || ''} ${paras} Échap pour revenir.`);
  }

  closeDetail() {
    this.detail = null; this.hover = null; this.fade = 0; this.dirty = true;
    this.onSound('back');
    this.onAnnounce('Retour à la section ' + this.section.label);
  }

  activateDetailButton(b) {
    if (!b) return;
    if (b.kind === 'dlink') { this.onSound('open'); this.onAction({ type: 'url', url: b.url }); }
    else this.closeDetail();
  }

  announceDetailButton() {
    const b = this.detail.buttons[this.detail.btn];
    if (b) this.onAnnounce('Bouton : ' + b.label.replace(/[↗←]/g, '').trim());
  }

  /** Garde la vignette sélectionnée dans la fenêtre visible. */
  ensureVisible() {
    const N = this.sections.length, k = this.maxVisible;
    if (N <= k) { this.offset = 0; return; }
    if (this.sel < this.offset) this.offset = this.sel;
    if (this.sel >= this.offset + k) this.offset = this.sel - k + 1;
    this.offset = Math.max(0, Math.min(this.offset, N - k));
  }

  isHover(kind, index) { return this.hover === kind + ':' + index; }
}

// ---------------------------------------------------------------------
//  Matériau de l'écran : fond animé (shader) + interface (canvas)
// ---------------------------------------------------------------------
function createScreenMaterial(uiTexture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uUI: { value: uiTexture },
      uTime: { value: 0 },
      uColA: { value: new THREE.Color('#3d8bff') },
      uColB: { value: new THREE.Color('#7c5cff') },
      uBg0: { value: new THREE.Color('#061027') },
      uBg1: { value: new THREE.Color('#0f3170') },
      uBg2: { value: new THREE.Color('#0a1d45') },
      uBoost: { value: 1.12 },
      uHover: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uUI; uniform float uTime, uBoost, uHover;
      uniform vec3 uColA, uColB, uBg0, uBg1, uBg2;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        vec2 uv = vUv, p = vec2(uv.x * 1.778, uv.y);
        float t = uTime;
        // dégradé de fond (comme le prototype)
        float g = clamp(uv.x * 0.76 + (1.0 - uv.y) * 0.24, 0.0, 1.0);
        vec3 col = g < 0.55 ? mix(uBg0, uBg1, g / 0.55) : mix(uBg1, uBg2, (g - 0.55) / 0.45);
        // nappes de couleur lentes
        float n = noise(p * 1.4 + vec2(t * 0.045, -t * 0.03)) * 0.6 + noise(p * 2.9 - vec2(t * 0.035, t * 0.02)) * 0.4;
        col += uColA * 0.09 * smoothstep(0.35, 0.95, n);
        // halo en haut à droite
        vec2 q = (uv - vec2(0.78, 0.86)) * vec2(1.778, 1.0);
        col += uColA * 0.28 * exp(-dot(q, q) * 2.6);
        // rubans de lumière ondulants
        for (int i = 0; i < 4; i++) {
          float fi = float(i);
          float yy = 0.24 + 0.06 * fi + 0.055 * sin(p.x * 1.6 + t * (0.19 + 0.05 * fi) + fi * 1.9) + 0.02 * sin(p.x * 4.1 - t * 0.31 + fi * 2.7);
          float d = uv.y - yy;
          float along = 0.5 + 0.5 * sin(p.x * 2.0 - t * 0.45 + fi * 1.3);
          vec3 c = mix(uColA, uColB, 0.5 + 0.5 * sin(fi * 1.7 + p.x * 0.8));
          col += c * (exp(-d * d * 7000.0) * 0.20 + exp(-d * d * 200.0) * 0.035) * along;
        }
        // scintillements
        vec2 gp = uv * vec2(178.0, 100.0); vec2 id = floor(gp); float h = hash(id);
        float tw = step(0.993, h) * pow(0.5 + 0.5 * sin(t * (0.8 + h * 2.0) + h * 80.0), 6.0);
        col += vec3(0.6, 0.75, 1.0) * tw * smoothstep(0.35, 0.0, length(fract(gp) - 0.5)) * 0.45;
        // interface dessinée sur le canvas
        vec4 ui = texture2D(uUI, vUv);
        col = mix(col, ui.rgb, ui.a);
        col *= uBoost * (1.0 + 0.12 * uHover);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------------------------------------------------------------
//  Utilitaires de dessin
// ---------------------------------------------------------------------
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

function drawIcon(g, name, cx, cy, scale, lw, color) {
  g.save();
  g.translate(cx - 12 * scale, cy - 12 * scale); g.scale(scale, scale);
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  g.stroke(new Path2D(iconPath(name)));
  g.restore();
}

function wrap(g, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (line && g.measureText(test).width > maxW) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function clampLines(lines, max) {
  if (lines.length <= max) return lines;
  const out = lines.slice(0, Math.max(1, max));
  out[out.length - 1] = out[out.length - 1].replace(/\s*\S*$/, '') + ' …';
  return out;
}

function ellipsize(g, text, maxW) {
  text = String(text || '');
  if (g.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (g.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; }
  return text.slice(0, lo).trimEnd() + '…';
}

function fitFont(g, text, weight, size, maxW) {
  let s = size;
  g.font = font(weight, s);
  while (s > 48 && g.measureText(text).width > maxW) { s -= 4; g.font = font(weight, s); }
  return s;
}

function initials(name) {
  return String(name || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
