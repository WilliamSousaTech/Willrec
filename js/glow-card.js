// GlowCard — brilho discreto que acompanha o cursor. Só em dispositivos com mouse; sem JS o card continua íntegro.
import { $$, FINE, REDUCE } from './util.js';

export function initGlow() {
  if (!FINE || REDUCE) return;
  $$('.glow').forEach(card => {
    let raf = 0, x = 0, y = 0;
    const paint = () => { raf = 0; card.style.setProperty('--mx', x + 'px'); card.style.setProperty('--my', y + 'px'); };
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect(); x = e.clientX - r.left; y = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(paint);
    });
  });
}
