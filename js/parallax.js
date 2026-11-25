// Parallax — dois usos, uma linguagem:
//  1) initHero: uma foto só. Ao rolar, a foto vai aproximando (zoom) e descendo, com o WILLREC entre o fundo e o Will.
//     Um único progresso (--p: 0 no topo → 1 quando a abertura sai da tela) e o CSS faz o resto.
//     Na abertura: WILLREC → Visão · Ritmo · Histórias (acendem em sequência) → frase → botões. Rápido, sem travar a rolagem.
//  2) initParallax: deslocamento vertical sutil em [data-parallax].
// Só anima enquanto há movimento: nada de rAF infinito.
import { $, $$, clamp, REDUCE } from './util.js';

export function initHero() {
  const hero = $('[data-hero]'), stage = $('[data-stage]');
  if (!hero || !stage) return;
  const kicker = $('[data-kicker]', stage), words = $$('[data-kicker] span', stage);
  const tagline = $('[data-tagline]', stage), ctas = $$('[data-hero-cta]', stage), hint = $('[data-hint]', stage);

  let raf = 0, last = -1;
  const update = () => {
    raf = 0;
    const h = hero.offsetHeight || innerHeight;
    const p = REDUCE ? 0 : clamp(-hero.getBoundingClientRect().top / h);
    if (Math.abs(p - last) < .0004) return;
    last = p;
    stage.style.setProperty('--p', p.toFixed(4));
    if (hint) hint.classList.toggle('is-off', p > .02);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick, { passive: true });
  update();

  const intro = () => requestAnimationFrame(() => {
    stage.classList.add('is-ready');
    document.documentElement.classList.add('js-ready');
    const wm = $('.wordmark', stage); if (wm) wm.classList.add('is-in');
    const t0 = REDUCE ? 0 : 280, dt = REDUCE ? 0 : 300;
    if (kicker) setTimeout(() => kicker.classList.add('is-in'), t0);
    words.forEach((w, i) => setTimeout(() => {
      words.forEach((x, j) => { x.classList.toggle('on', j === i); x.classList.toggle('done', j < i); });
    }, t0 + dt * i));
    const end = t0 + dt * words.length;
    setTimeout(() => words.forEach(x => { x.classList.remove('on'); x.classList.add('done'); }), end + 500);
    if (tagline) setTimeout(() => tagline.classList.add('is-in'), end);
    setTimeout(() => ctas.forEach(el => el.classList.add('is-in')), end + 180);
  });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(intro);
}

export function initParallax() {
  const items = $$('[data-parallax]');
  if (!items.length || REDUCE) return;
  const vis = new Set();
  const io = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target))), { rootMargin: '10% 0px' });
  items.forEach(el => io.observe(el));
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = innerHeight;
    vis.forEach(el => {
      const r = el.getBoundingClientRect();
      const off = (r.top + r.height / 2 - vh / 2) / vh;      // -1..1 aprox.
      el.style.setProperty('--py', `${(off * parseFloat(el.dataset.parallax) * 100).toFixed(2)}px`);
    });
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}
