// =====================================================================
//  clips.js — Les titres de Michael Jackson dans les enceintes du salon.
//
//  Aucun fichier audio n'est hébergé sur le site : le panneau du lecteur
//  intègre les lecteurs officiels.
//    • YouTube : les clips officiels. La vidéo reste visible dans le
//      panneau pendant la lecture (règle de YouTube pour les lecteurs
//      intégrés, minimum 200 × 200 px).
//    • Spotify : les titres du catalogue. Sans compte Spotify connecté
//      dans le navigateur, Spotify ne joue qu'un extrait de 30 secondes.
//  Rien n'est chargé depuis YouTube ou Spotify tant que le visiteur ne
//  lance pas un de ces lecteurs.
//
//  Changer de morceaux : modifier PISTES_MJ ci-dessous.
//    youtube = ce qui suit « watch?v= » dans l'adresse de la vidéo
//    spotify = ce qui suit « open.spotify.com/track/ » dans l'adresse du titre
//    bpm     = tempo du morceau (la LED des enceintes bat à ce rythme)
// =====================================================================

export const PISTES_MJ = [
  { titre: 'You Rock My World', annee: 2001, bpm: 95,  youtube: '1-7ABIM2qjU', spotify: '3T59S3Vh3DOatsmTD8clqP' },
  { titre: 'Billie Jean',       annee: 1982, bpm: 117, youtube: 'Zi_XLOBDo_Y', spotify: '5ChkMS8OtdzJeqyybCc9R5' },
  { titre: 'Beat It',           annee: 1982, bpm: 139, youtube: 'oRdxUFDoQe0', spotify: '3BovdzfaX4jb5KFQwoPfAw' },
  { titre: 'Smooth Criminal',   annee: 1987, bpm: 118, youtube: 'h_D3VFfhvs4', spotify: '2bCQHF9gdG5BNDVuEIEnNk' },
];

const ARTISTE = 'Michael Jackson';
const clamp01 = x => Math.min(1, Math.max(0, x));

// ---------------------------------------------------------------------
//  Chargement (une seule fois) du script d'une API de lecteur
// ---------------------------------------------------------------------
const scripts = new Map();
function chargerApi({ url, rappel, deja, resultat }) {
  const present = deja();
  if (present) return Promise.resolve(present);
  if (!scripts.has(url)) {
    scripts.set(url, new Promise((ok, ko) => {
      const echec = raison => { scripts.delete(url); ko(new Error(raison)); };
      const delai = setTimeout(() => echec('délai dépassé'), 15000);
      const avant = window[rappel];
      window[rappel] = (...args) => {
        clearTimeout(delai);
        if (typeof avant === 'function') avant(...args);
        ok(resultat(...args));
      };
      const s = document.createElement('script');
      s.src = url; s.async = true;
      s.onerror = () => { clearTimeout(delai); s.remove(); echec('script injoignable'); };
      document.head.appendChild(s);
    }));
  }
  return scripts.get(url);
}

// ---------------------------------------------------------------------
//  Base commune aux deux lecteurs officiels
// ---------------------------------------------------------------------
class SourceClips {
  constructor(id, nom, pistes, volume) {
    this.id = id; this.nom = nom; this.pistes = pistes;
    this.volume = clamp01(volume ?? 0.6);
    this.volumeReglable = true;
    this.index = 0;
    this.joue = false;         // le visiteur veut entendre le morceau (lecture, chargement, mise en mémoire tampon)
    this.enLecture = false;    // le son sort vraiment (sert à la LED)
    this.attenue = false; this.muet = false;
    this.pret = false; this.chargement = false; this.erreur = '';
    this.indisponibles = new Set();
    this.ecouteurs = []; this.depart = 0; this.niveauLisse = 0;
  }

  /** Élément du panneau dans lequel le lecteur officiel s'affiche. */
  monter(hote) { this.hote = hote; }

  get piste() { return this.pistes[this.index]; }
  get liste() {
    return this.pistes.map((p, i) => ({ titre: p.titre, info: String(p.annee), indisponible: this.indisponibles.has(i), lien: this.lien(p) }));
  }

  onChange(cb) { this.ecouteurs.push(cb); cb(this.etat()); }
  etat() {
    const p = this.piste;
    return {
      joue: this.joue, titre: p.titre, artiste: `${ARTISTE} · ${p.annee}`, index: this.index, total: this.pistes.length,
      pret: this.pret, chargement: this.chargement, erreur: this.erreur,
      lien: this.erreur && this.lienErreur ? this.lienErreur : this.lien(p),   // le lien du message pointe sur le titre concerné
    };
  }
  signaler() { const e = this.etat(); this.ecouteurs.forEach(cb => cb(e)); }

  /** Première piste lisible à partir de « depart » dans le sens « pas » (−1 s'il n'y en a aucune). */
  disponible(depart, pas = 1) {
    const n = this.pistes.length;
    for (let k = 0; k < n; k++) {
      const i = (((depart + pas * k) % n) + n) % n;
      if (!this.indisponibles.has(i)) return i;
    }
    return -1;
  }

  basculer() { this.joue ? this.pause() : this.lecture(); }
  suivant() { this.choisir(this.disponible(this.index + 1, 1)); }
  precedent() { this.choisir(this.disponible(this.index - 1, -1)); }

  setVolume(v) { this.volume = clamp01(v); this.appliquerVolume(); }
  /** Baisse la musique (menu de la télé ouvert). */
  setAttenuation(on) { this.attenue = on; this.appliquerVolume(); }
  setMuet(m) { this.muet = m; this.appliquerVolume(); }
  appliquerVolume() {}

  /** Recale l'horloge du morceau (position de lecture en secondes). */
  caler(secondes) { this.depart = performance.now() - secondes * 1000; }

  /** On n'a pas accès au son d'un lecteur intégré : la LED bat au tempo du morceau. */
  niveau() {
    let cible = 0;
    if (this.enLecture) {
      const temps = (performance.now() - this.depart) / 1000;
      const phase = (temps * (this.piste.bpm || 110) / 60) % 1;
      cible = 0.12 + 0.48 * Math.exp(-phase * 6);
    }
    this.niveauLisse += (cible - this.niveauLisse) * 0.35;
    return this.niveauLisse;
  }
}

// ---------------------------------------------------------------------
//  YouTube (API IFrame officielle)
// ---------------------------------------------------------------------
export class ClipsYouTube extends SourceClips {
  constructor(pistes = PISTES_MJ, volume) { super('mj-youtube', 'YouTube', pistes, volume); }

  lien(p) { return `https://www.youtube.com/watch?v=${p.youtube}`; }

  creer() {
    if (this.creation) return;
    this.chargement = true; this.erreur = '';
    this.creation = chargerApi({
      url: 'https://www.youtube.com/iframe_api', rappel: 'onYouTubeIframeAPIReady',
      deja: () => (window.YT && window.YT.Player ? window.YT : null), resultat: () => window.YT,
    }).then(YT => {
      const cible = document.createElement('div');
      this.hote.replaceChildren(cible);
      this.videoCreee = this.piste.youtube;
      this.player = new YT.Player(cible, {
        width: '100%', height: '100%', videoId: this.videoCreee,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: this.joue ? 1 : 0, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => this.quandPret(),
          onStateChange: e => this.changementEtat(e.data),
          onError: e => this.echec(e.data),
        },
      });
    }).catch(() => {
      this.creation = null; this.chargement = false; this.joue = false;
      this.erreur = 'Impossible de joindre YouTube (connexion ou bloqueur de contenu ?).';
      this.lienErreur = this.lien(this.piste);
      this.signaler();
    });
    this.signaler();
  }

  quandPret() {
    this.pret = true; this.chargement = false;
    this.appliquerVolume();
    if (this.piste.youtube !== this.videoCreee) {          // le visiteur a changé de titre pendant le chargement
      if (this.joue) this.player.loadVideoById(this.piste.youtube); else this.player.cueVideoById(this.piste.youtube);
    } else if (this.joue) this.player.playVideo();
    if (this.joue) this.surveiller();
    this.signaler();
  }

  changementEtat(s) {
    const E = window.YT.PlayerState;
    if (s === E.PLAYING) { this.joue = true; this.enLecture = true; this.caler(this.player.getCurrentTime()); }
    else if (s === E.PAUSED) { this.joue = false; this.enLecture = false; }
    else if (s === E.BUFFERING) { this.enLecture = false; return; }
    else if (s === E.ENDED) { this.enLecture = false; this.choisir(this.disponible(this.index + 1), true); return; }   // enchaîne
    else return;
    this.signaler();
  }

  /**
   * Erreurs du lecteur YouTube :
   *   2 : identifiant invalide · 100 : vidéo introuvable · 101 / 150 : intégration refusée par l'ayant droit
   *   → propres au titre : on le barre et on passe au suivant.
   *   5 : erreur du lecteur · 153 : navigateur qui masque l'adresse du site (référent)
   *   → propres au navigateur du visiteur : on s'arrête avec un message, sans barrer le titre.
   */
  echec(code) {
    clearTimeout(this.garde);
    const titre = this.piste.titre;
    this.lienErreur = this.lien(this.piste);
    this.enLecture = false;
    console.warn(`[musique] YouTube, erreur ${code} pour « ${titre} »`);
    if (![2, 100, 101, 150].includes(code)) {
      this.joue = false;
      this.erreur = `Le lecteur YouTube n’a pas pu démarrer dans ce navigateur (erreur ${code}).`;
      this.signaler();
      return;
    }
    this.indisponibles.add(this.index);
    this.erreur = code === 101 || code === 150 ? `« ${titre} » ne peut être lu que sur YouTube.` : `« ${titre} » est introuvable sur YouTube.`;
    const suite = this.disponible(this.index + 1);
    if (this.joue && suite >= 0) setTimeout(() => { if (this.joue) this.choisir(suite, true, true); }, 2500);   // on enchaîne en gardant le message
    else this.joue = false;
    this.signaler();
  }

  /** Si le navigateur bloque le démarrage, le bouton ▶ revient au lieu de rester sur « pause ». */
  surveiller() {
    clearTimeout(this.garde);
    this.garde = setTimeout(() => {
      if (!this.pret || !this.joue) return;
      const s = this.player.getPlayerState();
      if (s !== window.YT.PlayerState.PLAYING && s !== window.YT.PlayerState.BUFFERING) { this.joue = false; this.signaler(); }
    }, 7000);
  }

  lecture() {
    if (this.indisponibles.has(this.index)) {
      const i = this.disponible(this.index);
      if (i < 0) return;
      this.index = i;
    }
    this.joue = true; this.erreur = '';
    if (this.pret) { this.player.playVideo(); this.surveiller(); } else this.creer();
    this.signaler();
  }

  pause() {
    clearTimeout(this.garde);
    this.joue = false; this.enLecture = false;
    if (this.pret) this.player.pauseVideo();
    this.signaler();
  }

  choisir(i, jouer = this.joue, garderMessage = false) {
    if (i < 0 || i >= this.pistes.length) return;
    this.index = i; this.enLecture = false;
    if (!garderMessage) this.erreur = '';
    this.joue = jouer;
    if (this.pret) {
      if (jouer) { this.player.loadVideoById(this.piste.youtube); this.surveiller(); }
      else this.player.cueVideoById(this.piste.youtube);
    } else if (jouer) this.creer();
    this.signaler();
  }

  appliquerVolume() {
    if (!this.pret) return;
    this.player.setVolume(Math.round(this.volume * (this.attenue ? 0.4 : 1) * 100));
    if (this.muet) this.player.mute(); else this.player.unMute();
  }
}

// ---------------------------------------------------------------------
//  Spotify (API iFrame officielle des intégrations)
// ---------------------------------------------------------------------
let apiSpotify = null;

export class ClipsSpotify extends SourceClips {
  constructor(pistes = PISTES_MJ, volume) {
    super('mj-spotify', 'Spotify', pistes, volume);
    this.volumeReglable = false;          // l'intégration Spotify ne permet pas de régler le volume
  }

  lien(p) { return `https://open.spotify.com/track/${p.spotify}`; }
  uri(p = this.piste) { return `spotify:track:${p.spotify}`; }

  creer() {
    if (this.creation) return;
    this.chargement = true; this.erreur = '';
    this.creation = chargerApi({
      url: 'https://open.spotify.com/embed/iframe-api/v1', rappel: 'onSpotifyIframeApiReady',
      deja: () => apiSpotify, resultat: api => (apiSpotify = api),
    }).then(api => {
      const cible = document.createElement('div');
      this.hote.replaceChildren(cible);
      this.uriCree = this.uri();
      api.createController(cible, { uri: this.uriCree, width: '100%', height: 152 }, ctrl => {
        this.ctrl = ctrl;
        ctrl.addListener('ready', () => this.quandPret());
        ctrl.addListener('playback_update', e => this.miseAJour(e.data));
      });
    }).catch(() => {
      this.creation = null; this.chargement = false; this.joue = false;
      this.erreur = 'Impossible de joindre Spotify (connexion ou bloqueur de contenu ?).';
      this.lienErreur = this.lien(this.piste);
      this.signaler();
    });
    this.signaler();
  }

  quandPret() {
    if (this.pret) { this.lancerSiAttente(); return; }       // « ready » revient après chaque changement de titre
    this.pret = true; this.chargement = false;
    if (this.uri() !== this.uriCree) this.charger(this.joue);
    else if (this.joue) { this.ctrl.play(); this.patienter(); }
    this.signaler();
  }

  /** play() juste après un changement de titre peut être ignoré : on attend « ready » (1,5 s au plus). */
  charger(jouer) {
    this.ctrl.loadUri(this.uri());
    this.enAttente = jouer;
    clearTimeout(this.minuteur);
    if (jouer) this.minuteur = setTimeout(() => this.lancerSiAttente(), 1500);
  }
  lancerSiAttente() {
    if (!this.enAttente) return;
    this.enAttente = false; clearTimeout(this.minuteur);
    this.ctrl.play(); this.patienter();
  }

  /** Laisse au lecteur le temps de démarrer ; s'il ne démarre pas (navigateur qui bloque), le bouton ▶ revient. */
  patienter() {
    this.graceJusqua = performance.now() + 3000;
    clearTimeout(this.garde);
    this.garde = setTimeout(() => {
      if (this.joue && !this.enLecture && (!this.dernier || this.dernier.isPaused)) { this.joue = false; this.signaler(); }
    }, 3300);
  }

  miseAJour(d) {
    if (!d) return;
    const { isPaused, isBuffering, position = 0, duration = 0 } = d;
    const fini = isPaused && duration > 0 && this.dernier && !this.dernier.isPaused && d.playingURI === this.dernier.playingURI
      && (position >= duration - 800 || (position === 0 && this.dernier.position >= duration - 1500));
    this.dernier = d;
    this.enLecture = !isPaused && !isBuffering;
    if (this.enLecture) this.caler(position / 1000);
    if (fini && this.joue) { this.choisir(this.disponible(this.index + 1), true); return; }   // enchaîne
    if (isPaused && (this.enAttente || performance.now() < (this.graceJusqua || 0))) return;   // pas encore démarré
    if (this.joue !== !isPaused) { this.joue = !isPaused; if (this.joue) this.erreur = ''; this.signaler(); }
  }

  lecture() {
    this.joue = true; this.erreur = '';
    if (!this.pret) this.creer();
    else if (!this.enAttente) { this.ctrl.resume(); this.patienter(); }
    this.signaler();
  }

  pause() {
    clearTimeout(this.garde); clearTimeout(this.minuteur);
    this.joue = false; this.enAttente = false; this.enLecture = false;
    if (this.pret) this.ctrl.pause();
    this.signaler();
  }

  choisir(i, jouer = this.joue) {
    if (i < 0 || i >= this.pistes.length) return;
    this.index = i; this.erreur = ''; this.enLecture = false;
    this.joue = jouer;
    if (this.pret) this.charger(jouer);
    else if (jouer) this.creer();
    this.signaler();
  }

  /** Pas de volume ni de sourdine dans l'intégration Spotify : couper le son = mettre en pause. */
  setMuet(m) { this.muet = m; if (m && this.joue) this.pause(); }
}
