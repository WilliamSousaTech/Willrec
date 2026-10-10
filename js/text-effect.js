// TextEffect — três modos só: fade · blur (fade-in-blur) · slide (palavras sobem de uma máscara).
// "letters" é o blur aplicado letra a letra, usado apenas no WILLREC.
import { $$, REDUCE } from './util.js';

function splitLetters(el) {
  const text = el.textContent; el.textContent = '';
  [...text].forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', i);
    s.setAttribute('aria-hidden', 'true');
    el.appendChild(s);
  });
}

function splitWords(el) {
  let i = 0;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'w';
        const wi = document.createElement('span'); wi.className = 'wi';
        wi.style.setProperty('--i', i++); wi.textContent = tok;
        w.appendChild(wi); frag.appendChild(w);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
  });
  walk(el);
}

export function initTextEffect() {
  const els = $$('[data-te]');
  els.forEach(el => {
    if (el.dataset.te === 'letters') splitLetters(el);
    else if (el.dataset.te === 'slide') splitWords(el);
  });
  // Elementos do Hero são disparados pelo motor do Hero (load + scroll).
  const free = els.filter(el => !el.closest('[data-stage]'));
  if (REDUCE || !('IntersectionObserver' in window)) { free.forEach(el => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: .2, rootMargin: '0px 0px -8% 0px' });
  free.forEach(el => io.observe(el));
}
