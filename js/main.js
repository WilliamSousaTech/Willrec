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
import { probeAutoplay, onBlocked, setBlocked, isBlocked } from './autoplay.js';

initTextEffect();
initHero();
initParallax();
initDock();
initGlow();
initFolio();
initReel();
initTechText();

// Vídeo do Will: carrega ao chegar na seção, toca sozinho e pausa quando sai da tela.
// Se o aparelho bloquear autoplay de vídeo (iPhone em baixo consumo), troca por <img src="video.mp4">:
// o Safari anima isso sozinho, sem toque. Só se nem isso funcionar aparece o botão de play.
probeAutoplay();
$$('[data-lazy-video]').forEach(v => {
  const fig = v.closest('figure') || v.parentElement;
  let loaded = false, userPaused = false, inView = false, img = null, imgFailed = false;
  const mp4 = () => { const s = v.querySelector('source[type="video/mp4"]'); return s && (s.dataset.src || s.src); };

  const load = () => {
    if (loaded) return; loaded = true;
    v.muted = true; v.defaultMuted = true;                        // iOS só libera autoplay com muted como propriedade
    v.querySelectorAll('source[data-src]').forEach(s => { s.src = s.dataset.src; });
    v.load();
  };
  const useImage = () => {
    if (img || imgFailed || !mp4()) return;
    img = document.createElement('img'); img.className = 'media-img'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.addEventListener('error', () => {                          // navegador sem suporte: volta ao vídeo + botão
      imgFailed = true; img.remove(); img = null; v.style.display = ''; sync(true);
    });
    img.src = mp4();
    v.pause(); v.style.display = 'none'; v.after(img); fig.classList.remove('is-stopped');
  };
  const play = () => {
    if (isBlocked()) return useImage();
    load();
    v.play().then(() => setTimeout(() => { if (v.paused && v.readyState >= 2 && inView && !userPaused) setBlocked(); }, 900),
                  e => { if (e && e.name === 'NotAllowedError') setBlocked(); });
  };
  onBlocked(() => { if (inView) useImage(); });

  // botão de play: só aparece se vídeo E imagem animada falharem
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'media-toggle';
  btn.innerHTML = '<span aria-hidden="true"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 2.5v15l13-7.5z"/></svg></span>';
  fig.appendChild(btn);
  const sync = last => {
    const stopped = !img && (userPaused || (last === true) || (isBlocked() && imgFailed));
    fig.classList.toggle('is-stopped', stopped);
    btn.setAttribute('aria-label', stopped ? 'Reproduzir vídeo' : 'Pausar vídeo');
  };
  ['play', 'playing', 'pause', 'ended'].forEach(ev => v.addEventListener(ev, () => sync()));
  btn.addEventListener('click', () => {
    if (v.paused) { userPaused = false; load(); v.play().catch(() => {}); sync(); }
    else { userPaused = true; v.pause(); sync(); }
  });

  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(es => es.forEach(e => {
    inView = e.isIntersecting;
    if (inView) { if (!userPaused) play(); }
    else if (!img) v.pause();
  }), { threshold: .25, rootMargin: '300px 0px' }).observe(fig);

  // mesmo sem imagem animada, alguns aparelhos liberam o play depois de um toque
  const retry = () => { if (inView && !userPaused && !img && v.paused) play(); };
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(t => addEventListener(t, retry, { passive: true }));
});

// Barra superior ganha fundo depois do hero.
const bar = document.querySelector('.bar');
const onScroll = () => bar && bar.classList.toggle('is-solid', scrollY > innerHeight * .9);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
