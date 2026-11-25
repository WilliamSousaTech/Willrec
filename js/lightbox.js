// Lightbox — vídeo em tela cheia, compartilhado pelo feed de Reels e pela grade.
//  · abre com transição FLIP (o vídeo "cresce" a partir de onde foi tocado);
//  · toca a versão mais longa disponível: original (FULL_BASE) → prévia → clipe do card; YouTube se houver `yt`;
//  · setas/teclado navegam por TODOS os vídeos de data/videos.json;
//  · botão do Drive quando o vídeo tem link.
// Extraído do antigo js/reel.js (a faixa horizontal saiu; o tela cheia continua igual).
import { $, $$, pad, REDUCE } from './util.js';

// Vídeos originais em máxima qualidade (4K) ficam num CDN, não no repositório (arquivos > 100 MB).
// Ex.: 'https://cdn.seusite.com/reel/'  →  espera  <BASE>show.mp4, <BASE>criativo.mp4 ...
// Vazio = usa a prévia leve (540p) que já está em media/reel/.
const FULL_BASE = '';
const EASE = 'cubic-bezier(.22,1,.36,1)';

export function createLightbox(manifest, { onOpen = () => {}, onClose = () => {} } = {}) {
  if (!manifest || !manifest.videos.length) return null;
  const data = manifest.videos.map(v => ({
    slug: v.slug, title: v.title, meta: v.meta, hevc: !!v.hevc, yt: v.yt || '', driveUrl: v.driveUrl || '', ratio: v.ratio || 9 / 16,
    preview: v.previewUrl, clip: v.clipUrl, poster: v.posterUrl
  }));
  const M = data.length;

  const dlg = document.createElement('dialog');
  dlg.className = 'reel-dialog'; dlg.setAttribute('aria-label', 'Vídeo em tela cheia');
  dlg.innerHTML = `
    <button class="reel-x" type="button" aria-label="Fechar">Fechar <span aria-hidden="true">✕</span></button>
    <a class="reel-drive" target="_blank" rel="noopener" hidden>Original no Drive <span aria-hidden="true">↗</span></a>
    <figure class="reel-stage">
      <video playsinline controls controlsList="nodownload"></video>
      <iframe class="reel-yt" title="Vídeo completo" hidden allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <a class="reel-empty" target="_blank" rel="noopener" hidden><span>Vídeo completo no Drive</span><b aria-hidden="true">↗</b></a>
    </figure>
    <div class="reel-ctl">
      <button class="reel-nav" type="button" data-d="-1" aria-label="Vídeo anterior">←</button>
      <p class="reel-now"><b></b><strong></strong><small></small></p>
      <button class="reel-nav" type="button" data-d="1" aria-label="Próximo vídeo">→</button>
    </div>`;
  document.body.appendChild(dlg);
  const stage = $('.reel-stage', dlg), lv = $('video', dlg), ytf = $('.reel-yt', dlg), empty = $('.reel-empty', dlg), driveBtn = $('.reel-drive', dlg);
  const nowN = $('.reel-now b', dlg), nowT = $('.reel-now strong', dlg), nowM = $('.reel-now small', dlg);
  let cur = -1, originEl = null;

  const canHevc = () => {
    const p = document.createElement('video');
    return !!(p.canPlayType('video/mp4; codecs="hvc1.1.6.L153.B0"') || p.canPlayType('video/mp4; codecs="hvc1.2.4.L153.B0"'));
  };
  const sourcesFor = d => [(FULL_BASE && (!d.hevc || canHevc())) ? `${FULL_BASE}${d.slug}.mp4` : '', d.preview, d.clip].filter(Boolean);
  // elemento de origem/destino da animação: o card do feed ou o bloco da grade com o mesmo vídeo
  const frameOf = i => $(`[data-feed-list] [data-i="${i}"] .rl-media`) || $(`[data-vgrid-grid] [data-i="${i}"] .vtile-img`);

  const play = () => {
    lv.muted = false;
    lv.play().catch(() => { lv.muted = true; lv.play().catch(() => {}); });
  };
  const showEmpty = d => {
    lv.hidden = true; empty.hidden = false; empty.href = d.driveUrl || '#';
    stage.style.backgroundImage = d.poster ? `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)),url(${d.poster})` : '';
  };
  const load = (i, dir = 0) => {
    cur = i; const d = data[i];
    lv.pause();
    stage.style.setProperty('--ar', d.ratio);          // o quadro do tela cheia segue a proporção do vídeo (9:16, 16:9...)
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
        let k = 0;
        lv.hidden = false;
        lv.onerror = () => { if (++k < srcs.length) { lv.src = srcs[k]; play(); } else showEmpty(d); };
        lv.poster = d.poster; lv.src = srcs[0]; play();
      }
    }
    driveBtn.hidden = !d.driveUrl; driveBtn.href = d.driveUrl || '#';
    nowN.textContent = `${pad(i + 1)} / ${pad(M)}`; nowT.textContent = d.title; nowM.textContent = d.meta;
    if (dir && !REDUCE) stage.animate([{ opacity: 0, transform: `translateX(${dir * 40}px) scale(.96)` }, { opacity: 1, transform: 'none' }], { duration: 420, easing: EASE });
  };

  const open = (i, fromEl) => {
    if (dlg.open || !data[i]) return;
    originEl = fromEl || null;
    onOpen();
    const src = fromEl || frameOf(i);
    const from = src ? src.getBoundingClientRect() : null;
    dlg.classList.remove('is-closing');
    dlg.showModal(); document.documentElement.classList.add('reel-lock');
    load(i);
    if (!REDUCE && from) {
      const to = stage.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2), dy = from.top + from.height / 2 - (to.top + to.height / 2);
      stage.animate([{ transform: `translate(${dx}px,${dy}px) scale(${from.width / to.width})` }, { transform: 'none' }], { duration: 560, easing: EASE });
      $$('.reel-ctl, .reel-x', dlg).forEach(el => el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 180, easing: EASE, fill: 'backwards' }));
    }
    $('.reel-x', dlg).focus({ preventScroll: true });
  };

  const finish = () => {
    dlg.close(); document.documentElement.classList.remove('reel-lock');
    lv.pause(); lv.removeAttribute('src'); lv.load(); ytf.src = 'about:blank'; ytf.hidden = true; lv.hidden = false;
    const was = cur; cur = -1;
    onClose(was);
  };
  const close = () => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    lv.pause(); ytf.src = 'about:blank';
    const target = (originEl && originEl.isConnected) ? originEl : frameOf(cur);
    const r = target && target.getBoundingClientRect();
    if (REDUCE || !r || !r.width || r.bottom < 0 || r.top > innerHeight) return finish();
    dlg.classList.add('is-closing');
    const from = stage.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (from.left + from.width / 2), dy = r.top + r.height / 2 - (from.top + from.height / 2);
    const a = stage.animate([{ transform: 'none' }, { transform: `translate(${dx}px,${dy}px) scale(${r.width / from.width})` }], { duration: 420, easing: EASE, fill: 'forwards' });
    a.finished.then(() => { a.cancel(); finish(); }, finish);
  };
  const step = d => { if (cur < 0) return; originEl = null; load((cur + d + M) % M, d); };

  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  $('.reel-x', dlg).addEventListener('click', close);
  $$('.reel-nav', dlg).forEach(b => b.addEventListener('click', () => step(+b.dataset.d)));
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  });

  return { open, close, isOpen: () => dlg.open };
}
