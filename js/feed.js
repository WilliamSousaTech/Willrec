// Feed de Reels — o portfólio no ritmo do Instagram.
//  · conforme a pessoa desce, o vídeo que está no centro da tela toca sozinho (mudo), o vídeo INTEIRO em HD;
//  · botão de som no canto (como no Reels): ligou uma vez, os próximos já tocam com som;
//  · toque no vídeo pausa/continua; barra de progresso embaixo; só UM vídeo toca por vez;
//  · o próximo vídeo já fica com os dados carregados; os distantes são descarregados (memória do celular);
//  · ações ao lado: Tela cheia · Quero assim (WhatsApp citando o vídeo) · Compartilhar (link direto para o vídeo);
//  · abas Reels / Grade, como no perfil do Instagram.
// Tudo sai de data/videos.json: vídeos com destaque:true entram no feed, na ordem do arquivo (os melhores primeiro).
// Movimento reduzido ou autoplay bloqueado (iPhone em baixo consumo): nada toca sozinho; um toque dá o play.
import { $, $$, REDUCE } from './util.js';
import { probeAutoplay, onBlocked, setBlocked, isBlocked } from './autoplay.js';
import { esc } from './videos.js?v=23';

const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M21.5 3 10.2 10.4M21.5 3l-7 18-4.3-10.6L3 7.6z"/></svg>',
  drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>',
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M16 10l5 5M21 10l-5 5"/></svg>',
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
export const videoLink = slug => `${location.origin}${location.pathname}#v-${slug}`;

// aviso curto ("Link copiado")
let toastEl = null, toastT = 0;
export function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('p');
    toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg; toastEl.classList.add('is-on');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}
export async function shareVideo(v) {
  const url = videoLink(v.slug);
  if (navigator.share) {
    try { await navigator.share({ title: `${v.title} — Will Rec`, text: `${v.title} · Will Rec, videomaker em Teresina-PI`, url }); } catch (_) {}
    return;
  }
  try { await navigator.clipboard.writeText(url); toast('Link do vídeo copiado'); }
  catch (_) { toast(url); }
}

export function initFeed(m, lightbox) {
  const root = $('[data-feed]');
  if (!root || !m) return null;
  const list = $('[data-feed-list]', root);
  const destaques = m.videos.filter(v => v.destaque && v.playUrl && v.poster);
  // feedMax (data/videos.json): quantos destaques entram no feed; o resto fica a um toque, na aba Grade. 0 = todos.
  const items = m.feedMax > 0 ? destaques.slice(0, m.feedMax) : destaques;
  const total = m.videos.filter(v => v.poster).length, rest = total - items.length;
  const num = waNumber();

  if (!items.length) {                           // nenhum vídeo em destaque: mostra direto a grade
    root.classList.add('no-reels');
    const g = $('[data-feed-panel="grade"]', root), r = $('[data-feed-panel="reels"]', root);
    if (g) g.hidden = false; if (r) r.hidden = true;
    return null;
  }

  const general = ($('[data-wa-link]') || {}).href || '#contato';
  list.innerHTML = items.map((v, pos) => `
    <li class="rl rl--${v.orient}" data-i="${v.i}" data-pos="${pos}" id="v-${esc(v.slug)}" style="--ar:${v.ratio}">
      <div class="rl-media">
        <img class="rl-poster" src="${esc(v.posterUrl)}" alt="" loading="lazy" decoding="async" width="${v.pw}" height="${v.ph}">
        <video loop playsinline muted preload="none" disablepictureinpicture data-src="${esc(v.playUrl)}"></video>
        <button type="button" class="rl-tap" aria-label="Reproduzir: ${esc(v.title)}"><span class="rl-state">${ICON.play}</span></button>
        <button type="button" class="rl-snd" aria-pressed="false" aria-label="Ativar som">${ICON.off}</button>
        <span class="rl-progress" aria-hidden="true"><i></i></span>
        <div class="rl-info">
          <p class="rl-user"><span class="rl-avatar" aria-hidden="true"></span><b>willrec_oficial</b><span aria-hidden="true">·</span><span>${esc(v.catLabel || 'Videomaker')}</span></p>
          <h3 class="rl-title">${esc(v.title)}</h3>
          ${v.desc ? `<p class="rl-desc">${esc(v.desc)}</p>` : ''}
          <p class="rl-meta">${esc(v.meta)}</p>
        </div>
      </div>
      <div class="rl-actions">
        <button type="button" class="rl-act" data-full aria-label="Assistir em tela cheia: ${esc(v.title)}">${ICON.full}<span>Tela cheia</span></button>
        <a class="rl-act rl-act--wa" href="${esc(waLink(num, v.title))}" target="_blank" rel="noopener" aria-label="Quero um vídeo como ${esc(v.title)} — chamar no WhatsApp">${ICON.wa}<span>Quero assim</span></a>
        <button type="button" class="rl-act" data-share aria-label="Compartilhar o vídeo ${esc(v.title)}">${ICON.share}<span>Enviar</span></button>
        ${v.drive ? `<a class="rl-act" href="${esc(v.drive)}" target="_blank" rel="noopener" aria-label="Ver ${esc(v.title)} no Drive">${ICON.drive}<span>Drive</span></a>` : ''}
      </div>
    </li>`).join('') + `
    <li class="rl-end">
      <p class="rl-end-k">Fim dos destaques</p>
      <h3 class="rl-end-t">Curtiu o que viu?</h3>
      <p class="rl-end-s">${rest > 0 ? `Tem mais ${rest} ${rest === 1 ? 'vídeo' : 'vídeos'} na grade do portfólio.` : 'Bora fazer o seu.'}</p>
      <div class="rl-end-a">
        ${rest > 0 ? `<button type="button" class="btn btn-soft" data-go-grid>Ver todos os ${total} vídeos</button>` : ''}
        <a class="btn" href="${esc(general)}" target="_blank" rel="noopener">Pedir orçamento no WhatsApp</a>
      </div>
    </li>`;

  const cards = $$('.rl', list).map(el => {
    const c = {
      el, pos: +el.dataset.pos, i: +el.dataset.i, v: m.videos[+el.dataset.i],
      media: $('.rl-media', el), video: $('video', el), tap: $('.rl-tap', el), snd: $('.rl-snd', el), bar: $('.rl-progress i', el),
      userPaused: false,
    };
    c.video.addEventListener('playing', () => { c.video.classList.add('is-live'); syncState(c); tickProgress(); });
    c.video.addEventListener('pause', () => syncState(c));
    c.video.addEventListener('waiting', () => c.el.classList.add('is-buffering'));
    ['playing', 'canplay'].forEach(ev => c.video.addEventListener(ev, () => c.el.classList.remove('is-buffering')));
    ['emptied', 'error'].forEach(ev => c.video.addEventListener(ev, () => c.video.classList.remove('is-live')));
    return c;
  });

  // ── som (um só estado para o feed inteiro) ─────────────────────
  let soundOn = false;
  const paintSound = () => cards.forEach(c => {
    c.snd.innerHTML = soundOn ? ICON.on : ICON.off;
    c.snd.setAttribute('aria-pressed', String(soundOn));
    c.snd.setAttribute('aria-label', soundOn ? 'Desativar som' : 'Ativar som');
  });

  // ── carregar / descarregar ─────────────────────────────────────
  const manual = () => REDUCE || isBlocked();          // sem autoplay: só toca com um toque
  // 'metadata' para o próximo da fila (só o começo do arquivo), 'auto' para o que está tocando
  const load = (c, how = 'auto') => {
    const v = c.video;
    if (v.preload !== how) v.preload = how;
    if (!v.getAttribute('src')) { v.muted = true; v.defaultMuted = true; v.setAttribute('playsinline', ''); v.src = v.dataset.src; }
  };
  const unload = c => {
    const v = c.video;
    if (v.getAttribute('src')) { v.pause(); v.removeAttribute('src'); v.preload = 'none'; v.load(); }
    v.classList.remove('is-live');
    c.bar.style.transform = '';
  };
  const play = (c, gesture = false) => {
    if (c.userPaused || suspended) return;
    if (manual() && !gesture) { syncState(c); return; }
    load(c, 'auto');
    const v = c.video;
    v.muted = !soundOn;
    v.play().then(() => setTimeout(() => {
      if (!gesture && v.paused && v.readyState >= 2 && c === cards[active] && !c.userPaused && !suspended) setBlocked();
    }, 900), e => {
      if (e && e.name === 'NotAllowedError') {
        if (!v.muted) {                               // som bloqueado sem gesto: segue mudo
          soundOn = false; paintSound(); v.muted = true;
          v.play().catch(() => { if (!gesture) setBlocked(); syncState(c); });
        } else if (!gesture) setBlocked();
      }
      syncState(c);
    });
  };
  function syncState(c) {
    const stopped = c.userPaused || (c === cards[active] && c.video.paused && (manual() || c.video.readyState >= 2));
    c.el.classList.toggle('is-paused', !!stopped);
    c.tap.setAttribute('aria-label', `${stopped ? 'Reproduzir' : 'Pausar'}: ${c.v.title}`);
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
      const d = k < 0 ? 99 : n - k;
      if (d === 0) { c.userPaused = false; play(c); }
      else if (d === 1 && !manual()) { load(c, 'metadata'); c.video.pause(); }   // o próximo já vem com os dados
      else if (Math.abs(d) === 1 && c.video.getAttribute('src')) c.video.pause();
      else unload(c);
      c.el.classList.toggle('is-active', d === 0);
      syncState(c);
    });
    if (prev && prev !== cards[k]) prev.bar.style.transform = '';
    tickProgress();
  };
  const update = () => { raf = 0; if (!suspended && nearView) setActive(pick()); };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };

  // barra de progresso: só o vídeo ativo, só enquanto toca
  let praf = 0;
  const progress = () => {
    praf = 0;
    const c = cards[active];
    if (!c || suspended) return;
    const v = c.video;
    if (v.duration) c.bar.style.transform = `scaleX(${(v.currentTime / v.duration).toFixed(4)})`;
    if (!v.paused) praf = requestAnimationFrame(progress);
  };
  function tickProgress() { if (!praf) praf = requestAnimationFrame(progress); }

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
  onBlocked(() => cards.forEach(syncState));
  probeAutoplay();

  // ── interações ─────────────────────────────────────────────────
  list.addEventListener('click', e => {
    if (e.target.closest('[data-go-grid]')) { show('grade'); return; }
    const el = e.target.closest('.rl'); if (!el) return;
    const c = cards[+el.dataset.pos];
    if (e.target.closest('[data-full]')) {
      const t = c.video.getAttribute('src') ? c.video.currentTime : 0;
      lightbox && lightbox.open(c.i, c.media, { t, list: m.videos.filter(v => v.poster && v.playUrl).map(v => v.i) });
      return;
    }
    if (e.target.closest('[data-share]')) { shareVideo(c.v); return; }
    if (e.target.closest('.rl-snd')) {
      soundOn = !soundOn; paintSound();
      if (c.pos !== active) { goTo(c.pos); return; }
      c.video.muted = !soundOn;
      if (c.video.paused) { c.userPaused = false; play(c, true); }
      return;
    }
    if (!e.target.closest('.rl-tap')) return;
    if (c.pos !== active) { goTo(c.pos); return; }
    if (c.video.paused) { c.userPaused = false; play(c, true); }
    else { c.userPaused = true; c.video.pause(); }
    syncState(c);
  });
  const goTo = pos => {
    const c = cards[pos]; if (!c) return;
    const r = c.media.getBoundingClientRect();
    scrollTo({ top: r.top + scrollY - (innerHeight - r.height) / 2, behavior: REDUCE ? 'auto' : 'smooth' });
  };

  // ── abas Reels / Grade ─────────────────────────────────────────
  const tabs = $$('[data-feed-tab]', root);
  const panels = Object.fromEntries($$('[data-feed-panel]', root).map(p => [p.dataset.feedPanel, p]));
  const show = name => {
    tabs.forEach(t => { const on = t.dataset.feedTab === name; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== name; });
    if (name === 'reels') { suspended = false; schedule(); } else { suspended = true; setActive(-1); }
    // se a pessoa já desceu dentro do feed, volta para o começo do painel escolhido
    const head = $('[data-feed-tabs]', root);
    const panelTop = panels[name].getBoundingClientRect().top + scrollY - (head ? head.offsetHeight : 0) - 64;
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
