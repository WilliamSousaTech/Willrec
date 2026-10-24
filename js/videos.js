// js/videos.js — portfólio a partir de data/videos.json
//  · carrega o manifesto (reel, grade "Ver todos", links do Drive por categoria);
//  · monta os cards do reel (só os vídeos com destaque:true e algum arquivo disponível);
//  · monta a grade com TODOS os vídeos: só capas (imagens), o vídeo só carrega quando a pessoa clica.
import { $, $$, pad } from './util.js';

const MEDIA = 'media/reel/';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function loadManifest() {
  try {
    const res = await fetch('data/videos.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const m = await res.json();
    const cats = Object.fromEntries((m.categories || []).map(c => [c.id, c]));
    const videos = (m.videos || []).map((v, i) => ({
      ...v, i,
      catLabel: (cats[v.cat] && cats[v.cat].label) || '',
      driveUrl: v.drive || (cats[v.cat] && cats[v.cat].drive) || m.driveRoot || '',
      posterUrl: v.poster ? `${MEDIA}${v.slug}.webp` : '',
      clipUrl: v.clip ? `${MEDIA}${v.slug}-card.mp4` : '',
      previewUrl: v.preview ? `${MEDIA}${v.slug}-preview.mp4` : '',
    }));
    return { driveRoot: m.driveRoot || '', categories: m.categories || [], cats, videos };
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

// ── reel ──
export function renderReel(m) {
  const track = $('[data-reel-track]');
  if (!track) return 0;
  const list = m.videos.filter(v => v.destaque && (v.clip || v.poster));
  track.innerHTML = list.map((v, pos) => `
    <li class="reel-card" data-i="${v.i}" data-pos="${pos}">
      <button type="button" class="reel-btn" aria-label="Abrir vídeo em tela cheia: ${esc(v.title)}">
        <span class="reel-frame"${v.poster ? ` style="background-image:url(${MEDIA}${esc(v.slug)}.webp)"` : ''}>
          <video muted loop playsinline preload="none" disablepictureinpicture${v.poster ? ` poster="${MEDIA}${esc(v.slug)}.webp"` : ''}${v.clip ? ` data-src="${esc(v.clipUrl)}"` : ''}></video>
          <span class="reel-play" aria-hidden="true"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 2.5v15l13-7.5z"/></svg></span>
        </span>
        <span class="reel-cap"><b>${pad(pos + 1)}</b><strong>${esc(v.title)}</strong><em>${esc(v.meta)}</em></span>
      </button>
    </li>`).join('');
  const total = $('[data-reel-total]');
  if (total) total.textContent = pad(list.length);
  return list.length;
}

// ── grade "Ver todos os vídeos" ──
export function initGrid(m, openVideo) {
  const root = $('[data-vgrid]');
  if (!root) return;
  const body = $('[data-vgrid-body]', root), chips = $('[data-vgrid-chips]', root), grid = $('[data-vgrid-grid]', root);
  const toggle = $('[data-vgrid-toggle]', root), count = $('[data-vgrid-count]', root);
  const usadas = m.categories.filter(c => m.videos.some(v => v.cat === c.id));
  let filtro = 'todos';

  chips.innerHTML = [`<button type="button" class="vchip is-on" data-cat="todos">Todos <small>${m.videos.length}</small></button>`]
    .concat(usadas.map(c => `<button type="button" class="vchip" data-cat="${esc(c.id)}">${esc(c.label)} <small>${m.videos.filter(v => v.cat === c.id).length}</small></button>`)).join('');

  const draw = () => {
    const vs = m.videos.filter(v => filtro === 'todos' || v.cat === filtro);
    grid.innerHTML = vs.map(v => `
      <li>
        <button type="button" class="vtile${v.poster ? '' : ' no-poster'}" data-i="${v.i}" aria-label="Abrir vídeo: ${esc(v.title)}">
          <span class="vtile-img">${v.poster ? `<img src="${MEDIA}${esc(v.slug)}.webp" alt="" loading="lazy" decoding="async" width="540" height="960">` : `<span class="vtile-ph">${esc(v.title)}</span>`}
            <span class="vtile-play" aria-hidden="true"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 2.5v15l13-7.5z"/></svg></span>
          </span>
          <span class="vtile-cap"><strong>${esc(v.title)}</strong><em>${esc(v.catLabel)} · ${esc(v.meta)}</em></span>
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
  toggle.addEventListener('click', () => {
    const abrir = body.hidden;
    body.hidden = !abrir;
    toggle.setAttribute('aria-expanded', String(abrir));
    toggle.querySelector('span').textContent = abrir ? 'Ocultar vídeos' : 'Ver todos os vídeos';
  });
}
