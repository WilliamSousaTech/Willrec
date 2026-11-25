// Parallax — dois usos, uma linguagem:
//  1) initHero: abertura em 2 passos, com a foto presa na tela (position:sticky) enquanto você rola.
//     Passo 1 (topo): WILLREC grande entre o fundo e o Will + Visão · Ritmo · Histórias (acendem em sequência).
//     Passo 2 (primeira rolada): o WILLREC grande diminui e some; entram o nome menor, a frase, o texto e os botões.
//     A foto vai aproximando e descendo o tempo todo. Depois a abertura sobe e o perfil aparece.
//     O JS só mede a rolagem e escreve variáveis CSS (0 → 1); o styles.css faz o resto.
//  2) initParallax: deslocamento vertical sutil em [data-parallax].
// Só anima enquanto há movimento: nada de rAF infinito.
import { $, $$, clamp, REDUCE } from './util.js';

// cada parte do passo 2 entra num trecho da rolada (q de 0 a 1), com desaceleração suave
const ease = t => 1 - (1 - t) ** 3;
const seg = (q, a, b) => ease(clamp((q - a) / (b - a)));
const TRACKS = [            // [variável, início, fim]
  ['--k', 0, .2],           // Visão · Ritmo · Histórias sai
  ['--g', 0, .34],          // WILLREC grande diminui, anda em direção ao nome menor e some
  ['--n', .08, .42],        // nome menor entra (começa antes do grande sumir: parece o mesmo nome)
  ['--t', .2, .54],         // "Histórias reais. Imagem que permanece."
  ['--c', .32, .66],        // texto + botões
];

export function initHero() {
  const hero = $('[data-hero]'), stage = $('[data-stage]');
  if (!hero || !stage) return;
  const kicker = $('[data-kicker]', stage), words = $$('[data-kicker] span', stage);
  const hint = $('[data-hint]', stage);
  const st = stage.style;

  // medidas só mudam com o tamanho da tela (não a cada quadro)
  const big = $('.wordmark', stage), type = $('.type', stage), small = $('.hero-name', stage);
  let pin = 0, sh = 0;
  const measure = () => {
    sh = stage.offsetHeight || innerHeight;
    pin = Math.max(0, hero.offsetHeight - sh);     // quanto a página rola com a foto presa (0 = sem prender)
    // direção do WILLREC grande até o nome menor: o grande anda um pouco para lá enquanto some,
    // e o menor chega vindo dessa direção — parece o mesmo nome diminuindo e indo para o lugar dele.
    // (offsetTop/offsetLeft ignoram os transforms da rolagem: a medida é sempre a do layout.)
    if (big && type && small) {
      const gx = big.offsetLeft + big.offsetWidth / 2, gy = type.offsetTop;   // o centro do grande fica no topo do .type
      let sx = small.offsetWidth / 2, sy = small.offsetHeight / 2;
      for (let el = small; el && el !== stage; el = el.offsetParent) { sx += el.offsetLeft; sy += el.offsetTop; }
      st.setProperty('--dx', `${Math.round(sx - gx)}px`);
      st.setProperty('--dy', `${Math.round(sy - gy)}px`);
    }
  };

  // Navegador com animation-timeline (Safari 26+, Chrome 115+): o CSS anima direto da rolagem (styles.css, 5b),
  // sem atraso. Aqui só liga/desliga os botões. Nos outros, o JS escreve as variáveis a cada quadro.
  const CSS_SCROLL = document.documentElement.classList.contains('sda');   // marcado no <head> (index.html)
  let raf = 0, lastY = NaN, written = false;
  const update = force => {
    raf = 0;
    const y = -hero.getBoundingClientRect().top;
    if (!force && y === lastY) return;
    lastY = y;
    const q = pin > 1 ? clamp(y / pin) : 1;         // sem prender (movimento reduzido / celular deitado): já no passo 2
    stage.classList.toggle('is-b', q > .45);        // botões só aceitam toque/foco quando já aparecem
    if (hint) hint.classList.toggle('is-off', y > 8);
    if (CSS_SCROLL && pin > 1) {                    // o CSS cuida da animação
      if (written) { TRACKS.forEach(([k]) => st.removeProperty(k)); st.removeProperty('--q'); st.removeProperty('--p'); written = false; }
      return;
    }
    const p = clamp((y - pin) / sh);
    st.setProperty('--q', q.toFixed(4));
    st.setProperty('--p', p.toFixed(4));
    TRACKS.forEach(([k, a, b]) => st.setProperty(k, seg(q, a, b).toFixed(4)));
    written = true;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(() => update(false)); };
  const resize = () => { measure(); update(true); };
  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
  measure(); update(true);

  // teclado: se o foco cair num botão do passo 2 ainda escondido, rola até ele aparecer
  stage.addEventListener('focusin', e => {
    if (!e.target.closest('.hero-actions') || stage.classList.contains('is-b')) return;
    scrollTo({ top: hero.offsetTop + pin, behavior: REDUCE ? 'auto' : 'smooth' });
  });

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
