// Navegação dentro da página — menu de baixo, logo, "Ver trabalhos", "Pedir orçamento", link de pular.
//  · rola suave até a seção certa, descontando a barra de cima (o título não fica escondido atrás dela);
//  · "Início" volta ao topo (abertura no passo 1);
//  · o endereço vira #secao sem criar uma entrada no histórico a cada toque (o "voltar" do celular sai do site
//    em vez de andar de seção em seção);
//  · o foco vai para a seção: quem usa teclado ou leitor de tela continua dali.
// Links #v-slug (vídeo) ficam com o main.js, que abre o vídeo.
import { REDUCE } from './util.js';

const TOP = new Set(['', 'inicio', 'topo']);

// posição final da seção: topo dela menos o scroll-margin-top do CSS (altura da barra)
function targetY(el) {
  if (!el) return 0;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  return Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - margin));
}

export function goTo(id, { instant = false, focus = true } = {}) {
  const el = TOP.has(id) ? null : document.getElementById(id);
  if (!el && !TOP.has(id)) return false;
  scrollTo({ top: targetY(el), behavior: instant || REDUCE ? 'auto' : 'smooth' });
  try { history.replaceState(history.state, '', TOP.has(id) ? location.pathname + location.search : `#${id}`); } catch (_) {}
  if (focus) {
    const f = el || document.getElementById('inicio');
    if (f) {
      if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1');
      f.focus({ preventScroll: true });
    }
  }
  return true;
}

export function initNav() {
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (id.startsWith('v-')) return;                       // vídeo: main.js
    if (goTo(id)) e.preventDefault();
  });
}
