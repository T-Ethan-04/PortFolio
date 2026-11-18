// =====================================================================
//  lecteur.js — La platine des enceintes : plusieurs sources de musique
//  (titres officiels sur YouTube ou Spotify, ambiances lo-fi composées
//  en direct) derrière un seul lecteur, et le panneau qui la pilote.
// =====================================================================

export class Platine {
  /** @param sources  lecteurs ayant tous la même interface (lecture, pause, choisir, niveau…) ; le premier est actif. */
  constructor(sources) {
    this.sources = sources;
    this.active = sources[0];
    this.ecouteurs = [];
    for (const s of sources) s.onChange(() => { if (s === this.active) this.signaler(); });
  }

  get joue() { return this.active.joue; }
  get volume() { return this.active.volume; }

  etat() {
    const a = this.active;
    return { ...a.etat(), source: a.id, liste: a.liste, volumeReglable: a.volumeReglable !== false };
  }
  onChange(cb) { this.ecouteurs.push(cb); cb(this.etat()); }
  signaler() { const e = this.etat(); this.ecouteurs.forEach(cb => cb(e)); }

  /** Change de source ; si la musique tournait, la nouvelle source enchaîne. */
  choisirSource(id) {
    const s = this.sources.find(x => x.id === id);
    if (!s || s === this.active) return;
    const reprendre = this.active.joue;
    this.active.pause();
    this.active = s;
    if (reprendre) s.lecture();
    this.signaler();
  }

  lecture() { this.active.lecture(); }
  pause() { this.active.pause(); }
  basculer() { this.active.basculer(); }
  suivant() { this.active.suivant(); }
  precedent() { this.active.precedent(); }
  /** Lance le morceau n° i de la source active. */
  choisir(i) { this.active.choisir(i, true); }

  setVolume(v) { this.sources.forEach(s => s.setVolume(v)); }
  setAttenuation(on) { this.sources.forEach(s => s.setAttenuation(on)); }
  setMuet(m) { this.sources.forEach(s => s.setMuet(m)); }
  /** Niveau (0 à 1) pour faire pulser la LED des enceintes. */
  niveau() { return this.active.niveau(); }
}

const NOTE_SPOTIFY = 'Sans compte Spotify connecté dans le navigateur, Spotify ne joue qu’un extrait de 30 s.';

/** Relie le panneau du lecteur (HTML de index.html) à la platine. */
export function brancherLecteur(platine, $) {
  const boite = $('lecteur'), bouton = $('musBtn');
  const titre = $('musTitre'), artiste = $('musArtiste'), play = $('musPlay'), vol = $('musVolume');
  const ecran = $('musEcran'), attente = $('musAttente'), note = $('musNote'), liste = $('musPistes');
  const onglets = [...boite.querySelectorAll('[data-source]')];
  for (const s of platine.sources) if (s.monter) s.monter($(`ecran-${s.id}`));
  vol.value = String(platine.volume);

  let cleListe = '';
  platine.onChange(e => {
    titre.textContent = e.titre; artiste.textContent = e.artiste;
    play.classList.toggle('on', e.joue);
    play.setAttribute('aria-label', e.joue ? 'Mettre en pause' : 'Lancer la musique');
    bouton.classList.toggle('on', e.joue);
    bouton.setAttribute('aria-pressed', String(e.joue));
    bouton.title = e.joue ? 'Mettre la musique en pause' : 'Lancer la musique';

    // source active : onglet, écran du lecteur officiel, réglage du volume
    const clip = e.source !== 'ambiances';
    boite.dataset.source = e.source;
    boite.classList.toggle('clip', clip);
    for (const o of onglets) o.setAttribute('aria-pressed', String(o.dataset.source === e.source));
    ecran.hidden = !clip;
    ecran.dataset.source = e.source;
    attente.hidden = !clip || (e.pret && !e.chargement) || !!e.erreur;
    attente.textContent = e.chargement ? 'Chargement du lecteur officiel…' : 'Appuie sur ▶ pour lancer le titre';
    vol.hidden = !e.volumeReglable;

    // message : erreur (avec lien vers le titre) ou rappel sur les extraits Spotify
    if (e.erreur) {
      const a = document.createElement('a');
      a.href = e.lien; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Ouvrir ↗';
      note.replaceChildren(e.erreur + ' ', a);
    } else note.textContent = e.source === 'mj-spotify' ? NOTE_SPOTIFY : '';
    note.hidden = !note.textContent;

    // liste des morceaux (reconstruite seulement si elle change)
    const cle = e.source + '|' + e.liste.map(p => `${p.titre}${p.indisponible ? '×' : ''}`).join('|');
    if (cle !== cleListe) {
      cleListe = cle;
      liste.replaceChildren(...e.liste.map((p, i) => {
        const li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.dataset.i = String(i);
        b.classList.toggle('indispo', !!p.indisponible);
        if (p.indisponible) b.title = 'Lecture intégrée impossible pour ce titre';
        const n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1);
        const t = document.createElement('span'); t.className = 't'; t.textContent = p.titre;
        const x = document.createElement('span'); x.className = 'x'; x.textContent = p.info || '';
        b.append(n, t, x); li.append(b);
        return li;
      }));
    }
    [...liste.querySelectorAll('button')].forEach((b, i) => b.setAttribute('aria-current', String(i === e.index)));
  });

  const montrer = () => { boite.hidden = false; };
  play.addEventListener('click', () => platine.basculer());
  $('musPrev').addEventListener('click', () => platine.precedent());
  $('musNext').addEventListener('click', () => platine.suivant());
  $('musFermer').addEventListener('click', () => { platine.pause(); boite.hidden = true; });
  vol.addEventListener('input', () => platine.setVolume(+vol.value));
  for (const o of onglets) o.addEventListener('click', () => platine.choisirSource(o.dataset.source));
  liste.addEventListener('click', ev => {
    const b = ev.target.closest('button[data-i]');
    if (b) platine.choisir(+b.dataset.i);
  });
  bouton.addEventListener('click', () => { platine.basculer(); montrer(); });
  return { montrer };
}
