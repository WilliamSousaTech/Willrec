// Utilitários compartilhados pelo sistema de movimento WILLREC.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const pad = n => String(n).padStart(2, '0');
