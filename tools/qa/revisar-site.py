#!/usr/bin/env python3
"""Revisão automática do site WILLREC — clica em cada botão e link, como um cliente faria.

Uso (na pasta do projeto):
    pip install playwright && python3 -m playwright install chromium     # só na primeira vez
    python3 tools/qa/revisar-site.py                                      # testa a cópia local
    python3 tools/qa/revisar-site.py https://willrec.vercel.app/          # testa o site no ar (ou a prévia)

Confere: âncoras e links (WhatsApp, Instagram, Drive), tema claro/escuro, abertura em 2 passos, menu de baixo,
perfil, destaques (stories), abas Reels/Grade, tela cheia, feed (som, pausa, Quero assim, Enviar), Quem sou eu,
orçamento do começo ao fim, contato, links diretos (#v-video e #secao), erros no console e arquivos faltando.
Celular (390x844, tema claro) e computador (1280x800, tema escuro). Lista completa: QA_CHECKLIST.md.
"""
import asyncio, sys, json, re, os, http.server, socketserver, threading
from urllib.parse import urlparse
from playwright.async_api import async_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def start(root, port):
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def __init__(s, *a, **k): super().__init__(*a, directory=root, **k)
        def send_head(self):
            rng = self.headers.get('Range')
            path = self.translate_path(self.path.split('?')[0])
            if not rng or not os.path.isfile(path):
                return super().send_head()
            m = re.match(r'bytes=(\d*)-(\d*)', rng)
            size = os.path.getsize(path)
            a = int(m.group(1)) if m.group(1) else 0
            b = int(m.group(2)) if m.group(2) else size - 1
            b = min(b, size - 1)
            f = open(path, 'rb'); f.seek(a)
            self.send_response(206)
            self.send_header('Content-Type', self.guess_type(path))
            self.send_header('Content-Range', f'bytes {a}-{b}/{size}')
            self.send_header('Content-Length', str(b - a + 1))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()
            self._left = b - a + 1
            return f
        def copyfile(self, src, dst):
            left = getattr(self, '_left', None)
            if left is None: return super().copyfile(src, dst)
            while left > 0:
                chunk = src.read(min(65536, left))
                if not chunk: break
                try: dst.write(chunk)
                except (BrokenPipeError, ConnectionResetError): break
                left -= len(chunk)
            self._left = None
    socketserver.TCPServer.allow_reuse_address = True
    socketserver.BaseServer.handle_error = lambda *a: None
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', port), H); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


ARG = sys.argv[1] if len(sys.argv) > 1 else ''
if ARG.startswith('http'):
    U = ARG if ARG.endswith('/') else ARG + '/'
    LOCAL = False
else:
    PORT = 8765
    start(ROOT, PORT); U = f'http://127.0.0.1:{PORT}/'
    LOCAL = True
HOST = urlparse(U).netloc
WARN = []
R = []
def check(view, name, ok, detail=''):
    R.append((view, name, bool(ok), detail)); print(f"  [{'OK ' if ok else 'ERR'}] {name}" + (f" — {detail}" if detail and not ok else ''), flush=True)

async def wait_scroll(pg, ms=1600): await pg.wait_for_timeout(ms)
async def dialog_open(pg): return await pg.evaluate("!!document.querySelector('dialog.reel-dialog[open]')")

async def run(b, w, h, theme):
    mob = w < 900; view = f'{w}x{h}/{theme}'
    print(f'== {view}')
    ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob, permissions=['clipboard-read', 'clipboard-write'])
    await ctx.add_init_script(f"try{{localStorage.setItem('willrec-theme','{theme}')}}catch(e){{}}")
    pg = await ctx.new_page(); errs, bad = [], []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 and '/api/quote' not in r.url and urlparse(r.url).netloc == HOST else None)
    pg.on('requestfailed', lambda r: (WARN.append(f'{view}: {r.url[:90]} ({r.failure})') if urlparse(r.url).netloc != HOST else (None if 'ERR_ABORTED' in (r.failure or '') else bad.append(f'falhou {r.url} {r.failure}'))))
    await pg.goto(U, wait_until='networkidle'); await pg.wait_for_timeout(1800)
    await pg.evaluate('document.documentElement.style.scrollBehavior="auto"')
    tap = (lambda sel: pg.tap(sel)) if mob else (lambda sel: pg.click(sel))

    # 1) links: âncoras existem, _blank com noopener, WhatsApp com número e texto
    inv = await pg.evaluate("""(()=>{const out={missing:[],noopener:[],wa:[],empty:[]};
      document.querySelectorAll('a[href]').forEach(a=>{const h=a.getAttribute('href');
        if(h.startsWith('#')&&h.length>1&&!h.startsWith('#v-')&&!document.getElementById(decodeURIComponent(h.slice(1))))out.missing.push(h);
        if(a.target==='_blank'&&!/noopener/.test(a.rel))out.noopener.push(h);
        if(/wa\\.me/.test(h)&&!/wa\\.me\\/55\\d{10,11}\\?text=./.test(h))out.wa.push(h);
        if(!(a.textContent.trim()||a.getAttribute('aria-label')))out.empty.push(h)});
      document.querySelectorAll('button').forEach(b=>{if(!(b.textContent.trim()||b.getAttribute('aria-label'))&&b.offsetParent)out.empty.push('button.'+b.className)});
      return out})()""")
    check(view, 'âncoras internas apontam para seções que existem', not inv['missing'], inv['missing'])
    check(view, 'links externos abrem em nova aba com rel=noopener', not inv['noopener'], inv['noopener'])
    check(view, 'links do WhatsApp com número e mensagem', not inv['wa'], inv['wa'][:3])
    check(view, 'todo link/botão tem nome acessível', not inv['empty'], inv['empty'][:5])

    # 2) tema claro/escuro
    before = await pg.evaluate("document.documentElement.dataset.theme||'light'")
    await tap('[data-theme-toggle]'); await pg.wait_for_timeout(500)
    after = await pg.evaluate("[document.documentElement.dataset.theme, document.querySelector('[data-theme-toggle]').getAttribute('aria-pressed'), localStorage.getItem('willrec-theme')]")
    check(view, 'botão de tema troca e salva', after[0] != before and after[2] == after[0] and after[1] == str(after[0] == 'dark').lower(), after)
    await tap('[data-theme-toggle]'); await pg.wait_for_timeout(400)

    # 3) abertura: passo 2 → "Ver trabalhos" leva ao portfólio
    pin = await pg.evaluate("document.querySelector('[data-hero]').offsetHeight-document.querySelector('[data-stage]').offsetHeight")
    await pg.evaluate(f'scrollTo(0,{pin})'); await pg.wait_for_timeout(400)
    vis = await pg.evaluate("[getComputedStyle(document.querySelector('.hero-actions')).opacity, getComputedStyle(document.querySelector('.hero-actions')).pointerEvents]")
    check(view, 'passo 2 da abertura mostra os botões (clicáveis)', float(vis[0]) > .95 and vis[1] == 'auto', vis)
    await pg.evaluate('document.documentElement.style.scrollBehavior=""')
    await tap('.hero-actions a[href="#portfolio"]'); await wait_scroll(pg)
    top = await pg.evaluate("Math.round(document.getElementById('portfolio').getBoundingClientRect().top)")
    check(view, '"Ver trabalhos" leva ao portfólio', abs(top - 60) <= 3, top)
    wa_hero = await pg.evaluate("document.querySelector('.hero-actions a[data-wa-link]').href")
    check(view, '"Orçamento no WhatsApp" (abertura) abre o WhatsApp', 'wa.me/5586995419670?text=' in wa_hero)

    # 4) menu de baixo (dock) — cada item leva à seção
    for sid in ['portfolio', 'sobre', 'servicos', 'orcamento', 'contato', 'inicio']:
        await tap(f'.dock-item[data-section="{sid}"]'); await wait_scroll(pg, 1700)
        r = await pg.evaluate("(id)=>[Math.round(scrollY),Math.round(document.getElementById(id).getBoundingClientRect().top),(document.querySelector('.dock-item[aria-current]')||{dataset:{}}).dataset.section]", sid)
        ok = r[0] == 0 if sid == 'inicio' else abs(r[1] - 60) <= 3
        check(view, f'menu "{sid}" leva à seção certa e marca o item', ok and r[2] == sid, r)
    # logo da barra → topo
    await pg.evaluate("document.documentElement.style.scrollBehavior='auto';scrollTo(0,5000);document.documentElement.style.scrollBehavior=''"); await pg.wait_for_timeout(300)
    await tap('.bar-brand'); await wait_scroll(pg)
    check(view, 'logo WILLREC da barra volta ao topo', await pg.evaluate('scrollY') == 0)

    # 5) perfil: Pedir orçamento → seção do orçamento; Mensagem/Seguir/Drive com destino certo
    await pg.evaluate("document.documentElement.style.scrollBehavior='auto';document.getElementById('portfolio').scrollIntoView();document.documentElement.style.scrollBehavior=''"); await pg.wait_for_timeout(500)
    await tap('.ig-btns a[href="#orcamento"]'); await wait_scroll(pg)
    top = await pg.evaluate("Math.round(document.getElementById('orcamento').getBoundingClientRect().top)")
    check(view, '"Pedir orçamento" (perfil) leva ao orçamento', abs(top - 60) <= 3, top)
    hrefs = await pg.evaluate("[...document.querySelectorAll('.ig-btns a, .ig-link')].map(a=>a.href)")
    check(view, 'perfil: Mensagem (WhatsApp), Seguir (Instagram), Drive', any('wa.me' in x for x in hrefs) and any('instagram.com/willrec_oficial' in x for x in hrefs) and any('drive.google.com' in x for x in hrefs), hrefs)

    # 6) destaques → stories
    await pg.evaluate("document.documentElement.style.scrollBehavior='auto';document.getElementById('portfolio').scrollIntoView()"); await pg.wait_for_timeout(500)
    n_hl = await pg.evaluate("document.querySelectorAll('.ig-hl .hl').length")
    check(view, 'destaques por categoria aparecem', n_hl >= 5, n_hl)
    await tap('.ig-hl .hl'); await pg.wait_for_timeout(1400)
    st = await pg.evaluate("(()=>{const d=document.querySelector('dialog.reel-dialog');return {open:d.open,story:!d.querySelector('.reel-story').hidden,src:d.querySelector('video').currentSrc,segs:d.querySelectorAll('.reel-segs > *').length,t:d.querySelector('.reel-now strong').textContent}})()")
    check(view, 'destaque abre os vídeos como stories', st['open'] and st['story'] and st['src'] and st['segs'] >= 1, st)
    if st['segs'] > 1:
        t0 = st['t']; await tap('.reel-zone--next'); await pg.wait_for_timeout(900)
        t1 = await pg.evaluate("document.querySelector('.reel-now strong').textContent")
        check(view, 'stories: toque à direita passa para o próximo', t1 != t0, [t0, t1])
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(700)
    check(view, 'Esc fecha o tela cheia', not await dialog_open(pg))

    # 7) abas → Grade → abre vídeo → próximo → fechar
    await tap('#tab-grade'); await pg.wait_for_timeout(500)
    g = await pg.evaluate("[!document.getElementById('panel-grade').hidden, document.querySelectorAll('.vgrid-list .vtile').length, document.getElementById('tab-grade').getAttribute('aria-selected')]")
    check(view, 'aba Grade mostra todos os vídeos', g[0] and g[1] >= 20 and g[2] == 'true', g)
    await pg.evaluate("document.querySelectorAll('.vgrid-list .vtile')[2].scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
    tiles = await pg.query_selector_all('.vgrid-list .vtile')
    await (tiles[2].tap() if mob else tiles[2].click()); await pg.wait_for_timeout(1500)
    d = await pg.evaluate("(()=>{const d=document.querySelector('dialog.reel-dialog');const v=d.querySelector('video');return {open:d.open,t:d.querySelector('.reel-now strong').textContent,src:v.currentSrc.split('/').pop(),ready:v.readyState}})()")
    check(view, 'bloco da grade abre o vídeo em tela cheia', d['open'] and d['src'] and d['ready'] >= 1, d)
    await tap('.reel-ctl .reel-nav[data-d="1"]'); await pg.wait_for_timeout(900)
    t2 = await pg.evaluate("document.querySelector('.reel-now strong').textContent")
    check(view, 'seta → passa para o próximo vídeo', t2 != d['t'], [d['t'], t2])
    await tap('.reel-x'); await pg.wait_for_timeout(800)
    check(view, 'botão Fechar fecha o tela cheia', not await dialog_open(pg))
    await tap('#tab-reels'); await pg.wait_for_timeout(500)

    # 8) feed de Reels
    await pg.evaluate("document.querySelector('.feed-list .rl').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(2500)
    f = await pg.evaluate("(()=>{const v=document.querySelector('.feed-list .rl video');return {src:(v.currentSrc||'').split('/').pop(),paused:v.paused,muted:v.muted,t:v.currentTime}})()")
    check(view, 'primeiro Reel toca sozinho (mudo)', f['src'] and not f['paused'] and f['muted'], f)
    await tap('.feed-list .rl .rl-snd'); await pg.wait_for_timeout(500)
    s = await pg.evaluate("(()=>{const r=document.querySelector('.feed-list .rl');return [r.querySelector('video').muted, r.querySelector('.rl-snd').getAttribute('aria-pressed')]})()")
    check(view, 'botão de som liga o áudio', s[0] is False and s[1] == 'true', s)
    await tap('.feed-list .rl .rl-tap'); await pg.wait_for_timeout(400)
    p1 = await pg.evaluate("document.querySelector('.feed-list .rl video').paused")
    await tap('.feed-list .rl .rl-tap'); await pg.wait_for_timeout(600)
    p2 = await pg.evaluate("document.querySelector('.feed-list .rl video').paused")
    check(view, 'toque no vídeo pausa e continua', p1 is True and p2 is False, [p1, p2])
    await tap('.feed-list .rl [data-full]'); await pg.wait_for_timeout(1300)
    full = await pg.evaluate("(()=>{const d=document.querySelector('dialog.reel-dialog');return {open:d.open,t:d.querySelector('video').currentTime}})()")
    check(view, '"Tela cheia" abre o vídeo (continua de onde estava)', full['open'] and full['t'] > 0.2, full)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(700)
    wa = await pg.evaluate("document.querySelector('.feed-list .rl .rl-act--wa').href")
    check(view, '"Quero assim" abre o WhatsApp citando o vídeo', 'wa.me/5586995419670?text=' in wa and 'Espet' in wa, wa[:90])
    await tap('.feed-list .rl [data-share]'); await pg.wait_for_timeout(700)
    tst = await pg.evaluate("(()=>{const t=document.querySelector('.toast');return t?[t.textContent,t.classList.contains('is-on')]:null})()")
    check(view, '"Enviar" copia/compartilha o link do vídeo', tst and tst[1], tst)
    await pg.evaluate("document.querySelector('.rl-end').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(600)
    await tap('.rl-end [data-go-grid]'); await pg.wait_for_timeout(700)
    gg = await pg.evaluate("[document.getElementById('tab-grade').getAttribute('aria-selected'), Math.round(document.getElementById('panel-grade').getBoundingClientRect().top)]")
    check(view, 'fim do feed: "Ver todos os vídeos" abre a Grade', gg[0] == 'true' and gg[1] < h, gg)
    await tap('#tab-reels'); await pg.wait_for_timeout(400)

    # 9) Quem sou eu: trocar foto
    await pg.evaluate("document.querySelector('[data-qs-window]').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(600)
    c0 = await pg.evaluate("document.querySelector('[data-qs-count]').textContent")
    await tap('[data-qs-window]'); await pg.wait_for_timeout(900)
    c1 = await pg.evaluate("document.querySelector('[data-qs-count]').textContent")
    check(view, '"Quem sou eu?": toque troca a foto', c0 != c1, [c0, c1])
    gv = await pg.evaluate("(()=>{const v=document.querySelector('[data-lazy-video]');v.scrollIntoView({block:'center'});return 1})()"); await pg.wait_for_timeout(2500)
    gv = await pg.evaluate("(()=>{const v=document.querySelector('[data-lazy-video]');const img=document.querySelector('.sobre-media .media-img');return {src:v.currentSrc.split('/').pop(),paused:v.paused,img:!!img}})()")
    check(view, 'vídeo do Will (gimbal) carrega e toca', (gv['src'] and not gv['paused']) or gv['img'], gv)

    # 10) orçamento (quiz) do começo ao fim
    await pg.evaluate("document.getElementById('quiz-root').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(400)
    steps = 0
    for _ in range(10):
        if await pg.query_selector('#q-nome'): break
        opt = await pg.query_selector('#quiz-root .quiz-opt')
        if not opt: break
        await (opt.tap() if mob else opt.click()); await pg.wait_for_timeout(600); steps += 1
    has_lead = await pg.query_selector('#q-nome')
    check(view, 'orçamento: perguntas avançam até os dados', has_lead is not None, steps)
    if has_lead:
        await tap('[data-lead-submit]'); await pg.wait_for_timeout(300)
        err_vis = await pg.evaluate("getComputedStyle(document.getElementById('q-lead-error')).display!=='none'")
        check(view, 'orçamento: avisa quando falta nome/contato', err_vis)
        await pg.fill('#q-nome', 'Teste Revisão'); await pg.fill('#q-contato', '@teste')
        await tap('[data-lead-submit]'); await pg.wait_for_timeout(2600)
        res = await pg.evaluate("(()=>{const r=document.querySelector('#quiz-root .quiz-result');if(!r)return null;const a=r.querySelector('a[href*=\"wa.me\"]');return {price:(r.querySelector('.result-price')||{}).textContent,wa:a&&a.href.slice(0,60)}})()")
        check(view, 'orçamento: mostra a faixa de preço e o botão do WhatsApp', res and res['price'] and res['wa'], res)
        back = await pg.query_selector('[data-restart]')
        if back:
            await (back.tap() if mob else back.click()); await pg.wait_for_timeout(500)
            check(view, 'orçamento: "Refazer" volta à 1ª pergunta', await pg.evaluate("!!document.querySelector('#quiz-root .quiz-opt')"))

    # 11) contato
    ch = await pg.evaluate("[...document.querySelectorAll('#contato a')].map(a=>a.href)")
    check(view, 'contato: WhatsApp, Instagram e Drive', any('wa.me' in x for x in ch) and any('instagram.com' in x for x in ch) and any('drive.google' in x for x in ch), ch)
    yr = await pg.evaluate("document.getElementById('year').textContent")
    check(view, 'rodapé com o ano atual', yr == '2026', yr)

    check(view, 'sem erros no console', not errs, errs[:3])
    check(view, 'nenhum arquivo faltando (404)', not bad, bad[:5])
    await ctx.close()

    # 12) link direto de vídeo (#v-slug) abre o vídeo
    ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); await pg.goto(U + '#v-casamento', wait_until='networkidle'); await pg.wait_for_timeout(2200)
    dl = await pg.evaluate("(()=>{const d=document.querySelector('dialog.reel-dialog');return d&&d.open?d.querySelector('.reel-now strong').textContent:null})()")
    check(view, 'link direto #v-casamento abre o vídeo', dl == 'Casamento', dl)
    await ctx.close()
    # 13) link direto de seção (#orcamento) cai na seção certa
    ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob)
    pg = await ctx.new_page(); await pg.goto(U + '#orcamento', wait_until='networkidle'); await pg.wait_for_timeout(1800)
    top = await pg.evaluate("Math.round(document.getElementById('orcamento').getBoundingClientRect().top)")
    check(view, 'link direto #orcamento cai na seção', abs(top - 60) <= 4, top)
    await ctx.close()

async def main():
    if LOCAL:   # arquivos do videos.json existem na pasta
        man = json.load(open(os.path.join(ROOT, 'data/videos.json'), encoding='utf-8'))
        miss = []
        for v in man['videos']:
            for suf, key in (('-hd.mp4', 'hd'), ('.webp', 'poster'), ('-sm.webp', 'poster'), ('-card.mp4', 'clip'), ('-preview.mp4', 'preview')):
                if v.get(key) and not os.path.exists(os.path.join(ROOT, 'media/reel', v['slug'] + suf)): miss.append(v['slug'] + suf)
        print('videos.json → arquivos faltando:', miss or 'nenhum')
        R.append(('arquivos', 'todos os vídeos/capas do videos.json existem', not miss, miss))
    async with async_playwright() as p:
        b = await p.chromium.launch()
        sizes = [(390, 844, 'light'), (1280, 800, 'dark')]
        for w, h, th in sizes: await run(b, w, h, th)
        await b.close()
    bad = [r for r in R if not r[2]]
    print(f'\nRESUMO: {len(R) - len(bad)}/{len(R)} OK')
    for r in bad: print('  ERRO', r[0], r[1], r[3])
    if WARN: print('Avisos (outros sites fora do ar ou bloqueados nesta rede):', *sorted(set(WARN))[:6], sep='\n  ')
    sys.exit(1 if bad else 0)
asyncio.run(main())
