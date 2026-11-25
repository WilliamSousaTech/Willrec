// Lightbox — vídeo em tela cheia, compartilhado pelo feed, pela grade e pelos destaques.
//  · abre com transição FLIP (o vídeo "cresce" a partir de onde foi tocado);
//  · toca a melhor versão disponível: original (FULL_BASE) → HD 1080p → prévia → clipe; YouTube se houver `yt`;
//  · modo normal: controles do player, setas/teclado navegam pela lista (a grade inteira, ou a lista recebida);
//  · modo stories (destaques): barras de progresso no topo, toque à direita/esquerda avança/volta,
//    passa sozinho para o próximo e fecha no fim — como os destaques do Instagram.
import { $, $$, pad, REDUCE } from './util.js';

// Vídeos originais em máxima qualidade (4K) podem ficar num CDN, fora do repositório (arquivos > 100 MB).
// Ex.: 'https://cdn.seusite.com/reel/'  →  espera  <BASE>show.mp4, <BASE>criativo.mp4 ...
// Vazio = usa a versão HD (1080p) ou a prévia que já estão em media/reel/.
const FULL_BASE = '';
const EASE = 'cubic-bezier(.22,1,.36,1)';
const ICON = {
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor"/><path d="M16 10l5 5M21 10l-5 5"/></svg>',
};

export function createLightbox(manifest, { onOpen = () => {}, onClose = () => {} } = {}) {
  if (!manifest || !manifest.videos.length) return null;
  const data = manifest.videos.map(v => ({
    i: v.i, slug: v.slug, title: v.title, meta: v.meta, cat: v.catLabel, hevc: !!v.hevc, yt: v.yt || '', driveUrl: v.driveUrl || '',
    ratio: v.ratio || 9 / 16, play: v.playUrl, preview: v.previewUrl, clip: v.clipUrl, poster: v.posterUrl,
  }));
  const ALL = data.filter(d => d.play || d.yt || d.driveUrl).map(d => d.i);

  const dlg = document.createElement('dialog');
  dlg.className = 'reel-dialog'; dlg.setAttribute('aria-label', 'Vídeo em tela cheia');
  dlg.innerHTML = `
    <button class="reel-x" type="button" aria-label="Fechar">Fechar <span aria-hidden="true">✕</span></button>
    <a class="reel-drive" target="_blank" rel="noopener" hidden>Original no Drive <span aria-hidden="true">↗</span></a>
    <figure class="reel-stage">
      <video playsinline controls controlsList="nodownload" preload="auto"></video>
      <iframe class="reel-yt" title="Vídeo completo" hidden allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <a class="reel-empty" target="_blank" rel="noopener" hidden><span>Vídeo completo no Drive</span><b aria-hidden="true">↗</b></a>
      <div class="reel-story" hidden>
        <div class="reel-segs"></div>
        <p class="reel-who"><span class="reel-ava" aria-hidden="true">WR</span><b>willrec_oficial</b><span class="reel-lbl"></span></p>
        <button class="reel-snd" type="button" aria-pressed="true" aria-label="Desativar som">${ICON.on}</button>
        <button class="reel-zone reel-zone--prev" type="button" aria-label="Vídeo anterior"></button>
        <button class="reel-zone reel-zone--next" type="button" aria-label="Próximo vídeo"></button>
      </div>
    </figure>
    <div class="reel-ctl">
      <button class="reel-nav" type="button" data-d="-1" aria-label="Vídeo anterior">←</button>
      <p class="reel-now" aria-live="polite"><b></b><strong></strong><small></small></p>
      <button class="reel-nav" type="button" data-d="1" aria-label="Próximo vídeo">→</button>
    </div>`;
  document.body.appendChild(dlg);
  const stage = $('.reel-stage', dlg), lv = $('video', dlg), ytf = $('.reel-yt', dlg), empty = $('.reel-empty', dlg), driveBtn = $('.reel-drive', dlg);
  const story = $('.reel-story', dlg), segs = $('.reel-segs', dlg), lbl = $('.reel-lbl', dlg), snd = $('.reel-snd', dlg);
  const nowN = $('.reel-now b', dlg), nowT = $('.reel-now strong', dlg), nowM = $('.reel-now small', dlg);
  let list = ALL, pos = 0, stories = false, originEl = null, raf = 0, soundOn = true;

  const canHevc = () => {
    const p = document.createElement('video');
    return !!(p.canPlayType('video/mp4; codecs="hvc1.1.6.L153.B0"') || p.canPlayType('video/mp4; codecs="hvc1.2.4.L153.B0"'));
  };
  const sourcesFor = d => [...new Set([(FULL_BASE && (!d.hevc || canHevc())) ? `${FULL_BASE}${d.slug}.mp4` : '', d.play, d.preview, d.clip].filter(Boolean))];
  // elemento de origem/destino da animação: o card do feed ou o bloco da grade com o mesmo vídeo
  const frameOf = i => $(`[data-feed-list] [data-i="${i}"] .rl-media`) || $(`[data-vgrid-grid] [data-i="${i}"]`);

  const paintSound = () => {
    snd.innerHTML = soundOn ? ICON.on : ICON.off;
    snd.setAttribute('aria-pressed', String(soundOn));
    snd.setAttribute('aria-label', soundOn ? 'Desativar som' : 'Ativar som');
  };
  const play = (t = 0) => {
    lv.muted = !soundOn;
    if (t) { try { lv.currentTime = t; } catch (_) {} }
    lv.play().catch(() => { lv.muted = true; soundOn = false; paintSound(); lv.play().catch(() => {}); });
  };
  const showEmpty = d => {
    lv.hidden = true; empty.hidden = false; empty.href = d.driveUrl || '#';
    stage.style.backgroundImage = d.poster ? `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url(${d.poster})` : '';
  };

  // barras dos stories
  const drawSegs = () => {
    segs.innerHTML = list.map(() => '<span><i></i></span>').join('');
    segs.style.setProperty('--n', list.length);
  };
  const tick = () => {
    raf = 0;
    if (!dlg.open || !stories) return;
    $$('i', segs).forEach((el, k) => {
      const f = k < pos ? 1 : k > pos ? 0 : (lv.duration ? lv.currentTime / lv.duration : 0);
      el.style.transform = `scaleX(${f.toFixed(4)})`;
    });
    raf = requestAnimationFrame(tick);
  };

  const load = (k, dir = 0, t = 0) => {
    pos = (k + list.length) % list.length;
    const d = data[list[pos]];
    lv.pause();
    stage.style.setProperty('--ar', d.ratio);          // o quadro segue a proporção do vídeo (9:16, 16:9...)
    stage.style.backgroundImage = ''; empty.hidden = true;
    if (d.yt) {
      lv.hidden = true; lv.removeAttribute('src'); lv.load();
      ytf.hidden = false;
      ytf.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(d.yt)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
    } else {
      ytf.hidden = true; ytf.src = 'about:blank';
      const srcs = sourcesFor(d);
      if (!srcs.length) { lv.removeAttribute('src'); lv.load(); showEmpty(d); }
      else {
        let n = 0;
        lv.hidden = false;
        lv.onerror = () => { if (++n < srcs.length) { lv.src = srcs[n]; play(); } else showEmpty(d); };
        lv.poster = d.poster; lv.src = srcs[0]; play(t);
      }
    }
    driveBtn.hidden = !d.driveUrl || stories; driveBtn.href = d.driveUrl || '#';
    nowN.textContent = `${pad(pos + 1)} / ${pad(list.length)}`; nowT.textContent = d.title; nowM.textContent = [d.cat, d.meta].filter(Boolean).join(' · ');
    if (dir && !REDUCE) stage.animate([{ opacity: 0, transform: `translateX(${dir * 40}px) scale(.96)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
    if (stories && !raf) raf = requestAnimationFrame(tick);
  };

  const open = (i, fromEl, opts = {}) => {
    if (dlg.open || !data[i]) return;
    list = (opts.list && opts.list.length ? opts.list : ALL).filter(n => data[n]);
    if (!list.includes(i)) list = [i, ...list];
    stories = !!opts.stories;
    originEl = fromEl || null;
    soundOn = true; paintSound();
    dlg.classList.toggle('is-stories', stories);
    story.hidden = !stories; lv.controls = !stories; lv.loop = false;
    if (stories) { drawSegs(); lbl.textContent = opts.label || ''; }
    onOpen();
    const src = fromEl || frameOf(i);
    const from = src ? src.getBoundingClientRect() : null;
    dlg.classList.remove('is-closing');
    dlg.showModal(); document.documentElement.classList.add('reel-lock');
    load(list.indexOf(i), 0, opts.t || 0);
    if (!REDUCE && from && from.width) {
      const to = stage.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
      stage.animate([{ transform: `translate(${dx}px,${dy}px) scale(${from.width / to.width})` }, { transform: 'none' }], { duration: 520, easing: EASE });
      $$('.reel-ctl, .reel-x', dlg).forEach(el => el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 180, easing: EASE, fill: 'backwards' }));
    }
    $('.reel-x', dlg).focus({ preventScroll: true });
  };

  const finish = () => {
    cancelAnimationFrame(raf); raf = 0;
    dlg.close(); document.documentElement.classList.remove('reel-lock');
    lv.pause(); lv.removeAttribute('src'); lv.load(); ytf.src = 'about:blank'; ytf.hidden = true; lv.hidden = false;
    const was = list[pos];
    onClose(was);
  };
  const close = () => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    lv.pause(); ytf.src = 'about:blank';
    const target = (originEl && originEl.isConnected) ? originEl : frameOf(list[pos]);
    const r = target && target.getBoundingClientRect();
    if (REDUCE || !r || !r.width || r.bottom < 0 || r.top > innerHeight) return finish();
    dlg.classList.add('is-closing');
    const from = stage.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (from.left + from.width / 2), dy = r.top + r.height / 2 - (from.top + from.height / 2);
    const a = stage.animate([{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${r.width / from.width})` }], { duration: 400, easing: EASE, fill: 'forwards' });
    a.finished.then(() => { a.cancel(); finish(); }, finish);
  };
  const step = d => {
    if (!dlg.open) return;
    if (stories && d > 0 && pos === list.length - 1) return close();   // fim dos stories
    if (stories && d < 0 && pos === 0) { play(0); try { lv.currentTime = 0; } catch (_) {} return; }
    originEl = null; load(pos + d, d);
  };

  lv.addEventListener('ended', () => { if (stories) step(1); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  $('.reel-x', dlg).addEventListener('click', close);
  $$('.reel-nav', dlg).forEach(b => b.addEventListener('click', () => step(+b.dataset.d)));
  $('.reel-zone--prev', dlg).addEventListener('click', () => step(-1));
  $('.reel-zone--next', dlg).addEventListener('click', () => step(1));
  snd.addEventListener('click', () => { soundOn = !soundOn; paintSound(); lv.muted = !soundOn; if (soundOn && lv.paused) play(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  return { open, close, isOpen: () => dlg.open };
}
