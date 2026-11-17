// =====================================================================
//  sound.js — Sons d'interface "façon console", synthétisés en direct
//  (aucun fichier audio à télécharger). Le choix son activé / coupé est
//  mémorisé dans le navigateur du visiteur.
// =====================================================================
const KEY = 'portfolio-son';

export class UISound {
  constructor(defaultOn = true) {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* stockage indisponible */ }
    this.enabled = saved === null ? defaultOn : saved === '1';
    this.ctx = null;
  }

  /** Les navigateurs n'autorisent le son qu'après une action du visiteur. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
        this.reverb = this.ctx.createConvolver(); this.reverb.buffer = this.impulse(1.8, 3);
        const wet = this.ctx.createGain(); wet.gain.value = 0.3;
        this.reverb.connect(wet); wet.connect(this.master);
      } catch { this.ctx = null; return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* ignoré */ }
    if (on) this.unlock();
  }

  impulse(sec, decay) {
    const rate = this.ctx.sampleRate, n = Math.floor(rate * sec), buf = this.ctx.createBuffer(2, n, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
    }
    return buf;
  }

  tone(freq, { type = 'sine', dur = 0.12, gain = 0.06, delay = 0, attack = 0.004, glide = 0, wet = true } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    if (wet) g.connect(this.reverb);
    o.start(t); o.stop(t + dur + 0.05);
  }

  whoosh({ dur = 1, gain = 0.04, from = 300, to = 2500, delay = 0 } = {}) {
    const c = this.ctx, t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + dur * 0.45); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); g.connect(this.reverb);
    src.start(t); src.stop(t + dur);
  }

  play(name) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'move':   // déplacement entre vignettes
        this.tone(1318.5, { dur: 0.09, gain: 0.05 }); this.tone(2637, { dur: 0.05, gain: 0.01 }); break;
      case 'focus':  // déplacement vertical
        this.tone(987.8, { dur: 0.08, gain: 0.04 }); break;
      case 'open':   // validation
        this.tone(1046.5, { dur: 0.25, gain: 0.055 }); this.tone(1568, { dur: 0.4, gain: 0.045, delay: 0.06 }); break;
      case 'back':
        this.tone(1174.7, { dur: 0.12, gain: 0.04 }); this.tone(880, { dur: 0.2, gain: 0.035, delay: 0.05 }); break;
      case 'limit':  // bout de liste
        this.tone(196, { type: 'triangle', dur: 0.07, gain: 0.05, wet: false }); break;
      case 'enter':  // zoom vers la télé
        this.whoosh({ dur: 1.2, gain: 0.03, from: 220, to: 2800 });
        [523.25, 659.25, 783.99, 987.77].forEach((f, i) => this.tone(f, { dur: 1.6, gain: 0.018, attack: 0.25, delay: 0.75 + i * 0.07 }));
        break;
      case 'leave':
        this.whoosh({ dur: 1.1, gain: 0.028, from: 2600, to: 220 }); break;
    }
  }
}
