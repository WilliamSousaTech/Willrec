// Parallax — dois usos, uma linguagem:
//  1) initHero: o scroll é a câmera. Um único progresso (0→1) vira três fases (--a dolly, --b pan, --c assentar)
//     e o CSS distribui velocidades diferentes por camada (fundo < personagem < tipografia).
//  2) initParallax: deslocamento vertical sutil em [data-parallax].
// Só anima enquanto há movimento: nada de rAF infinito.
import { $, $$, clamp, ease, pad, REDUCE } from './util.js';

const seg = (p, a, b) => clamp((p - a) / (b - a));

export function initHero() {
  const hero = $('[data-hero]'), stage = $('[data-stage]');
  if (!hero || !stage) return;
  const words = $$('[data-kicker] span', stage);
  const kicker = $('[data-kicker]', stage), tagline = $('[data-tagline]', stage);
  const hint = $('[data-hint]', stage), count = $('[data-count]', stage);
  stage.style.setProperty('--k', REDUCE ? 0 : 1);

  let target = 0, cur = 0, raf = 0, shown = {};
  const set = (k, v) => { if (shown[k] !== v) { shown[k] = v; stage.style.setProperty(k, v); } };
  const flag = (el, cls, on) => { if (el && el.classList.contains(cls) !== on) el.classList.toggle(cls, on); };

  const measure = () => {
    const run = Math.max(1, hero.offsetHeight - innerHeight);
    target = clamp(-hero.getBoundingClientRect().top / run);
  };

  const apply = p => {
    set('--a', ease(seg(p, 0, .30)).toFixed(4));
    set('--b', ease(seg(p, .32, .64)).toFixed(4));
    set('--c', seg(p, .64, .94).toFixed(4));
    // VISÃO → RITMO → HISTÓRIAS acendem em sequência durante o dolly.
    const idx = p < .10 ? 0 : p < .20 ? 1 : 2;
    words.forEach((w, i) => { flag(w, 'on', p < .30 && i === idx); flag(w, 'done', p >= .30 || i < idx); });
    flag(kicker, 'is-off', p > .46);
    flag(tagline, 'is-in', p < .20 || p > .72);
    flag(hint, 'is-off', p > .03);
    if (count) count.textContent = p < .48 ? '01' : '02';
  };

  const loop = () => {
    cur += (target - cur) * (REDUCE ? 1 : .11);
    if (Math.abs(target - cur) < .0005) cur = target;
    apply(cur);
    raf = cur === target ? 0 : requestAnimationFrame(loop);
  };
  const onScroll = () => { measure(); if (!raf) raf = requestAnimationFrame(loop); };

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  measure(); cur = target; apply(cur);

  // Abertura: WILLREC primeiro, depois a assinatura (visão · ritmo · histórias).
  const intro = () => {
    const wm = $('.wordmark', stage);
    requestAnimationFrame(() => {
      stage.classList.add('is-ready');
      document.documentElement.classList.add('js-ready');
      wm && wm.classList.add('is-in');
      setTimeout(() => kicker && kicker.classList.add('is-in'), REDUCE ? 0 : 650);
      setTimeout(() => tagline && cur < .2 && tagline.classList.add('is-in'), REDUCE ? 0 : 1000);
    });
  };
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
