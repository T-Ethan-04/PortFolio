// =====================================================================
//  manette_forme.js — Forme de la manette, en champ de distance signé (SDF).
//  Une seule définition sert à deux choses :
//    • fabriquer la coque lisse (outil hors ligne → assets/models/manette.glb) ;
//    • poser les doigts de l'avatar exactement sur la surface (avatar.js).
//  Repère (mètres) : X = gauche du joueur, Y = haut, Z = vers la télé.
//  Design original : aucune reprise d'une manette du commerce.
// =====================================================================

const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

/** Union lisse (k = rayon du congé). */
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Boîte arrondie centrée en c, demi-tailles h, rayon r. */
function boite(px, py, pz, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r, qz = Math.abs(pz - cz) - hz + r;
  return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

/** Ellipsoïde (approximation de distance correcte près de la surface). */
function ellipsoide(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx, y = (py - cy) / ry, z = (pz - cz) / rz;
  const k0 = len3(x, y, z), k1 = len3(x / rx, y / ry, z / rz);
  return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(rx, ry, rz);
}

/** Cône à bouts ronds entre a (rayon r1) et b (rayon r2) — formule d'Inigo Quilez. */
function coneRond(px, py, pz, a, b, r1, r2) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz, y2 = y * y * l2, z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// ---------------------------------------------------------------------
//  Dimensions (≈ 157 × 63 × 110 mm, comme une manette de salon actuelle)
// ---------------------------------------------------------------------
export const FORME = {
  // poignées : deux tronçons par côté (racine → coude → bout), un peu écartées et tombantes
  poignee: { racine: [0.046, -0.006, -0.004], coude: [0.056, -0.020, -0.040], bout: [0.060, -0.032, -0.062], r: [0.0205, 0.0215, 0.0185] },
  // emplacements sur le dessus (la hauteur exacte est calculée sur la coque)
  stick: [0.0295, -0.0225],         // x, z (miroir pour l'autre côté)
  cuvette: { rayon: 0.0128, fond: 0.0088 },
  croix: [0.045, 0.006],            // côté gauche du joueur
  boutons: [-0.045, 0.006],         // côté droit du joueur
  ecartBoutons: 0.0105,
  centre: [0, -0.0125],             // bouton central avec anneau lumineux
  menus: [0.019, 0.0135],           // deux petits boutons de part et d'autre
  // tranche avant : boutons d'épaule et gâchettes
  epaule: { x: 0.046, y: 0.0085, z: 0.0285, largeur: 0.026 },
  gachette: { x: 0.046, pivot: [0.003, 0.0285], largeur: 0.022 },
};

/** Coque seule (sans les boutons). Négatif = à l'intérieur. */
export function sdfCoque(px, py, pz) {
  const ax = Math.abs(px);                         // la manette est symétrique gauche/droite
  let d = boite(ax, py, pz, 0, -0.002, 0.004, 0.058, 0.0125, 0.024, 0.011);          // corps central
  d = smin(d, ellipsoide(ax, py, pz, 0, -0.012, 0.0, 0.060, 0.025, 0.034), 0.012);    // dessus légèrement bombé
  d = smin(d, boite(ax, py, pz, 0.048, -0.003, 0.016, 0.022, 0.015, 0.013, 0.009), 0.010);   // épaules
  d = smin(d, boite(ax, py, pz, 0, -0.005, -0.020, 0.040, 0.0115, 0.014, 0.0095), 0.012);    // partie basse, entre les sticks
  const P = FORME.poignee;
  d = smin(d, coneRond(ax, py, pz, P.racine, P.coude, P.r[0], P.r[1]), 0.016);
  d = smin(d, coneRond(ax, py, pz, P.coude, P.bout, P.r[1], P.r[2]), 0.012);
  // cuvettes des sticks : léger creux circulaire autour de chaque joystick (bord adouci)
  const sx = ax - FORME.stick[0], sz = pz - FORME.stick[1], rs = Math.sqrt(sx * sx + sz * sz);
  const cuvette = Math.max(rs - FORME.cuvette.rayon, FORME.cuvette.fond - py);   // cylindre ouvert vers le haut
  return -smin(-d, cuvette, 0.0018);
}

/** Hauteur du dessus de la coque en (x, z), en descendant depuis le haut. */
export function dessus(x, z, depuis = 0.05) {
  let y = depuis;
  for (let i = 0; i < 80; i++) {
    const d = sdfCoque(x, y, z);
    if (d < 2e-6) break;
    y -= Math.max(d, 1e-5);
  }
  return y;
}

/** Normale de la coque (gradient du champ). */
export function normaleCoque(x, y, z, e = 2e-4) {
  const nx = sdfCoque(x + e, y, z) - sdfCoque(x - e, y, z);
  const ny = sdfCoque(x, y + e, z) - sdfCoque(x, y - e, z);
  const nz = sdfCoque(x, y, z + e) - sdfCoque(x, y, z - e);
  const l = len3(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
