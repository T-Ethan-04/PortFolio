// =====================================================================
//  effects.js — Rendu "cinéma" : vignettage, grain, aberration
//  chromatique légère sur les bords. Très peu coûteux (une seule passe).
// =====================================================================
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const CINEMA = {
  vignettage: 0.42,   // assombrissement des coins (0 = aucun)
  grain: 0.028,       // grain de pellicule (0 = aucun)
  aberration: 0.0018, // décalage des couleurs sur les bords (0 = aucun)
};

const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: CINEMA.vignettage },
    uGrain: { value: CINEMA.grain },
    uCA: { value: CINEMA.aberration },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uCA, uAspect;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 dir = vUv - 0.5;
      float d = length(dir * vec2(uAspect, 1.0)) / length(vec2(uAspect, 1.0) * 0.5);
      vec2 off = dir * uCA * d * d;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.b = texture2D(tDiffuse, vUv - off).b;
      c.rgb *= 1.0 - uVignette * smoothstep(0.35, 1.05, d);
      float n = hash(vUv * vec2(1931.0, 1373.0) + fract(uTime * 7.31)) - 0.5;
      c.rgb *= 1.0 + n * uGrain * 2.0;
      gl_FragColor = c;
    }`,
};

export function createCinematicPass() {
  const pass = new ShaderPass(CinematicShader);
  pass.targets = { vignette: CINEMA.vignettage, grain: CINEMA.grain, ca: CINEMA.aberration };
  /** Ajuste en douceur l'effet (atténué sur l'écran de la télé pour la lisibilité). */
  pass.tick = (dt, aspect, onTV) => {
    const u = pass.uniforms, k = 1 - Math.exp(-dt * 3);
    u.uTime.value += dt;
    u.uAspect.value = aspect;
    u.uVignette.value += ((onTV ? 0.12 : pass.targets.vignette) - u.uVignette.value) * k;
    u.uCA.value += ((onTV ? 0 : pass.targets.ca) - u.uCA.value) * k;
    u.uGrain.value += ((onTV ? pass.targets.grain * 0.4 : pass.targets.grain) - u.uGrain.value) * k;
  };
  return pass;
}

// ---------------------------------------------------------------------
//  Sécurité Safari : certaines cartes graphiques Apple produisent parfois
//  des valeurs invalides (NaN) qui deviennent de grands blocs noirs une fois
//  étalées par le halo lumineux. Cette passe les neutralise avant le halo.
// ---------------------------------------------------------------------
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 64.0), c.a);
    }`,
};
export function createSanitizePass() { return new ShaderPass(SanitizeShader); }
