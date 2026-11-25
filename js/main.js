// WILLREC — ponto de entrada.
// Abertura em 2 passos (foto presa que aproxima e desce; WILLREC grande → nome menor + frase + botões) ·
// perfil estilo Instagram (destaques, Reels, Grade) · Dock · GlowCard · tema claro/escuro.
// ?v=N nos módulos que mudaram: o navegador não reaproveita a cópia antiga (cache de 1h no vercel.json).
// util.js e autoplay.js ficam sem versão: são compartilhados e precisam ser a MESMA instância.
import { $, $$ } from './util.js';
import { initTheme } from './theme.js?v=22';
import { initTextEffect } from './text-effect.js';
import { initHero, initParallax } from './parallax.js?v=25';
import { initNav, goTo } from './nav.js?v=25';
import { initDock } from './dock.js';
import { initGlow } from './glow-card.js';
import { loadManifest, applyDriveLinks, initGrid, initHighlights, fillCounts } from './videos.js?v=23';
import { createLightbox } from './lightbox.js?v=20';
import { initFeed } from './feed.js?v=23';
import { initTechText } from './tech-text.js?v=22';
import { initQuemSou } from './quem-sou.js';
import { probeAutoplay, onBlocked, setBlocked, isBlocked } from './autoplay.js';

initTheme();
initNav();
initTextEffect();
initHero();
initParallax();
initDock();
initGlow();

// Portfólio: tudo sai de data/videos.json (feed de Reels, grade, destaques, links do Drive).
loadManifest().then(m => {
  if (!m) return;                      // sem o arquivo, o perfil continua com o link do Drive
  applyDriveLinks(m);
  fillCounts(m);
  let feed = null;
  const lightbox = createLightbox(m, { onOpen: () => feed && feed.suspend(), onClose: () => feed && feed.resume() });
  const open = (i, el, opts) => lightbox && lightbox.open(i, el, opts);
  feed = initFeed(m, lightbox);
  initGrid(m, open);
  initHighlights(m, open);
  // link direto para um vídeo (botão "Enviar"): ...#v-slug abre o vídeo em tela cheia
  const fromHash = () => {
    const h = decodeURIComponent(location.hash || '');
    const v = h.startsWith('#v-') && m.videos.find(x => `#v-${x.slug}` === h);
    if (!v || !v.playUrl) return;
    const card = document.getElementById(`v-${v.slug}`);
    if (card) card.scrollIntoView({ block: 'center' });
    setTimeout(() => open(v.i, card && $('.rl-media', card)), 400);
  };
  fromHash();
  addEventListener('hashchange', fromHash);
  // endereço com #secao (ex.: link compartilhado para #orcamento): o feed e a grade acabaram de entrar
  // e empurraram a página; corrige a posição sem animação.
  const h = decodeURIComponent(location.hash.slice(1));
  if (h && !h.startsWith('v-')) requestAnimationFrame(() => goTo(h, { instant: true, focus: false }));
});

initTechText();
initQuemSou();

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
  btn.type = 'button'; btn.className = 'media-toggle'; btn.setAttribute('aria-label', 'Reproduzir vídeo');
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

// Barra superior: transparente sobre a foto de abertura, branca depois dela.
const bar = $('.bar'), hero = $('[data-hero]');
const onScroll = () => bar && bar.classList.toggle('is-solid', scrollY > ((hero && hero.offsetHeight) || innerHeight) - 72);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
