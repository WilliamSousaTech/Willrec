// Tema claro / escuro — botão sol/lua na barra superior.
//  · padrão: claro (o visual principal do site); a escolha fica salva neste aparelho (localStorage);
//  · o <head> já aplica a escolha salva antes de desenhar a página (sem "piscar" ao abrir);
//  · a cor da barra do navegador (theme-color) e a assinatura WILLREC em canvas acompanham o tema.
const KEY = 'willrec-theme';
const root = document.documentElement;

export const currentTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

function apply(theme, save) {
  root.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#000000' : '#ffffff';
  document.querySelectorAll('[data-theme-toggle]').forEach(b => {
    b.setAttribute('aria-pressed', String(theme === 'dark'));
    b.setAttribute('aria-label', theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro');
    b.title = theme === 'dark' ? 'Tema claro' : 'Tema escuro';
  });
  // assinatura WILLREC (canvas): troca a cor das letras
  document.querySelectorAll('[data-tech-text]').forEach(el => {
    const color = theme === 'dark' ? (el.dataset.colorDark || el.dataset.color) : el.dataset.color;
    if (color) el.dispatchEvent(new CustomEvent('tt:set', { detail: { color } }));
  });
  if (save) { try { localStorage.setItem(KEY, theme); } catch (_) {} }
}

export function initTheme() {
  apply(currentTheme(), false);
  document.querySelectorAll('[data-theme-toggle]').forEach(b => b.addEventListener('click', () => {
    root.classList.add('theme-anim');
    apply(currentTheme() === 'dark' ? 'light' : 'dark', true);
    setTimeout(() => root.classList.remove('theme-anim'), 450);
  }));
}
