// js/videos.js — portfólio a partir de data/videos.json
//  · carrega o manifesto (feed de Reels, grade, links do Drive por categoria);
//  · monta a grade com TODOS os vídeos (aba "Grade"): só capas (imagens), o vídeo só carrega quando a pessoa clica.
//  O feed vertical de Reels fica em js/feed.js; o tela cheia, em js/lightbox.js.
import { $, $$ } from './util.js';

const MEDIA = 'media/reel/';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "formato" do vídeo em data/videos.json → proporção. Aceita "9:16", "16:9", "1:1", "4:5", "4x5"... Padrão: 9:16 (Reels).
const ratioOf = f => {
  const m = String(f || '9:16').match(/^\s*(\d+(?:\.\d+)?)\s*[:x\/]\s*(\d+(?:\.\d+)?)\s*$/);
  const r = m ? +m[1] / +m[2] : 9 / 16;
  return r > 0 && isFinite(r) ? r : 9 / 16;
};
const orientOf = r => (r > 1.05 ? 'h' : r < .95 ? 'v' : 'q');   // horizontal · vertical · quadrado

export async function loadManifest() {
  try {
    const res = await fetch('data/videos.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const m = await res.json();
    const cats = Object.fromEntries((m.categories || []).map(c => [c.id, c]));
    const videos = (m.videos || []).map((v, i) => {
      const ratio = ratioOf(v.formato), orient = orientOf(ratio);
      // tamanho de referência da capa (só a proporção importa: evita salto de layout enquanto carrega)
      const [pw, ph] = orient === 'h' ? [960, Math.round(960 / ratio)] : orient === 'q' ? [720, 720] : [540, Math.round(540 / ratio)];
      return {
      ...v, i, ratio: +ratio.toFixed(4), orient, pw, ph,
      catLabel: (cats[v.cat] && cats[v.cat].label) || '',
      driveUrl: v.drive || (cats[v.cat] && cats[v.cat].drive) || m.driveRoot || '',
      posterUrl: v.poster ? `${MEDIA}${v.slug}.webp` : '',
      clipUrl: v.clip ? `${MEDIA}${v.slug}-card.mp4` : '',
      previewUrl: v.preview ? `${MEDIA}${v.slug}-preview.mp4` : '',
      };
    });
    const feedMax = Number.isFinite(+m.feedMax) ? +m.feedMax : 0;
    return { driveRoot: m.driveRoot || '', categories: m.categories || [], cats, videos, feedMax };
  } catch (err) {
    console.warn('[videos] data/videos.json indisponível:', err && err.message || err);
    return null;
  }
}

// ── links do Drive: cada painel de categoria abre a sua pasta (ou a raiz, se ainda não houver link) ──
export function applyDriveLinks(m) {
  $$('[data-drive-link]').forEach(a => {
    const key = a.dataset.driveLink;
    const c = key && m.cats[key];
    a.href = (c && c.drive) || m.driveRoot || a.href;
  });
}

// ── grade "Ver todos os vídeos" ──
export function initGrid(m, openVideo) {
  const root = $('[data-vgrid]');
  if (!root) return;
  const body = $('[data-vgrid-body]', root), chips = $('[data-vgrid-chips]', root), grid = $('[data-vgrid-grid]', root);
  const toggle = $('[data-vgrid-toggle]', root), count = $('[data-vgrid-count]');   // o total aparece na aba "Grade"
  const usadas = m.categories.filter(c => m.videos.some(v => v.cat === c.id));
  let filtro = 'todos';

  chips.innerHTML = [`<button type="button" class="vchip is-on" data-cat="todos">Todos <small>${m.videos.length}</small></button>`]
    .concat(usadas.map(c => `<button type="button" class="vchip" data-cat="${esc(c.id)}">${esc(c.label)} <small>${m.videos.filter(v => v.cat === c.id).length}</small></button>`)).join('');

  const draw = () => {
    const vs = m.videos.filter(v => filtro === 'todos' || v.cat === filtro);
    grid.innerHTML = vs.map(v => `
      <li class="is-${v.orient}" style="--ar:${v.ratio}">
        <button type="button" class="vtile${v.poster ? '' : ' no-poster'}" data-i="${v.i}" aria-label="Abrir vídeo: ${esc(v.title)}">
          <span class="vtile-img">${v.poster ? `<img src="${MEDIA}${esc(v.slug)}.webp" alt="" loading="lazy" decoding="async" width="${v.pw}" height="${v.ph}">` : `<span class="vtile-ph">${esc(v.title)}</span>`}
            <span class="vtile-play" aria-hidden="true"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 2.5v15l13-7.5z"/></svg></span>
          </span>
          <span class="vtile-cap"><strong>${esc(v.title)}</strong><em>${esc(v.catLabel)} · ${esc(v.meta)}</em>${v.desc && v.orient !== 'v' ? `<span class="vtile-desc">${esc(v.desc)}</span>` : ''}</span>
        </button>
      </li>`).join('');
  };
  draw();
  if (count) count.textContent = m.videos.length;

  chips.addEventListener('click', e => {
    const b = e.target.closest('.vchip'); if (!b) return;
    filtro = b.dataset.cat;
    $$('.vchip', chips).forEach(x => x.classList.toggle('is-on', x === b));
    draw();
  });
  grid.addEventListener('click', e => {
    const b = e.target.closest('.vtile'); if (!b) return;
    openVideo(+b.dataset.i, b.querySelector('.vtile-img') || b);
  });
  // botão "Ver todos" é opcional: na aba Grade a lista já fica aberta
  if (toggle && body) toggle.addEventListener('click', () => {
    const abrir = body.hidden;
    body.hidden = !abrir;
    toggle.setAttribute('aria-expanded', String(abrir));
    toggle.querySelector('span').textContent = abrir ? 'Ocultar vídeos' : 'Ver todos os vídeos';
  });
}
