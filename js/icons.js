// =====================================================================
//  icons.js — Icônes (tracés SVG 24×24) utilisables dans content.json
//  via "icone": "nom". Tu peux aussi mettre directement un tracé SVG
//  ("M12 3l..."). Partagé par la version 3D et simple.html.
// =====================================================================
export const ICONS = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  route: 'M4 19h4l4-7 4 4 4-9',
  school: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6',
  briefcase: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  folder: 'M3 7h6l2 2h10v10H3z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  mail: 'M3 6h18v12H3zM3 6l9 7 9-7',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  trophy: 'M8 4h8v6a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 14v4M8 21h8',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1',
  book: 'M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h8',
  gamepad: 'M7 8h10a4 4 0 0 1 4 4l1 5a2 2 0 0 1-3.5 1.6L16 16H8l-2.5 2.6A2 2 0 0 1 2 17l1-5a4 4 0 0 1 4-4zM7 11v3M5.5 12.5h3M15 12h.01M17 14h.01',
  phone: 'M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
};

/** Retourne le tracé SVG d'une icône (nom connu ou tracé brut). */
export function iconPath(name) {
  if (!name) return ICONS.star;
  if (ICONS[name]) return ICONS[name];
  if (/^[Mm][\d\s.,-]/.test(name)) return name;
  return ICONS.star;
}
