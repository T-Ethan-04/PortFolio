// =====================================================================
//  content.js — Lecture et vérification de content.json.
//  Partagé par la version 3D (main.js) et la version simple (simple.html).
//  En cas d'erreur de saisie dans le JSON, un message clair est affiché.
// =====================================================================

const DEFAULT_COLORS = [['#3d8bff', '#7c5cff'], ['#00a3a3', '#3d8bff'], ['#ff7a45', '#ff3d77'], ['#f5b400', '#ff7a45'], ['#2ad49a', '#00a3a3'], ['#7c5cff', '#c04dff']];

/** Charge content.json et complète les champs manquants. */
export async function loadContent(url = 'content.json') {
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    throw new Error("Impossible de lire content.json. Si tu as ouvert le fichier directement depuis ton ordinateur (adresse en file://), lance un petit serveur local ou publie le site : voir le README.");
  }
  if (!res.ok) throw new Error(`content.json introuvable (erreur ${res.status}).`);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('Erreur de saisie dans content.json : ' + explainJsonError(text, e));
  }
  return normalize(data);
}

/** Traduit une erreur JSON en indiquant la ligne concernée. */
function explainJsonError(text, err) {
  const m = /position (\d+)/.exec(err.message) || /line (\d+) column (\d+)/.exec(err.message);
  let line = null;
  if (m && m.length === 2) line = text.slice(0, +m[1]).split('\n').length;
  else if (m) line = +m[1];
  const hint = 'Vérifie les virgules (pas de virgule après le dernier élément d\'une liste) et les guillemets droits "…".';
  return (line ? `vers la ligne ${line} (ou juste au-dessus). ` : '') + hint + ` (détail technique : ${err.message})`;
}

function normalize(data) {
  const p = data.profil || {};
  const profil = {
    nom: p.nom || 'Mon portfolio',
    titre: p.titre || '',
    accroche: p.accroche || '',
    recherche: p.recherche || '',
    localisation: p.localisation || '',
    email: p.email || '',
    telephone: p.afficherTelephone ? (p.telephone || '') : '',
    liens: p.liens || {},
    cv: p.cv || 'assets/cv.pdf',
    photo: p.photo || '',
    permis: p.permis || '',
    langues: p.langues || [],
    centresInteret: p.centresInteret || [],
  };
  const sections = (data.sections || []).filter(s => s && !s.masquer).map((s, i) => ({
    id: s.id || 'section-' + (i + 1),
    label: s.label || s.titre || 'Section',
    titre: s.titre || s.label || '',
    sousTitre: s.sousTitre || '',
    icone: s.icone || 'star',
    couleurs: Array.isArray(s.couleurs) && s.couleurs.length >= 2 ? s.couleurs : DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    elements: (s.elements || []).map(e => (typeof e === 'string' ? { texte: e } : e)).filter(e => e && e.texte),
    bouton: s.bouton && s.bouton.texte ? s.bouton : null,
  }));
  return { profil, sections, reglages: data.reglages || {} };
}

/** Un élément a-t-il une sous-page (détail affiché en grand) ? */
export function hasPage(el) {
  return !!(el.page || el.detail);
}

/** Paragraphes du texte long d'une sous-page. */
export function pageParagraphs(el) {
  const t = el.page && el.page.texte;
  if (!t) return [];
  return Array.isArray(t) ? t : String(t).split(/\n\s*\n/);
}

/** Lien externe d'un élément (élément lui-même ou sa sous-page). */
export function elementLink(el) {
  if (el.lien) return { url: el.lien, texte: el.texteLien || 'Ouvrir le lien' };
  if (el.page && el.page.lien) {
    const l = el.page.lien;
    return typeof l === 'string' ? { url: l, texte: 'Ouvrir le lien' } : { url: l.url, texte: l.texte || 'Ouvrir le lien' };
  }
  return null;
}

/** Résout l'action d'un bouton en URL (null pour "section"). */
export function resolveAction(bouton, profil) {
  if (!bouton) return null;
  switch (bouton.action) {
    case 'cv': return profil.cv;
    case 'email': return profil.email ? 'mailto:' + profil.email : null;
    case 'lien': return bouton.cible || bouton.lien || null;
    default: return null;
  }
}
