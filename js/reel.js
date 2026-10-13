// Reel — showreel de vídeos verticais.
//  · a faixa corre sozinha, acelera com o scroll da página e pausa quando o cursor chega;
//  · o cursor "magnifica" os vídeos (como o Dock): o mais próximo cresce, inclina e acende;
//  · arrastar (mouse/toque) com inércia, roda horizontal do mouse;
//  · clique abre em tela cheia com transição FLIP (o vídeo "cresce" a partir do card), som ligado.
// Só toca o que está visível. Movimento reduzido → faixa estática, rolável, sem autoplay.
import { $, $$, clamp, pad, REDUCE, FINE } from './util.js';
import { probeAutoplay, onBlocked, setBlocked, isBlocked } from './autoplay.js';

// Vídeos originais em máxima qualidade (4K) ficam num CDN, não no repositório (arquivos > 100 MB).
// Ex.: 'https://cdn.seusite.com/reel/'  →  espera  <BASE>show.mp4, <BASE>criativo.mp4 ...
// Vazio = o lightbox usa a prévia leve (540p) que já está em media/reel/.
const FULL_BASE = '';

const AUTO = 40;               // px/s — velocidade automática
const GROW = 0.36;             // quanto o vídeo sob o cursor cresce (0.36 = +36%)
// Sempre começa tocando, em qualquer aparelho (decisão do projeto: o reel é o portfólio e precisa estar em movimento
// quando a pessoa chega). São vídeos mudos e leves; o botão Pausar continua disponível para quem não quiser movimento.

export function initReel() {
  const root = $('[data-reel]');
  if (!root) return;
  const view = $('[data-reel-view]', root), track = $('[data-reel-track]', root);
  const counter = $('[data-reel-n]', root);
  const originals = $$('.reel-card', track);
  const N = originals.length;
  if (!N) return;

  // ── dados de cada vídeo (vêm do HTML) ─────────────────────────
  const data = originals.map((li, i) => {
    const b = $('.reel-btn', li), v = $('video', li);
    li.dataset.i = i;
    return {
      slug: b.dataset.slug, title: b.dataset.title, meta: b.dataset.meta,
      hevc: b.dataset.hevc === '1', preview: b.dataset.preview, clip: v.dataset.src, poster: v.getAttribute('poster') || ''
    };
  });

  // ── cards, clones (loop contínuo) e vídeos ────────────────────
  const makeCard = el => {
    const c = {
      el, i: +el.dataset.i, video: $('video', el), frame: $('.reel-frame', el), img: null, imgFailed: false, on: false, fx: false,
      left: 0, w: 1, s: 1, p: 0, rx: 0, ry: 0, mx: 50, my: 40, shown: ''
    };
    c.video.__card = c;
    // o vídeo só aparece depois de começar a tocar; antes disso (ou se falhar) a capa fica à mostra, nunca um quadrado preto
    c.video.addEventListener('playing', () => c.video.classList.add('is-live'));
    ['emptied', 'error'].forEach(ev => c.video.addEventListener(ev, () => c.video.classList.remove('is-live')));
    return c;
  };
  const collect = () => $$('.reel-card', track).map(makeCard);
  let cards = collect();
  let motion = false, userPaused = false, cloned = false, sets = 1;
  const toggle = $('[data-reel-toggle]', root);

  const addSet = () => {
    originals.forEach(li => {
      const c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      $('.reel-btn', c).tabIndex = -1;
      track.appendChild(c);
    });
    sets++;
  };
  // 2 conjuntos bastam (36 elementos viravam 24); só acrescenta outro se a tela for mais larga que a faixa
  const buildClones = () => {
    if (cloned) return; cloned = true;
    addSet(); cards = collect(); measure();
    while (W < viewW * 1.15 && sets < 4) { addSet(); cards = collect(); measure(); }
  };

  // vídeos: GESTÃO DE MEMÓRIA. Só os cards perto da tela carregam, só os visíveis tocam, e os que ficam longe são
  // descarregados (src removido). Antes, cada vídeo que passava ficava carregado para sempre: depois de algumas voltas
  // eram dezenas de decodificadores abertos, o celular esgotava a memória, os cards ficavam pretos e a página recarregava.
  const visibleVideos = new WeakSet();
  let lightboxOpen = false;
  const canPlayNow = v => visibleVideos.has(v) && !lightboxOpen && !userPaused;
  const tryPlay = v => {
    if (!canPlayNow(v) || (v.__card && v.__card.img)) return;
    v.play().then(() => setTimeout(() => { if (v.paused && v.readyState >= 2 && canPlayNow(v)) setBlocked(); }, 900),
                  e => { if (e && e.name === 'NotAllowedError') setBlocked(); });
  };

  // autoplay bloqueado (iPhone em baixo consumo): o card passa a usar <img src="clipe.mp4"> (Safari anima sozinho)
  const useImage = c => {
    if (c.img || c.imgFailed) return;
    const img = document.createElement('img');
    img.className = 'reel-vid'; img.alt = ''; img.decoding = 'async'; img.draggable = false;
    img.addEventListener('load', () => img.classList.add('is-live'));
    img.addEventListener('error', () => {            // navegador que não mostra mp4 em <img>: volta ao <video>
      c.imgFailed = true; c.img = null; img.remove();
      c.video.style.display = ''; c.frame.classList.remove('as-img');
    });
    c.img = img; img.src = c.video.dataset.src;
    c.video.pause(); c.video.removeAttribute('src'); c.video.load();
    c.video.style.display = 'none'; c.video.after(img); c.frame.classList.add('as-img');
  };
  const loadVideo = c => {
    if (isBlocked()) { useImage(c); return; }
    const v = c.video;
    if (c.img || v.getAttribute('src')) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute('playsinline', '');   // iOS exige muted via propriedade
    v.preload = 'auto';
    v.src = v.dataset.src;
  };
  const unloadVideo = c => {
    const v = c.video;
    if (c.img) { c.img.remove(); c.img = null; c.frame.classList.remove('as-img'); v.style.display = ''; }
    if (v.getAttribute('src')) { v.pause(); v.removeAttribute('src'); v.load(); }
    v.classList.remove('is-live');
  };
  onBlocked(() => cards.forEach(c => { if (c.on) useImage(c); }));
  probeAutoplay();

  // distância (px) do card até a borda da tela: negativo = aparece na tela
  const edgeGap = c => { const center = c.left - x + c.w / 2; return Math.max(-(center + c.w / 2), center - c.w / 2 - viewW); };
  const manage = () => {
    if (lightboxOpen) return;
    for (const c of cards) {
      const gap = edgeGap(c);
      if (gap < c.w * 1.1) { if (!c.on) { c.on = true; loadVideo(c); } }
      else if (gap > c.w * 2.4 && c.on) { c.on = false; visibleVideos.delete(c.video); unloadVideo(c); }
      if (!c.on) continue;
      if (gap < 0) { visibleVideos.add(c.video); if (c.video.paused && !c.img) tryPlay(c.video); }
      else { visibleVideos.delete(c.video); if (!c.video.paused) c.video.pause(); }
    }
  };
  const unloadAll = () => cards.forEach(c => { c.on = false; visibleVideos.delete(c.video); unloadVideo(c); });
  // alguns celulares só liberam o play depois de um toque: tenta de novo a cada gesto
  const retryPlay = () => cards.forEach(c => { if (c.video.paused) tryPlay(c.video); });
  ['touchstart', 'touchend', 'pointerdown', 'click'].forEach(t => addEventListener(t, retryPlay, { passive: true }));
  let lastRetry = 0;
  addEventListener('scroll', () => { const n = performance.now(); if (n - lastRetry > 600) { lastRetry = n; retryPlay(); } }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retryPlay(); });

  const syncToggle = () => {
    if (!toggle) return;
    const running = motion && !userPaused;
    toggle.textContent = running ? 'Pausar' : 'Reproduzir';
    toggle.classList.toggle('is-playing', running);
    toggle.setAttribute('aria-label', running ? 'Pausar o reel' : 'Reproduzir o reel');
  };

  // ── medidas ───────────────────────────────────────────────────
  let viewW = 1, W = 1, viewLeft = 0, viewTop = 0;
  const measure = () => {
    const vw = view.clientWidth;
    if (!vw) return;
    viewW = vw;
    const r = view.getBoundingClientRect(); viewLeft = r.left; viewTop = r.top;
    cards.forEach(c => { c.left = c.el.offsetLeft; c.w = c.el.offsetWidth; });
    W = cards.length > N ? cards[N].left - cards[0].left : track.scrollWidth;
  };
  new ResizeObserver(measure).observe(view);
  measure();
  addEventListener('load', measure);

  // ── estado do movimento ───────────────────────────────────────
  let x = 0, vel = 0, inertia = 0, scrollBoost = 0, lastScroll = scrollY;
  let hovering = false, hoverX = 0, hoverY = 0, focusX = 0, focusSet = false;
  let hotCard = null, tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let drag = null, suppressClick = false;
  let counterIdx = -1;
  let visible = false, raf = 0, last = 0;

  // cursor customizado (só mouse)
  let cursor = null, cx = 0, cy = 0, cTx = 0, cTy = 0;
  if (FINE && !REDUCE) {
    cursor = document.createElement('div');
    cursor.className = 'reel-cursor'; cursor.setAttribute('aria-hidden', 'true');
    cursor.textContent = 'Arraste';
    document.body.appendChild(cursor);
  }
  const setCursorLabel = onCard => {
    if (!cursor) return;
    const t = onCard ? 'Abrir' : 'Arraste';
    if (cursor.textContent !== t) cursor.textContent = t;
    cursor.classList.toggle('is-card', onCard);
  };

  let lastManage = 0;
  const frameStep = t => {
    // arraste preso (o navegador às vezes não manda pointerup no toque): solta sozinho
    if (drag && (t - drag.lastT > 1500 || (!drag.moved && t - drag.t0 > 700))) releaseDrag();
    const dt = clamp((t - last) / 1000, .001, .05); last = t;

    // scroll da página empurra a faixa (a câmera acelera)
    const ds = scrollY - lastScroll; lastScroll = scrollY;
    scrollBoost += (clamp(ds * 14, -900, 900) - scrollBoost) * Math.min(1, dt * 6);

    // velocidade automática: pausa quando há cursor, arraste ou lightbox
    const paused = hovering || drag || lightboxOpen || userPaused;
    vel += ((paused ? 0 : AUTO) - vel) * Math.min(1, dt * 4);
    if (!drag) {
      x += (vel + scrollBoost + inertia) * dt;
      inertia *= Math.pow(.05, dt);
      if (Math.abs(inertia) < 2) inertia = 0;
    }
    if (!(W > 0)) { measure(); return; }
    x = ((x % W) + W) % W;
    if (!isFinite(x)) x = 0;
    track.style.transform = `translate3d(${(-x).toFixed(2)}px,0,0)`;

    // foco: cursor (quando existe) ou centro da tela
    const fx = hovering ? hoverX : viewW / 2;
    if (!focusSet) { focusX = fx; focusSet = true; }
    focusX += (fx - focusX) * Math.min(1, dt * 11);
    const amp = hovering ? 1 : .42;

    // inclinação suave do card sob o cursor
    tilt.x += (tilt.tx - tilt.x) * Math.min(1, dt * 12);
    tilt.y += (tilt.ty - tilt.y) * Math.min(1, dt * 12);

    let best = null, bestD = Infinity;
    for (const c of cards) {
      const center = c.left - x + c.w / 2;
      if (center < -c.w * 1.6 || center > viewW + c.w * 1.6) { // fora da tela: volta ao normal e sai da camada 3D
        if (c.fx) { c.fx = false; c.el.classList.remove('fx'); c.s = 1; c.p = 0; c.rx = 0; c.ry = 0; c.el.style.cssText = ''; c.shown = ''; }
        continue;
      }
      if (!c.fx) { c.fx = true; c.el.classList.add('fx'); }
      const d = center - focusX;
      const p = Math.exp(-((d / (c.w * 1.02)) ** 2)) * amp;
      const isHot = hovering && c === hotCard;
      c.p += (p - c.p) * Math.min(1, dt * 14);
      c.s += ((1 + GROW * (isHot ? Math.max(c.p, .9) : c.p)) - c.s) * Math.min(1, dt * 12);
      const rx = isHot ? tilt.y : 0, ry = isHot ? tilt.x : 0;
      c.rx += (rx - c.rx) * Math.min(1, dt * 12);
      c.ry += (ry - c.ry) * Math.min(1, dt * 12);
      const sig = `${c.s.toFixed(3)}|${c.p.toFixed(3)}|${c.rx.toFixed(2)}|${c.ry.toFixed(2)}`;
      if (sig !== c.shown) {
        c.shown = sig;
        const st = c.el.style;
        st.setProperty('--s', c.s.toFixed(3)); st.setProperty('--p', c.p.toFixed(3));
        st.setProperty('--rx', c.rx.toFixed(2) + 'deg'); st.setProperty('--ry', c.ry.toFixed(2) + 'deg');
        st.zIndex = Math.round(c.p * 20);
      }
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = c; }
    }
    if (best && counter && best.i !== counterIdx) { counterIdx = best.i; counter.textContent = pad(best.i + 1); }

    if (cursor) {
      cx += (cTx - cx) * Math.min(1, dt * 18); cy += (cTy - cy) * Math.min(1, dt * 18);
      cursor.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
    }
    if (t - lastManage > 250) { lastManage = t; manage(); }
  };
  const tick = t => {
    raf = 0;
    try { frameStep(t); } catch (err) { if (!isFinite(x)) x = 0; console.warn('[reel]', err); }   // um erro isolado nunca para a faixa
    if (visible && motion) raf = requestAnimationFrame(tick);
  };
  const wake = () => { if (!raf && visible && motion) { last = performance.now(); lastScroll = scrollY; raf = requestAnimationFrame(tick); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { measure(); wake(); } else unloadAll(); }, { rootMargin: '200px 0px' }).observe(root);
  setInterval(() => { if (visible && motion && !raf) wake(); }, 1500);   // vigia: se o loop parar por qualquer motivo, religa

  // ── ponteiro: hover, arraste, roda ────────────────────────────
  const cardOf = e => { const el = e.target.closest && e.target.closest('.reel-card'); return el ? cards.find(c => c.el === el) : null; };

  view.addEventListener('pointermove', e => {
    if (!motion) return;
    cTx = e.clientX; cTy = e.clientY;
    if (e.pointerType === 'touch') {
      if (drag) dragMove(e);
      return;
    }
    hovering = !lightboxOpen; hoverX = e.clientX - viewLeft; hoverY = e.clientY - viewTop;
    if (drag) dragMove(e);
    const c = drag ? null : cardOf(e);
    hotCard = c;
    if (c) {
      const r = c.frame.getBoundingClientRect();
      const px = clamp((e.clientX - r.left) / r.width), py = clamp((e.clientY - r.top) / r.height);
      tilt.tx = (px - .5) * 14; tilt.ty = -(py - .5) * 10;
      c.el.style.setProperty('--mx', (px * 100).toFixed(1) + '%'); c.el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    } else { tilt.tx = 0; tilt.ty = 0; }
    setCursorLabel(!!c);
    wake();
  });
  view.addEventListener('pointerenter', e => {
    if (!motion || e.pointerType === 'touch') return;
    cx = cTx = e.clientX; cy = cTy = e.clientY;
    hovering = !lightboxOpen; if (cursor && hovering) cursor.classList.add('on'); wake();
  });
  view.addEventListener('pointerleave', e => {
    if (!motion || e.pointerType === 'touch' || drag) return;
    hovering = false; hotCard = null; tilt.tx = tilt.ty = 0;
    if (cursor) cursor.classList.remove('on');
  });

  const dragMove = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dxTotal = e.clientX - drag.startX;
    if (!drag.moved && Math.abs(dxTotal) > 6) {
      drag.moved = true; view.classList.add('is-drag');
      try { view.setPointerCapture(e.pointerId); } catch (_) {}
      if (cursor) cursor.classList.add('is-grab');
    }
    if (!drag.moved) return;
    const now = performance.now(), dx = e.clientX - drag.lastX, dtm = Math.max(1, now - drag.lastT);
    x -= dx; drag.v = drag.v * .6 + (-dx / dtm * 1000) * .4;
    drag.lastX = e.clientX; drag.lastT = now;
  };
  view.addEventListener('pointerdown', e => {
    if (!motion || e.button !== 0) return;
    const now = performance.now();
    drag = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: now, t0: now, v: 0, moved: false };
    wake();
  });
  const endDrag = e => {
    if (!drag) return;
    if (e && e.type && e.type.indexOf('pointer') === 0 && e.pointerId !== drag.id) return;
    if (drag.moved) { inertia = clamp(drag.v, -2600, 2600); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0); }
    view.classList.remove('is-drag'); if (cursor) cursor.classList.remove('is-grab');
    drag = null;
  };
  const releaseDrag = () => endDrag(null);
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);
  ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach(t => addEventListener(t, endDrag, { passive: true }));
  addEventListener('blur', releaseDrag);
  view.addEventListener('click', e => { if (suppressClick) { e.preventDefault(); e.stopPropagation(); } }, true);
  view.addEventListener('wheel', e => {
    if (motion && Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.preventDefault(); x += e.deltaX; wake(); }
  }, { passive: false });

  // teclado: foco no card centraliza e magnifica
  view.addEventListener('focusin', e => {
    if (!motion) return;
    if (e.target.matches && !e.target.matches(':focus-visible')) return;
    const c = cardOf(e); if (!c) return;
    const center = c.left - x + c.w / 2;
    if (center < viewW * .12 || center > viewW * .88) x += center - viewW / 2;
    hovering = true; hotCard = c; hoverX = viewW / 2; wake();
  });
  view.addEventListener('focusout', () => { if (motion) { hovering = false; hotCard = null; } });

  // ── lightbox (tela cheia) ─────────────────────────────────────
  const dlg = document.createElement('dialog');
  dlg.className = 'reel-dialog'; dlg.setAttribute('aria-label', 'Vídeo em tela cheia');
  dlg.innerHTML = `
    <button class="reel-x" type="button" aria-label="Fechar">Fechar <span aria-hidden="true">✕</span></button>
    <figure class="reel-stage"><video playsinline controls controlsList="nodownload"></video></figure>
    <div class="reel-ctl">
      <button class="reel-nav" type="button" data-d="-1" aria-label="Vídeo anterior">←</button>
      <p class="reel-now"><b></b><strong></strong><small></small></p>
      <button class="reel-nav" type="button" data-d="1" aria-label="Próximo vídeo">→</button>
    </div>`;
  document.body.appendChild(dlg);
  const stage = $('.reel-stage', dlg), lv = $('video', dlg);
  const nowN = $('.reel-now b', dlg), nowT = $('.reel-now strong', dlg), nowM = $('.reel-now small', dlg);
  let cur = -1;
  const EASE = 'cubic-bezier(.22,1,.36,1)';

  const canHevc = () => {
    const p = document.createElement('video');
    return !!(p.canPlayType('video/mp4; codecs="hvc1.1.6.L153.B0"') || p.canPlayType('video/mp4; codecs="hvc1.2.4.L153.B0"'));
  };
  const sourceFor = d => (FULL_BASE && (!d.hevc || canHevc())) ? `${FULL_BASE}${d.slug}.mp4` : d.preview;

  // escolhe a cópia do card mais perto do centro da tela (a faixa tem 3 conjuntos)
  const frameOf = i => {
    let best = null, bd = Infinity;
    cards.forEach(c => {
      if (c.i !== i) return;
      const r = c.frame.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - innerWidth / 2);
      if (d < bd) { bd = d; best = c.frame; }
    });
    return best;
  };

  const play = () => {
    lv.muted = false;
    lv.play().catch(() => { lv.muted = true; lv.play().catch(() => {}); });
  };
  const load = (i, dir = 0) => {
    cur = i; const d = data[i];
    lv.onerror = () => {
      const fb = new URL(d.preview, document.baseURI).href;
      if (lv.src !== fb) { lv.src = fb; play(); }
    };
    lv.poster = d.poster; lv.src = sourceFor(d); play();
    nowN.textContent = `${pad(i + 1)} / ${pad(N)}`; nowT.textContent = d.title; nowM.textContent = d.meta;
    if (dir && !REDUCE) stage.animate([{ opacity: 0, transform: `translateX(${dir * 40}px) scale(.96)` }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE });
  };

  const open = i => {
    if (dlg.open) return;
    lightboxOpen = true; hovering = false; if (cursor) cursor.classList.remove('on');
    unloadAll();
    const from = (frameOf(i) || view).getBoundingClientRect();
    dlg.classList.remove('is-closing');
    dlg.showModal(); document.documentElement.classList.add('reel-lock');
    load(i);
    if (!REDUCE) {
      const to = stage.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
      stage.animate([{ transform: `translate(${dx}px,${dy}px) scale(${from.width / to.width})` }, { transform: 'none' }], { duration: 760, easing: EASE });
      $$('.reel-ctl, .reel-x', dlg).forEach(el => el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 260, easing: EASE, fill: 'backwards' }));
    }
    $('.reel-x', dlg).focus({ preventScroll: true });
  };

  const finish = () => {
    dlg.close(); document.documentElement.classList.remove('reel-lock');
    lv.pause(); lv.removeAttribute('src'); lv.load();
    lightboxOpen = false; cur = -1; hovering = false; hotCard = null;
    manage();
    wake();
  };
  const close = () => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    lv.pause();
    const target = frameOf(cur);
    if (REDUCE || !target) return finish();
    dlg.classList.add('is-closing');
    const from = stage.getBoundingClientRect(), to = target.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const a = stage.animate([{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${to.width / from.width})` }], { duration: 520, easing: EASE, fill: 'forwards' });
    a.finished.then(() => { a.cancel(); finish(); }, finish);
  };

  const step = d => { if (cur < 0) return; load((cur + d + N) % N, d); };

  track.addEventListener('click', e => {
    const b = e.target.closest('.reel-btn'); if (!b) return;
    open(+b.closest('.reel-card').dataset.i);
  });
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  $('.reel-x', dlg).addEventListener('click', close);
  $$('.reel-nav', dlg).forEach(b => b.addEventListener('click', () => step(+b.dataset.d)));
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  // ── liga o movimento (no começo, ou quando a pessoa aperta Reproduzir) ──
  const start = () => {
    motion = true; userPaused = false;
    root.classList.add('is-motion');
    if (cursor) view.classList.add('has-cursor');
    buildClones(); measure(); manage(); syncToggle(); wake();
  };
  if (toggle) toggle.addEventListener('click', () => {
    if (!motion) { start(); return; }
    userPaused = !userPaused;
    if (userPaused) cards.forEach(c => c.video.pause()); else cards.forEach(c => tryPlay(c.video));
    syncToggle(); wake();
  });
  syncToggle();
  start();
}
