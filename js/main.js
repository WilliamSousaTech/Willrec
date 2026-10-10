// WILLREC — ponto de entrada do sistema de movimento.
// TextEffect · Parallax · Dock · GlowCard · SocialHover (CSS puro) + Portfólio.
import { $$, REDUCE } from './util.js';
import { initTextEffect } from './text-effect.js';
import { initHero, initParallax } from './parallax.js';
import { initDock } from './dock.js';
import { initGlow } from './glow-card.js';
import { initFolio } from './portfolio.js';
import { initReel } from './reel.js';
import { initTechText } from './tech-text.js';

initTextEffect();
initHero();
initParallax();
initDock();
initGlow();
initFolio();
initReel();
initTechText();

// Vídeo do Will: só carrega quando entra na tela e pausa quando sai (economiza dados e bateria).
// Sempre toca sozinho ao chegar na seção. Só aparece o botão de play se o celular bloquear o autoplay
// (ex.: modo economia de bateria) — aí o primeiro toque/rolagem tenta de novo.
$$('[data-lazy-video]').forEach(v => {
  const fig = v.closest('figure') || v.parentElement;
  let loaded = false, allowed = true, userPaused = false, inView = false;

  const load = () => {
    if (loaded) return; loaded = true;
    v.muted = true; v.defaultMuted = true;                        // iOS só libera autoplay com muted como propriedade
    v.querySelectorAll('source[data-src]').forEach(s => { s.src = s.dataset.src; });
    v.load();
  };
  const play = () => { load(); v.play().catch(() => {}); };
  const sync = () => {
    fig.classList.toggle('is-stopped', v.paused);
    btn.setAttribute('aria-label', v.paused ? 'Reproduzir vídeo' : 'Pausar vídeo');
  };

  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'media-toggle';
  btn.innerHTML = '<span aria-hidden="true"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 2.5v15l13-7.5z"/></svg></span>';
  fig.appendChild(btn);
  ['play', 'playing', 'pause', 'ended'].forEach(ev => v.addEventListener(ev, sync));
  sync();

  btn.addEventListener('click', () => {
    if (v.paused) { allowed = true; userPaused = false; play(); }
    else { userPaused = true; v.pause(); }
  });

  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(es => es.forEach(e => {
    inView = e.isIntersecting;
    if (inView) { if (allowed && !userPaused) play(); }
    else v.pause();
  }), { threshold: .25 }).observe(v);

  // alguns celulares só liberam o play depois de um toque em qualquer lugar
  const retry = () => { if (inView && allowed && !userPaused && v.paused) play(); };
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(t => addEventListener(t, retry, { passive: true }));
  let lastRetry = 0;
  addEventListener('scroll', () => { const n = performance.now(); if (n - lastRetry > 600) { lastRetry = n; retry(); } }, { passive: true });
});

// Barra superior ganha fundo depois do hero.
const bar = document.querySelector('.bar');
const onScroll = () => bar && bar.classList.toggle('is-solid', scrollY > innerHeight * .9);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
