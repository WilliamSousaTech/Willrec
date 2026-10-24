// admin/admin.js — painel privado do Will Rec.
// Login Google (só as contas de ADMIN_EMAILS em firebase-config.js) + Firestore: coleções "jobs" (trabalhos) e "leads" (pedidos do site).
// A segurança de verdade está em firestore.rules (só o seu e-mail lê/escreve). Esconder a página não protege nada.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');

// ═════════ helpers puros (datas, dinheiro, WhatsApp, calendário) ═════════
export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const somaDias = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return hojeISO(new Date(y, m - 1, d + n)); };
const dataLocal = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDia = iso => dataLocal(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '');
const fmtMes = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); };

export function paraNumero(v) {
    let t = String(v ?? '').replace(/[R$\s]/g, '');
    if (!t) return 0;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = parseFloat(t);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

export function telefoneWa(v) {
    const d = String(v ?? '').replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) return '55' + d;
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
    return '';
}
const waLink = (tel, msg) => `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;

export function quandoTexto(iso, hoje = hojeISO()) {
    if (iso === hoje) return 'hoje';
    if (iso === somaDias(hoje, 1)) return 'amanhã';
    return `${dataLocal(iso).toLocaleDateString('pt-BR', { weekday: 'long' })}, ${pad(dataLocal(iso).getDate())}/${pad(dataLocal(iso).getMonth() + 1)}`;
}
export function mensagemLembrete(j, hoje = hojeISO()) {
    const nome = String(j.cliente || '').trim().split(/\s+/)[0] || '';
    const hora = j.hora ? ` às ${j.hora}` : '';
    const local = j.local ? ` em ${j.local}` : '';
    return `Oi${nome ? ', ' + nome : ''}! Passando pra confirmar a nossa gravação ${quandoTexto(j.data, hoje)}${hora}${local}. Qualquer imprevisto é só me avisar por aqui. — Will Rec`;
}

const icsEsc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsFold = l => l.length <= 70 ? l : l.match(/.{1,70}/g).join('\r\n ');
export function gerarICS(j) {
    const [y, m, d] = j.data.split('-').map(Number);
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Will Rec//Painel//PT-BR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
        `UID:${j.id || Date.now()}@willrec.vercel.app`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`];
    const desc = [j.tipo, j.cliente && `Cliente: ${j.cliente}`, j.whatsapp && `WhatsApp: ${j.whatsapp}`, j.valor && `Valor: ${brl(j.valor)}`, j.obs].filter(Boolean).join('\n');
    if (j.hora) {
        const [hh, mm] = j.hora.split(':').map(Number);
        const ini = new Date(y, m - 1, d, hh, mm), fim = new Date(ini.getTime() + 3 * 3600e3);   // 3 h por padrão: ajuste no seu calendário
        const f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
        L.push(`DTSTART:${f(ini)}`, `DTEND:${f(fim)}`);
    } else {
        const f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}`;
        L.push(`DTSTART;VALUE=DATE:${f(new Date(y, m - 1, d))}`, `DTEND;VALUE=DATE:${f(new Date(y, m - 1, d + 1))}`);
    }
    L.push(`SUMMARY:${icsEsc(`Gravação · ${j.cliente || 'Cliente'}`)}`);
    if (j.local) L.push(`LOCATION:${icsEsc(j.local)}`);
    if (desc) L.push(`DESCRIPTION:${icsEsc(desc)}`);
    const alarmes = j.hora ? ['-P1D', '-PT2H'] : ['-PT15H'];                                      // 1 dia e 2 h antes (ou 9h do dia anterior)
    for (const t of alarmes) L.push('BEGIN:VALARM', `TRIGGER:${t}`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(`Gravação · ${j.cliente || ''}`)}`, 'END:VALARM');
    L.push('END:VEVENT', 'END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
}

const PROXIMO = { pedido: ['confirmado', 'Confirmar'], confirmado: ['gravado', 'Gravado'], gravado: ['editando', 'Editando'], editando: ['entregue', 'Entregue'] };
const NOME_STATUS = { pedido: 'Pedido', confirmado: 'Confirmado', gravado: 'Gravado', editando: 'Editando', entregue: 'Entregue', cancelado: 'Cancelado' };

export function recebido(j) { return j.status === 'cancelado' ? 0 : (j.pago ? Number(j.valor) || 0 : Math.min(Number(j.sinal) || 0, Number(j.valor) || Infinity)); }
export function aReceber(j) { return j.status === 'cancelado' ? 0 : Math.max(0, (Number(j.valor) || 0) - recebido(j)); }

// ═════════ estado e Firebase ═════════
let db = null, auth = null;
let jobs = [], leads = [];
let ym = hojeISO().slice(0, 7);
let negado = '';
let unsubs = [];

const cfg = window.FIREBASE_CONFIG;
const ADMINS = (window.ADMIN_EMAILS || []).map(e => String(e).toLowerCase()).filter(e => e && !e.startsWith('seu_email'));
const configurado = !!cfg && cfg.apiKey && cfg.apiKey !== 'SUA_API_KEY_AQUI';

function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
}
const erroPermissao = err => (err && err.code === 'permission-denied')
    ? 'Sem permissão no Firestore. Publique o arquivo firestore.rules com o seu e-mail (veja o LEIA-ME).'
    : `Erro: ${err && err.message || err}`;

function mostrarGate(msg = '', erro = false) {
    $('#app').hidden = true; $('#gate').hidden = false;
    $('#gate-msg').textContent = msg || 'Área privada. Entre com a sua conta Google.';
    const e = $('#gate-err'); e.hidden = !erro; if (erro) e.textContent = msg;
}
function mostrarApp() { $('#gate').hidden = true; $('#app').hidden = false; }

// ═════════ renderização ═════════
const hoje = () => hojeISO();
const chave = j => `${j.data || '9999-99-99'} ${j.hora || '99:99'}`;

function cartaoTrabalho(j, { lembrar = true } = {}) {
    const h = hoje();
    const tel = telefoneWa(j.whatsapp);
    const aberto = !['entregue', 'cancelado'].includes(j.status);
    const prox = PROXIMO[j.status];
    const falta = aReceber(j);
    const meta = [
        j.tipo && `<span><b>${esc(j.tipo)}</b></span>`,
        j.local && `<span>📍 ${esc(j.local)}</span>`,
        j.valor ? `<span>${brl(j.valor)}${falta > 0 ? ` · falta <b>${brl(falta)}</b>` : ' · <b>pago</b>'}</span>` : ''
    ].filter(Boolean).join('');
    return `
    <li class="job${j.data === h ? ' today' : ''}${!aberto ? ' done' : ''}" data-id="${esc(j.id)}">
        <div class="job-h">
            <div><p class="job-t">${esc(j.cliente || 'Sem nome')}</p>
                <p class="job-s"><span class="pill s-${esc(j.status)}">${esc(NOME_STATUS[j.status] || j.status)}</span></p></div>
            <p class="job-time">${esc(j.hora || '—')}</p>
        </div>
        ${meta ? `<div class="job-meta">${meta}</div>` : ''}
        ${j.obs ? `<p class="job-obs">${esc(j.obs)}</p>` : ''}
        <div class="acts">
            ${lembrar && tel && aberto && j.data >= h ? `<a class="act pri" target="_blank" rel="noopener" href="${esc(waLink(tel, mensagemLembrete(j, h)))}">Lembrar cliente</a>` : ''}
            ${prox ? `<button type="button" class="act" data-act="status" data-to="${prox[0]}">→ ${prox[1]}</button>` : ''}
            ${j.data ? `<button type="button" class="act" data-act="ics">Agenda</button>` : ''}
            <button type="button" class="act" data-act="edit">Editar</button>
        </div>
    </li>`;
}

function renderAgenda() {
    const h = hoje();
    const entregar = jobs.filter(j => ['gravado', 'editando'].includes(j.status) && j.data < h).sort((a, b) => chave(a).localeCompare(chave(b)));
    const proximos = jobs.filter(j => j.data >= h && !['cancelado', 'entregue'].includes(j.status)).sort((a, b) => chave(a).localeCompare(chave(b)));
    const passados = jobs.filter(j => !entregar.includes(j) && !proximos.includes(j)).sort((a, b) => chave(b).localeCompare(chave(a)));

    let html = '';
    if (entregar.length) html += `<li class="day today">Para entregar (${entregar.length})</li>` + entregar.map(j => cartaoTrabalho(j, { lembrar: false })).join('');
    let ultimo = '';
    for (const j of proximos) {
        if (j.data !== ultimo) { ultimo = j.data; html += `<li class="day${j.data === h ? ' today' : ''}">${j.data === h ? 'Hoje · ' : j.data === somaDias(h, 1) ? 'Amanhã · ' : ''}${esc(fmtDia(j.data))}</li>`; }
        html += cartaoTrabalho(j);
    }
    $('#jobs-next').innerHTML = html;
    $('#jobs-empty').hidden = !!(entregar.length || proximos.length);

    $('#past-wrap').hidden = !passados.length;
    $('#past-count').textContent = passados.length ? `(${passados.length})` : '';
    $('#jobs-past').innerHTML = passados.map(j => cartaoTrabalho(j, { lembrar: false })).join('');

    // avisos
    const av = [];
    const dia = (iso, rot) => {
        const l = proximos.filter(j => j.data === iso);
        if (l.length) av.push(`<div class="alert"><span>🎬</span><span><b>${rot}:</b> ${l.map(j => `${esc(j.cliente)}${j.hora ? ' às ' + esc(j.hora) : ''}`).join(' · ')}</span></div>`);
    };
    dia(h, 'Hoje'); dia(somaDias(h, 1), 'Amanhã');
    if (entregar.length) av.push(`<div class="alert soft"><span>📦</span><span><b>${entregar.length}</b> trabalho(s) gravado(s) esperando entrega.</span></div>`);
    const novos = leadsNovos().length;
    if (novos) av.push(`<div class="alert soft"><span>📥</span><span><b>${novos}</b> pedido(s) novo(s) do site. <button type="button" class="link" data-goto="pedidos" style="padding:0 0 0 4px">Ver</button></span></div>`);
    $('#alerts').innerHTML = av.join('');
}

const leadsNovos = () => leads.filter(l => !['convertido', 'arquivado'].includes(l.status)).sort((a, b) => ((b.criadoEm?.seconds) || 0) - ((a.criadoEm?.seconds) || 0));

function resumoRespostas(r = {}) {
    return [r.perfil, r.subtipo, r.horas, r.local, r.prazo, r.entregavel].filter(Boolean).map(esc).join(' · ');
}
function renderLeads() {
    const l = leadsNovos();
    $('#badge-pedidos').hidden = !l.length; $('#badge-pedidos').textContent = l.length;
    $('#leads-empty').hidden = !!l.length;
    $('#leads').innerHTML = l.map(x => {
        const tel = telefoneWa(x.contato);
        const quando = x.criadoEm?.seconds ? new Date(x.criadoEm.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
        return `
        <li class="job" data-id="${esc(x.id)}">
            <div class="job-h"><div><p class="job-t">${esc(x.nome)}</p><p class="job-s">${esc(x.contato)}</p></div><p class="job-s">${esc(quando)}</p></div>
            <div class="job-meta"><span><b>${esc(x.pacote || '')}</b></span><span>${esc(x.faixaPreco || '')}</span></div>
            <p class="job-obs">${resumoRespostas(x.respostas)}</p>
            <div class="acts">
                ${tel ? `<a class="act pri" target="_blank" rel="noopener" href="${esc(waLink(tel, `Oi, ${String(x.nome).split(/\s+/)[0]}! Aqui é o Will Rec. Vi o seu pedido de orçamento no site, vamos combinar os detalhes?`))}">Responder</a>` : ''}
                <button type="button" class="act" data-act="lead-job">Virar trabalho</button>
                <button type="button" class="act" data-act="lead-arq">Arquivar</button>
            </div>
        </li>`;
    }).join('');
}

function renderDinheiro() {
    $('#m-label').textContent = fmtMes(ym);
    const lista = jobs.filter(j => (j.data || '').startsWith(ym) && j.status !== 'cancelado').sort((a, b) => chave(a).localeCompare(chave(b)));
    const total = lista.reduce((s, j) => s + (Number(j.valor) || 0), 0);
    const rec = lista.reduce((s, j) => s + recebido(j), 0);
    const falta = lista.reduce((s, j) => s + aReceber(j), 0);
    $('#stats').innerHTML = `
        <div class="stat"><small>Fechado</small><b>${brl(total)}</b></div>
        <div class="stat in"><small>Recebido</small><b>${brl(rec)}</b></div>
        <div class="stat out"><small>A receber</small><b>${brl(falta)}</b></div>`;
    $('#money-list').innerHTML = lista.length ? lista.map(j => `
        <li class="job" data-id="${esc(j.id)}">
            <div class="job-h"><div><p class="job-t">${esc(j.cliente)}</p><p class="job-s">${esc(fmtDia(j.data))} · ${esc(j.tipo || '')}</p></div>
                <p class="job-time">${brl(j.valor)}</p></div>
            <div class="acts"><span class="pill ${aReceber(j) > 0 ? 'bad' : 'ok'}">${aReceber(j) > 0 ? `falta ${brl(aReceber(j))}` : 'pago'}</span><button type="button" class="act" data-act="edit">Editar</button></div>
        </li>`).join('') : '<li class="empty">Nenhum trabalho neste mês.</li>';
}
const renderTudo = () => { renderAgenda(); renderLeads(); renderDinheiro(); };

// ═════════ formulário ═════════
const dlg = $('#dlg-job'), form = $('#form-job');
let editando = null, leadOrigem = null;

function abrirForm(job = null, pre = null) {
    editando = job; leadOrigem = pre && pre._lead || null;
    $('#job-title').textContent = job ? 'Editar trabalho' : (leadOrigem ? 'Pedido → trabalho' : 'Novo trabalho');
    $('#job-del').hidden = !job; $('#job-err').hidden = true;
    const v = job || pre || {};
    form.reset();
    const set = (n, val) => { const el = form.elements[n]; if (el && val !== undefined && val !== null) el.value = val; };
    set('cliente', v.cliente); set('whatsapp', v.whatsapp); set('tipo', v.tipo || 'Casamento'); set('status', v.status || 'pedido');
    set('data', v.data); set('hora', v.hora); set('local', v.local); set('obs', v.obs);
    set('valor', v.valor ? String(v.valor).replace('.', ',') : ''); set('sinal', v.sinal ? String(v.sinal).replace('.', ',') : '');
    form.elements.pago.checked = !!v.pago;
    dlg.showModal();
}
const fechar = () => dlg.close();

async function salvar() {
    const f = form.elements;
    const err = $('#job-err');
    const cliente = f.cliente.value.trim(), data = f.data.value;
    if (!cliente || !data) { err.textContent = 'Preencha o nome do cliente e a data.'; err.hidden = false; return; }
    const payload = {
        cliente, whatsapp: f.whatsapp.value.trim(), tipo: f.tipo.value, status: f.status.value, data, hora: f.hora.value,
        local: f.local.value.trim(), valor: paraNumero(f.valor.value), sinal: paraNumero(f.sinal.value), pago: f.pago.checked,
        obs: f.obs.value.trim(), atualizadoEm: serverTimestamp()
    };
    $('#job-save').disabled = true;
    try {
        if (editando) await updateDoc(doc(db, 'jobs', editando.id), payload);
        else {
            if (leadOrigem) payload.leadId = leadOrigem.id;
            await addDoc(collection(db, 'jobs'), { ...payload, criadoEm: serverTimestamp() });
            if (leadOrigem) await updateDoc(doc(db, 'leads', leadOrigem.id), { status: 'convertido' });
        }
        fechar(); toast('Salvo ✔');
    } catch (e) { err.textContent = erroPermissao(e); err.hidden = false; }
    finally { $('#job-save').disabled = false; }
}

function tipoDoLead(l) {
    const r = l.respostas || {};
    if (r.perfil === 'Político/Institucional') return 'Político';
    if (r.perfil === 'Comercial/Empresa') return 'Comercial';
    return ['Casamento', 'Aniversário', 'Chá de revelação', 'Show', 'Show de humor'].includes(r.subtipo) ? r.subtipo : 'Outro';
}

// ═════════ eventos ═════════
function ligarEventos() {
    $$('.tab').forEach(t => t.addEventListener('click', () => irPara(t.dataset.tab)));
    document.addEventListener('click', async e => {
        const go = e.target.closest('[data-goto]'); if (go) { irPara(go.dataset.goto); return; }
        const b = e.target.closest('[data-act]'); if (!b) return;
        const li = b.closest('[data-id]'); const id = li && li.dataset.id;
        const act = b.dataset.act;
        try {
            if (act === 'edit') abrirForm(jobs.find(j => j.id === id));
            else if (act === 'status') { await updateDoc(doc(db, 'jobs', id), { status: b.dataset.to, atualizadoEm: serverTimestamp() }); toast(`Status: ${NOME_STATUS[b.dataset.to]}`); }
            else if (act === 'ics') baixarICS(jobs.find(j => j.id === id));
            else if (act === 'lead-job') {
                const l = leads.find(x => x.id === id); if (!l) return;
                const r = l.respostas || {};
                abrirForm(null, {
                    _lead: l, cliente: l.nome, whatsapp: telefoneWa(l.contato) ? l.contato : '', tipo: tipoDoLead(l), status: 'confirmado',
                    obs: `Pedido do site${l.faixaPreco ? ` (faixa ${l.faixaPreco})` : ''}: ${[r.perfil, r.subtipo, r.horas, r.local, r.prazo, r.entregavel].filter(Boolean).join(' · ')}${telefoneWa(l.contato) ? '' : `\nContato: ${l.contato}`}`
                });
            }
            else if (act === 'lead-arq') { await updateDoc(doc(db, 'leads', id), { status: 'arquivado' }); toast('Pedido arquivado'); }
        } catch (er) { toast(erroPermissao(er)); }
    });
    $('#btn-new').addEventListener('click', () => abrirForm());
    $('#job-cancel').addEventListener('click', fechar);
    form.addEventListener('submit', e => { e.preventDefault(); salvar(); });
    $('#job-del').addEventListener('click', async () => {
        if (!editando || !confirm(`Excluir o trabalho de ${editando.cliente}?`)) return;
        try { await deleteDoc(doc(db, 'jobs', editando.id)); fechar(); toast('Excluído'); } catch (er) { toast(erroPermissao(er)); }
    });
    $('#m-prev').addEventListener('click', () => { ym = mudaMes(ym, -1); renderDinheiro(); });
    $('#m-next').addEventListener('click', () => { ym = mudaMes(ym, 1); renderDinheiro(); });
    $('#btn-logout').addEventListener('click', () => signOut(auth));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#app').hidden) renderTudo(); });
}
function mudaMes(s, n) { const [y, m] = s.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function irPara(nome) {
    $$('.tab').forEach(t => { const on = t.dataset.tab === nome; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); });
    $$('.pane').forEach(p => { p.hidden = p.id !== `tab-${nome}`; });
}
function baixarICS(j) {
    if (!j || !j.data) return;
    const blob = new Blob([gerarICS(j)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gravacao-${(j.cliente || 'cliente').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${j.data}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Abra o arquivo para salvar no calendário (com alarmes)');
}

// ═════════ início ═════════
function escutar() {
    unsubs.forEach(u => u()); unsubs = [];
    const falha = er => toast(erroPermissao(er));
    unsubs.push(onSnapshot(collection(db, 'jobs'), s => { jobs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderTudo(); }, falha));
    unsubs.push(onSnapshot(collection(db, 'leads'), s => { leads = s.docs.map(d => ({ id: d.id, ...d.data() })); renderTudo(); }, falha));
}

async function entrar() {
    $('#gate-err').hidden = true;
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await signInWithPopup(auth, provider); }
    catch (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) { await signInWithRedirect(auth, provider); return; }
        if (e && e.code === 'auth/popup-closed-by-user') return;
        const msg = e && e.code === 'auth/unauthorized-domain'
            ? 'Este endereço não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).'
            : `Não foi possível entrar: ${e && e.message || e}`;
        mostrarGate(msg, true);
    }
}

function iniciar() {
    $('#btn-login').addEventListener('click', entrar);
    if (!configurado) { mostrarGate('Firebase ainda não configurado. Preencha firebase-config.js (veja o LEIA-ME_PAINEL.md).', true); $('#btn-login').disabled = true; return; }
    if (!ADMINS.length) { mostrarGate('Defina o seu e-mail em ADMIN_EMAILS no firebase-config.js.', true); $('#btn-login').disabled = true; return; }
    const app = initializeApp(cfg);
    auth = getAuth(app); db = getFirestore(app);
    ligarEventos();
    onAuthStateChanged(auth, user => {
        if (!user) { unsubs.forEach(u => u()); unsubs = []; mostrarGate(negado, !!negado); negado = ''; return; }
        const email = (user.email || '').toLowerCase();
        if (!ADMINS.includes(email)) { negado = `A conta ${email} não tem acesso a este painel.`; signOut(auth); return; }
        mostrarApp(); escutar();
    });
}
if (typeof document !== 'undefined' && $('#gate')) iniciar();
