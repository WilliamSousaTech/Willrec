// Dock — magnificação suave (spring) no desktop com mouse; no toque vira barra simples com alvos de 44px.
// Também marca a seção ativa (aria-current).
import { $, $$, FINE, REDUCE } from './util.js';

export function initDock() {
  const dock = $('[data-dock]');
  if (!dock) return;
  const items = $$('.dock-item', dock);

  if (FINE && !REDUCE) {
    const cur = items.map(() => 1), tgt = items.map(() => 1);
    let centers = [], mx = null, raf = 0;
    const measure = () => { centers = items.map(i => { const r = i.getBoundingClientRect(); return r.left + r.width / 2; }); };
    const step = () => {
      let moving = false;
      items.forEach((it, i) => {
        tgt[i] = mx == null ? 1 : 1 + .55 * Math.exp(-(((mx - centers[i]) / 74) ** 2));
        cur[i] += (tgt[i] - cur[i]) * .2;
        if (Math.abs(tgt[i] - cur[i]) > .002) moving = true; else cur[i] = tgt[i];
        it.style.setProperty('--s', cur[i].toFixed(3));
      });
      raf = moving ? requestAnimationFrame(step) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
    dock.addEventListener('pointerenter', () => { measure(); });
    dock.addEventListener('pointermove', e => { mx = e.clientX; kick(); });
    dock.addEventListener('pointerleave', () => { mx = null; kick(); });
  }

  // Seção ativa
  const map = new Map(items.map(i => [i.dataset.section, i]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    items.forEach(i => i.removeAttribute('aria-current'));
    const it = map.get(e.target.id); if (it) it.setAttribute('aria-current', 'true');
  }), { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}
