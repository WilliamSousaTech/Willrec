// Feed de Reels — portfólio em vídeo vertical, no ritmo do Instagram.
//  · conforme a pessoa desce, o vídeo que está no centro da tela toca sozinho (mudo, em loop);
//  · só UM vídeo toca por vez; o próximo e o anterior ficam carregados, o resto é descarregado (memória do celular);
//  · toque no vídeo pausa/continua; barra de progresso no topo; "Tela cheia" abre a versão mais longa;
//  · "Quero assim" abre o WhatsApp já citando o vídeo; "Drive" abre o original quando houver link;
//  · abas Reels / Grade (como no perfil do Instagram); no desktop, índice lateral clicável.
// Tudo sai de data/videos.json: vídeos com destaque:true e clip:true entram no feed, na ordem do arquivo.
// Movimento reduzido: nada toca sozinho; a pessoa toca no vídeo para assistir.
import { $, $$, pad, REDUCE } from './util.js';
import { probeAutoplay, onBlocked, setBlocked, isBlocked } from './autoplay.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICON = {
  play: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 2.8v14.4L17 10z"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/></svg>',
  drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>',
};

// número do WhatsApp: o mesmo que script.js já colocou nos links [data-wa-link] (uma única fonte: CONFIG)
const waNumber = () => {
  const a = $('[data-wa-link]');
  const m = a && a.href.match(/wa\.me\/(\d+)/);
  return m ? m[1] : '';
};
const waLink = (num, title) => num
  ? `https://wa.me/${num}?text=${encodeURIComponent(`Olá, Will! Vi o vídeo "${title}" no seu site e quero um vídeo assim. Podemos conversar?`)}`
  : '#contato';

export function initFeed(m, lightbox) {
  const root = $('[data-feed]');
  if (!root || !m) return null;
  const list = $('[data-feed-list]', root), index = $('[data-feed-index]', root);
  const counter = $('[data-feed-n]', root), total = $('[data-feed-total]', root);
  const destaques = m.videos.filter(v => v.destaque && v.clip);
  // feedMax (data/videos.json): quantos destaques entram no feed; o resto fica a um toque, na aba Grade.
  // Mantém a página curta: Sobre, Serviços e Contato não ficam a 10+ telas de distância. 0 = todos.
  const items = m.feedMax > 0 ? destaques.slice(0, m.feedMax) : destaques;
  const rest = m.videos.length - items.length;
  const num = waNumber();

  if (!items.length) {                           // nenhum vídeo em destaque: mostra direto a grade
    root.classList.add('no-reels');
    const g = $('[data-feed-panel="grade"]', root), r = $('[data-feed-panel="reels"]', root);
    if (g) g.hidden = false; if (r) r.hidden = true;
    return null;
  }

  // Cada vídeo mantém a proporção original (campo "formato": 9:16, 16:9, 1:1...), sem cortar o enquadramento.
  // Vertical: título e ações sobre o vídeo, como no Reels. Horizontal/quadrado: legenda e ações abaixo,
  // para não cobrir a cena num quadro baixo.
  const info = v => `
          <p class="rl-user"><span class="rl-avatar" aria-hidden="true">WR</span><span>willrec_oficial</span></p>
          <h3 class="rl-title">${esc(v.title)}</h3>
          <p class="rl-meta">${esc(v.catLabel)}${v.catLabel && v.meta ? ' · ' : ''}${esc(v.meta)}</p>
          ${v.desc ? `<p class="rl-desc">${esc(v.desc)}</p>` : ''}`;
  const actions = (v, row) => `
      <div class="rl-actions${row ? ' rl-actions--row' : ''}">
        <button type="button" class="rl-act" data-full aria-label="Assistir em tela cheia: ${esc(v.title)}">${ICON.full}<span>Tela cheia</span></button>
        <a class="rl-act rl-act--wa" href="${esc(waLink(num, v.title))}" target="_blank" rel="noopener" aria-label="Quero um vídeo como ${esc(v.title)} — chamar no WhatsApp">${ICON.wa}<span>Quero assim</span></a>
        ${v.driveUrl ? `<a class="rl-act" href="${esc(v.driveUrl)}" target="_blank" rel="noopener" aria-label="Ver ${esc(v.title)} no Drive">${ICON.drive}<span>Drive</span></a>` : ''}
      </div>`;
  const general = ($('[data-wa-link]') || {}).href || '#contato';

  list.innerHTML = items.map((v, pos) => {
    const vert = v.orient === 'v';
    return `
    <li class="rl rl--${v.orient}" data-i="${v.i}" data-pos="${pos}" style="--ar:${v.ratio}">
      <div class="rl-media">
        ${v.poster ? `<img class="rl-poster" src="${esc(v.posterUrl)}" alt="" loading="lazy" decoding="async" width="${v.pw}" height="${v.ph}">` : ''}
        <video muted loop playsinline preload="none" disablepictureinpicture data-src="${esc(v.clipUrl)}"></video>
        <button type="button" class="rl-tap" aria-label="Pausar: ${esc(v.title)}"><span class="rl-state">${ICON.play}</span></button>
        <span class="rl-progress" aria-hidden="true"><i></i></span>
        ${vert ? `<div class="rl-info">${info(v)}
        </div>` : ''}
      </div>
      ${vert ? actions(v, false) : `<div class="rl-below"><div class="rl-cap">${info(v)}</div>${actions(v, true)}</div>`}
    </li>`;
  }).join('') + `
    <li class="rl-end">
      <p class="rl-end-k">Fim dos destaques</p>
      <h3 class="rl-end-t">Curtiu o que viu?</h3>
      <p class="rl-end-s">${rest > 0 ? `Tem mais ${rest} ${rest === 1 ? 'vídeo' : 'vídeos'} no portfólio, por categoria.` : 'Bora fazer o seu.'}</p>
      <div class="rl-end-a">
        ${rest > 0 ? `<button type="button" class="btn btn-ghost" data-go-grid>Ver todos os ${m.videos.length} vídeos</button>` : ''}
        <a class="btn" href="${esc(general)}" target="_blank" rel="noopener">Pedir orçamento no WhatsApp</a>
      </div>
    </li>`;

  if (index) index.innerHTML = items.map((v, pos) => `
    <li><button type="button" data-go="${pos}"><b>${pad(pos + 1)}</b><span>${esc(v.title)}</span></button></li>`).join('');
  if (total) total.textContent = pad(items.length);

  const cards = $$('.rl', list).map(el => {
    const c = {
      el, pos: +el.dataset.pos, i: +el.dataset.i,
      media: $('.rl-media', el), video: $('video', el), tap: $('.rl-tap', el), bar: $('.rl-progress i', el),
      img: null, imgFailed: false, userPaused: REDUCE,
    };
    c.video.addEventListener('playing', () => { c.video.classList.add('is-live'); syncState(c); });
    c.video.addEventListener('pause', () => syncState(c));
    ['emptied', 'error'].forEach(ev => c.video.addEventListener(ev, () => c.video.classList.remove('is-live')));
    return c;
  });
  const indexBtns = index ? $$('button', index) : [];

  // ── carregar / descarregar ─────────────────────────────────────
  const useImage = c => {                       // autoplay bloqueado (iPhone em baixo consumo): <img src="clipe.mp4">
    if (c.img || c.imgFailed) return;
    const img = document.createElement('img');
    img.className = 'rl-vid'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.addEventListener('load', () => img.classList.add('is-live'));
    img.addEventListener('error', () => { c.imgFailed = true; c.img = null; img.remove(); c.el.classList.remove('as-img'); c.video.style.display = ''; });
    c.img = img; img.src = c.video.dataset.src;
    c.video.pause(); c.video.removeAttribute('src'); c.video.load(); c.video.style.display = 'none';
    c.video.after(img); c.el.classList.add('as-img');
  };
  const load = c => {
    if (isBlocked() && !REDUCE) { useImage(c); return; }
    const v = c.video;
    if (c.img || v.getAttribute('src')) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute('playsinline', '');
    v.preload = 'auto'; v.src = v.dataset.src;
  };
  const unload = c => {
    if (c.img) { c.img.remove(); c.img = null; c.el.classList.remove('as-img'); c.video.style.display = ''; }
    const v = c.video;
    if (v.getAttribute('src')) { v.pause(); v.removeAttribute('src'); v.load(); }
    v.classList.remove('is-live');
    c.bar.style.transform = '';
  };
  const play = c => {
    if (c.userPaused || c.img) return;
    load(c);
    if (c.img) return;
    const v = c.video;
    v.play().then(() => setTimeout(() => { if (v.paused && v.readyState >= 2 && c === cards[active] && !c.userPaused && !suspended) setBlocked(); }, 900),
                  e => { if (e && e.name === 'NotAllowedError') setBlocked(); });
  };
  function syncState(c) {
    const stopped = c.userPaused || (!c.img && c.video.paused && c === cards[active] && c.video.readyState >= 2);
    c.el.classList.toggle('is-paused', !!stopped);
    c.tap.setAttribute('aria-label', `${stopped ? 'Reproduzir' : 'Pausar'}: ${$('.rl-title', c.el).textContent}`);
  }

  // ── qual vídeo está "no ar" ────────────────────────────────────
  let active = -1, suspended = false, nearView = false, raf = 0;
  const pick = () => {
    const vh = innerHeight; let best = -1, bd = Infinity;
    cards.forEach((c, k) => {
      const r = c.media.getBoundingClientRect();
      if (!r.height) return;
      const seen = (Math.min(r.bottom, vh) - Math.max(r.top, 0)) / r.height;
      if (seen < .55) return;
      const d = Math.abs(r.top + r.height / 2 - vh / 2);
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  };
  const setActive = k => {
    if (k === active) return;
    const prev = cards[active];
    active = k;
    cards.forEach((c, n) => {
      const d = k < 0 ? 99 : Math.abs(n - k);
      if (REDUCE) { if (d > 0) unload(c); }        // movimento reduzido: só carrega quando a pessoa toca
      else if (d === 0) { c.userPaused = false; load(c); play(c); }
      else if (d === 1) { load(c); if (!c.img) c.video.pause(); }
      else unload(c);
      c.el.classList.toggle('is-active', d === 0);
      syncState(c);
    });
    if (prev && prev !== cards[k]) prev.bar.style.transform = '';
    indexBtns.forEach((b, n) => b.classList.toggle('is-on', n === k));
    if (counter && k >= 0) counter.textContent = pad(k + 1);
    tickProgress();
  };
  const update = () => { raf = 0; if (!suspended && nearView) setActive(pick()); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

  // barra de progresso: só o vídeo ativo, só enquanto toca
  let praf = 0;
  const progress = () => {
    praf = 0;
    const c = cards[active];
    if (!c || suspended || c.img) return;
    const v = c.video;
    if (v.duration) c.bar.style.transform = `scaleX(${(v.currentTime / v.duration).toFixed(4)})`;
    if (!v.paused) praf = requestAnimationFrame(progress);
  };
  const tickProgress = () => { if (!praf) praf = requestAnimationFrame(progress); };
  cards.forEach(c => c.video.addEventListener('playing', tickProgress));

  new IntersectionObserver(([e]) => {
    nearView = e.isIntersecting;
    if (nearView) schedule(); else setActive(-1);
  }, { rootMargin: '25% 0px' }).observe(list);
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => {
    const c = cards[active]; if (!c) return;
    if (document.hidden) c.video.pause(); else play(c);
  });
  // alguns celulares só liberam o play depois de um gesto: tenta de novo
  const retry = () => { const c = cards[active]; if (c && !suspended && !c.userPaused && !c.img && c.video.paused) play(c); };
  ['touchend', 'pointerdown'].forEach(t => addEventListener(t, retry, { passive: true }));
  onBlocked(() => { const c = cards[active]; if (c && !suspended && !REDUCE) useImage(c); });
  probeAutoplay();

  // ── interações ─────────────────────────────────────────────────
  list.addEventListener('click', e => {
    if (e.target.closest('[data-go-grid]')) { show('grade'); return; }
    const el = e.target.closest('.rl'); if (!el) return;
    const c = cards[+el.dataset.pos];
    if (e.target.closest('[data-full]')) { lightbox && lightbox.open(c.i, c.media); return; }
    if (!e.target.closest('.rl-tap')) return;
    if (c.pos !== active) { goTo(c.pos); return; }
    if (c.img) return;                          // imagem animada (autoplay bloqueado) não pausa
    if (!c.video.paused) { c.userPaused = true; c.video.pause(); }
    else { c.userPaused = false; play(c); }
    syncState(c);
  });
  const goTo = pos => {
    const c = cards[pos]; if (!c) return;
    const r = c.media.getBoundingClientRect();
    scrollTo({ top: r.top + scrollY - (innerHeight - r.height) / 2, behavior: REDUCE ? 'auto' : 'smooth' });
  };
  if (index) index.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goTo(+b.dataset.go); });

  // ── abas Reels / Grade ─────────────────────────────────────────
  const tabs = $$('[data-feed-tab]', root);
  const panels = Object.fromEntries($$('[data-feed-panel]', root).map(p => [p.dataset.feedPanel, p]));
  const show = name => {
    tabs.forEach(t => { const on = t.dataset.feedTab === name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== name; });
    if (name === 'reels') { suspended = false; schedule(); } else { suspended = true; setActive(-1); }
    // se a pessoa já desceu dentro do feed, volta para o começo do painel escolhido
    const head = $('[data-feed-tabs]', root);
    const panelTop = panels[name].getBoundingClientRect().top + scrollY - (head ? head.offsetHeight : 0) - 72;
    if (scrollY > panelTop + 4) scrollTo({ top: panelTop, behavior: 'auto' });
  };
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.feedTab)));
  tabs.forEach((t, n) => t.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const nxt = tabs[(n + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    nxt.focus(); show(nxt.dataset.feedTab);
  }));

  return {
    suspend() { suspended = true; setActive(-1); },
    resume() { if (panels.reels && panels.reels.hidden) return; suspended = false; schedule(); },
  };
}
