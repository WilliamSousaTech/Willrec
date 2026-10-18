// "Quem sou eu?" — cartão interativo da seção Sobre.
//  · clique/toque na foto troca de foto com "flash de câmera";
//  · no mouse, a janela da foto inclina seguindo o cursor, com brilho que acompanha;
//  · adesivos (estrela, brilho e etiquetas) podem ser arrastados e ficam onde você soltar; duplo clique devolve ao lugar.
// Movimento reduzido: sem inclinação nem giro contínuo; a troca de foto e o arrastar continuam (são ações da pessoa).
import { $, $$, clamp, REDUCE, FINE } from './util.js';

export function initQuemSou() {
  const root = $('[data-qs]');
  if (!root) return;

  // ── troca de foto ─────────────────────────────────────────────
  const win = $('[data-qs-window]', root), imgs = $$('.qs-shot img', root), count = $('[data-qs-count]', root);
  let cur = 0, snapT = 0;
  const flip = () => {
    imgs[cur].classList.remove('is-on');
    cur = (cur + 1) % imgs.length;
    imgs[cur].classList.add('is-on');
    if (count) count.textContent = `${cur + 1} / ${imgs.length}`;
    root.classList.add('is-snap');
    clearTimeout(snapT); snapT = setTimeout(() => root.classList.remove('is-snap'), 260);
  };
  win.addEventListener('click', flip);

  // ── inclinação 3D (só mouse) ──────────────────────────────────
  if (FINE && !REDUCE) {
    const photo = $('.qs-photo', root);
    let raf = 0, px = .5, py = .5;
    const apply = () => {
      raf = 0;
      win.style.setProperty('--rx', ((py - .5) * -12).toFixed(2) + 'deg');
      win.style.setProperty('--ry', ((px - .5) * 14).toFixed(2) + 'deg');
      win.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      win.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    };
    photo.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = win.getBoundingClientRect();
      px = clamp((e.clientX - r.left) / r.width); py = clamp((e.clientY - r.top) / r.height);
      win.classList.add('is-tilt');
      if (!raf) raf = requestAnimationFrame(apply);
    });
    photo.addEventListener('pointerleave', () => {
      win.classList.remove('is-tilt'); px = py = .5;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  }

  // ── adesivos arrastáveis ──────────────────────────────────────
  const drag = el => {
    let tx = 0, ty = 0, st = null;
    el.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      const rr = root.getBoundingClientRect(), er = el.getBoundingClientRect();
      st = {
        id: e.pointerId, x: e.clientX, y: e.clientY, tx, ty,
        minX: tx - (er.left - rr.left), maxX: tx + (rr.right - er.right),
        minY: ty - (er.top - rr.top), maxY: ty + (rr.bottom - er.bottom)
      };
      el.classList.add('is-drag'); el.classList.remove('is-drop');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      tx = clamp(st.tx + dx, st.minX, st.maxX); ty = clamp(st.ty + dy, st.minY, st.maxY);
      el.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
      el.style.setProperty('--tilt', clamp(dx * .15, -16, 16).toFixed(1) + 'deg');   // balança ao arrastar
    });
    const end = e => {
      if (!st || (e && e.pointerId !== st.id)) return;
      st = null; el.classList.remove('is-drag'); el.classList.add('is-drop');
      el.style.setProperty('--tilt', '0deg');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => {            // duplo clique/toque: volta ao lugar
      tx = ty = 0; el.classList.add('is-drop'); el.style.translate = '0px 0px';
    });
  };
  $$('[data-qs-drag]', root).forEach(drag);
}
