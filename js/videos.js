// js/videos.js — portfólio a partir de data/videos.json
//  · carrega o manifesto (feed de Reels, grade, destaques, links do Drive);
//  · grade no estilo do perfil do Instagram (3 colunas, capas 9:16, duração no canto) — o vídeo só carrega no clique;
//  · destaques (círculos por categoria): abrem os vídeos daquela categoria em sequência, como stories.
//  O feed vertical fica em js/feed.js; o tela cheia/stories, em js/lightbox.js.
import { $, $$ } from './util.js';

const MEDIA = 'media/reel/';
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "formato" do vídeo em data/videos.json → proporção. Aceita "9:16", "16:9", "1:1", "4:5", "4x5"... Padrão: 9:16 (Reels).
const ratioOf = f => {
  const m = String(f || '9:16').match(/^\s*(\d+(?:\.\d+)?)\s*[:x\/]\s*(\d+(?:\.\d+)?)\s*$/);
  const r = m ? +m[1] / +m[2] : 9 / 16;
  return r > 0 && isFinite(r) ? r : 9 / 16;
};
const orientOf = r => (r > 1.05 ? 'h' : r < .95 ? 'v' : 'q');   // horizontal · vertical · quadrado
const durOf = meta => { const m = String(meta || '').match(/(\d+:\d{2})/); return m ? m[1] : ''; };

// Conexão lenta ou "economia de dados": prefere a versão mais leve (prévia) em vez do HD.
export const SLOW = (() => {
  const c = navigator.connection || {};
  return !!(c.saveData || /(^|-)2g$|^3g$/.test(c.effectiveType || ''));
})();

export async function loadManifest() {
  try {
    const res = await fetch('data/videos.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const m = await res.json();
    const q = m.mediaVersion ? `?v=${encodeURIComponent(m.mediaVersion)}` : '';   // força baixar capas trocadas com o mesmo nome
    const cats = Object.fromEntries((m.categories || []).map(c => [c.id, c]));
    const videos = (m.videos || []).map((v, i) => {
      const ratio = ratioOf(v.formato), orient = orientOf(ratio);
      // tamanho de referência da capa (só a proporção importa: evita salto de layout enquanto carrega)
      const [pw, ph] = orient === 'h' ? [1920, Math.round(1920 / ratio)] : orient === 'q' ? [1080, 1080] : [1080, Math.round(1080 / ratio)];
      const hdUrl = v.hd ? `${MEDIA}${v.slug}-hd.mp4` : '';
      const previewUrl = v.preview ? `${MEDIA}${v.slug}-preview.mp4` : '';
      const clipUrl = v.clip ? `${MEDIA}${v.slug}-card.mp4` : '';
      return {
        ...v, i, ratio: +ratio.toFixed(4), orient, pw, ph, dur: durOf(v.meta),
        catLabel: (cats[v.cat] && cats[v.cat].label) || '',
        catShort: (cats[v.cat] && (cats[v.cat].short || cats[v.cat].label)) || '',
        driveUrl: v.drive || (cats[v.cat] && cats[v.cat].drive) || m.driveRoot || '',
        posterUrl: v.poster ? `${MEDIA}${v.slug}.webp${q}` : '',
        posterSmUrl: v.poster ? `${MEDIA}${v.slug}-sm.webp${q}` : '',
        hdUrl, previewUrl, clipUrl,
        // o que toca no feed e no tela cheia: HD → prévia → clipe (em conexão lenta, a prévia vem primeiro)
        playUrl: (SLOW ? (previewUrl || hdUrl) : (hdUrl || previewUrl)) || clipUrl,
      };
    });
    const feedMax = Number.isFinite(+m.feedMax) ? +m.feedMax : 0;
    return { driveRoot: m.driveRoot || '', categories: m.categories || [], cats, videos, feedMax };
  } catch (err) {
    console.warn('[videos] data/videos.json indisponível:', err && err.message || err);
    return null;
  }
}

// ── links do Drive: cada link [data-drive-link] abre a sua pasta (ou a raiz, se ainda não houver link) ──
export function applyDriveLinks(m) {
  $$('[data-drive-link]').forEach(a => {
    const key = a.dataset.driveLink;
    const c = key && m.cats[key];
    a.href = (c && c.drive) || m.driveRoot || a.href;
  });
}

const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';

// ── grade (aba "Grade") — todos os vídeos com capa, na ordem do arquivo (os melhores primeiro) ──
export function initGrid(m, openVideo) {
  const grid = $('[data-vgrid-grid]');
  if (!grid) return;
  const vs = m.videos.filter(v => v.poster);
  const list = vs.map(v => v.i);
  grid.innerHTML = vs.map(v => `
    <li>
      <button type="button" class="vtile" data-i="${v.i}" aria-label="Assistir: ${esc(v.title)}${v.dur ? ` (${v.dur})` : ''}">
        <img src="${esc(v.posterSmUrl)}" alt="" loading="lazy" decoding="async" width="480" height="${Math.round(480 / v.ratio)}">
        <span class="vtile-dur" aria-hidden="true">${PLAY}${esc(v.dur)}</span>
        <span class="vtile-over" aria-hidden="true"><strong>${esc(v.title)}</strong><em>${esc(v.catLabel)}</em></span>
      </button>
    </li>`).join('');
  $$('[data-vgrid-count]').forEach(el => { el.textContent = vs.length; });
  grid.addEventListener('click', e => {
    const b = e.target.closest('.vtile'); if (!b) return;
    openVideo(+b.dataset.i, b, { list });
  });
}

// ── destaques: um círculo por categoria (capa = o melhor vídeo dela); abre os vídeos da categoria como stories ──
export function initHighlights(m, openVideo) {
  const root = $('[data-highlights]');
  if (!root) return;
  const groups = m.categories
    .map(c => ({ c, vs: m.videos.filter(v => v.cat === c.id && v.poster && v.playUrl) }))
    .filter(g => g.vs.length);
  if (!groups.length) { root.hidden = true; return; }
  root.innerHTML = groups.map((g, k) => `
    <li>
      <button type="button" class="hl" data-k="${k}" aria-label="${esc(g.c.label)}: ${g.vs.length} ${g.vs.length === 1 ? 'vídeo' : 'vídeos'}, em sequência">
        <span class="hl-ring"><img src="${esc(g.vs[0].posterSmUrl)}" alt="" loading="lazy" decoding="async" width="480" height="854"></span>
        <span class="hl-label">${esc(g.c.short || g.c.label)}</span>
      </button>
    </li>`).join('');
  root.addEventListener('click', e => {
    const b = e.target.closest('.hl'); if (!b) return;
    const g = groups[+b.dataset.k];
    b.classList.add('is-seen');
    openVideo(g.vs[0].i, $('.hl-ring', b), { list: g.vs.map(v => v.i), stories: true, label: g.c.label });
  });
}

// ── números do perfil (quantidade de vídeos sai do arquivo, nunca escrita à mão) ──
export function fillCounts(m) {
  const n = m.videos.filter(v => v.poster).length;
  $$('[data-count-videos]').forEach(el => { el.textContent = n; });
}
