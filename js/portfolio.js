// Portfólio — foco por hover (desktop) · item ativo por scroll-snap (toque).
// O foco migra suavemente via flex-grow no CSS; aqui só decidimos QUAL painel está em foco.
import { $, $$, pad } from './util.js';

export function initFolio() {
  const root = $('[data-folio]');
  if (!root) return;
  const panels = $$('.panel', root), out = $('[data-folio-n]');
  const touchMode = matchMedia('(max-width: 899px), (hover: none)');
  let active = -1;

  const set = i => {
    if (i === active || i < 0) return;
    active = i;
    panels.forEach((p, j) => p.classList.toggle('is-focus', j === i));
    if (out) out.textContent = pad(i + 1);
  };

  panels.forEach((p, i) => {
    p.addEventListener('pointerenter', e => { if (!touchMode.matches && e.pointerType === 'mouse') set(i); });
    p.addEventListener('focus', () => set(i));
    p.addEventListener('click', e => {
      // No toque: primeiro toque centraliza o trabalho, segundo abre o Drive.
      if (touchMode.matches && i !== active) {
        e.preventDefault();
        p.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        set(i);
      }
    });
  });

  root.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = Math.min(panels.length - 1, Math.max(0, active + (e.key === 'ArrowRight' ? 1 : -1)));
    panels[n].focus({ preventScroll: true });
    if (touchMode.matches) panels[n].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });

  const io = new IntersectionObserver(es => {
    if (!touchMode.matches) return;
    es.forEach(e => { if (e.isIntersecting) set(panels.indexOf(e.target)); });
  }, { root, threshold: .6 });
  panels.forEach(p => io.observe(p));

  set(0);
}
