// script.js — Will Rec
// Header/nav, quiz de orçamento inteligente (Gemini → Groq → cálculo local),
// captura de lead (Firestore opcional) e links de WhatsApp/Drive.

// ════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO — edite aqui
// ════════════════════════════════════════════════════════════════════
const CONFIG = {
    // Número de WhatsApp com DDI+DDD, só dígitos.
    WHATSAPP_NUMBER: '5586995419670',
    WHATSAPP_DEFAULT_MSG: 'Olá, Will! Vim pelo site e quero saber mais sobre seus serviços.',
    DRIVE_LINK: 'https://drive.google.com/drive/folders/1e2cakWT7Kuvx8ew_lwIZw9r2uTTmuvDP?usp=drive_link',
};

// ════════════════════════════════════════════════════════════════════
// 7.1 / 7.2 / 7.5 — MOTOR DE PREÇO LOCAL (3ª camada de fallback)
// Usado só se Gemini E Groq falharem — garante que o orçamento SEMPRE
// responde. Edite esses números quando sua situação de equipamento ou
// piso de mercado mudar (fica igual ao bloco 7.1/7.2 do prompt original).
// ════════════════════════════════════════════════════════════════════
const PRICING_CONFIG = {
    equipamentoAlugado: true,        // true = ainda depende de equipamento de terceiro (aplica taxa abaixo)
    equipamentoTaxa: [0.10, 0.20],   // 10% a 20% sobre o subtotal
    pisoAbsoluto: 150,
    transporte: {
        'Teresina, mesma região': [10, 15],
        'Teresina, outra região': [15, 25],
        'Fora de Teresina': [25, 40],
    },
    urgenciaEssaSemana: [0.10, 0.15],
    entregavelAdicional: {
        'Só o vídeo bruto': [0, 0],
        'Reels editados': [0, 0],              // já é o "1 vídeo/reels editado" padrão — R$150 é o próprio piso, não soma em cima
        'Reels + Stories em tempo real': [70, 100],
        'Pacote completo com roteiro e direção de arte': [100, 150],
    },
    baseEventoPessoal: {
        'Até 2h': [150, 200],
        '2 a 4h': [180, 260],
        'Dia inteiro': [280, 420],
    },
    baseComercial: {
        'Até 2h': [300, 400],
        '2 a 4h': [380, 520],
        'Dia inteiro': [450, 650],
    },
    baseFreelancerAvulso: {
        'Até 2h': [150, 200],
        '2 a 4h': [180, 240],
        'Dia inteiro': [220, 300],
    },
};

function calculateFallback(respostas) {
    const { perfil, horas, local, prazo, entregavel } = respostas;
    let baseTable, pacote;

    if (perfil === 'Evento Pessoal') { baseTable = PRICING_CONFIG.baseEventoPessoal; pacote = 'Cobertura de Evento'; }
    else if (perfil === 'Comercial/Empresa') { baseTable = PRICING_CONFIG.baseComercial; pacote = 'Pacote Comercial'; }
    else { baseTable = PRICING_CONFIG.baseFreelancerAvulso; pacote = 'Freela Avulso'; }

    let [min, max] = baseTable[horas] || baseTable['2 a 4h'];

    const [tMin, tMax] = PRICING_CONFIG.transporte[local] || [0, 0];
    min += tMin; max += tMax;

    const [eMin, eMax] = PRICING_CONFIG.entregavelAdicional[entregavel] || [0, 0];
    min += eMin; max += eMax;
    if (entregavel === 'Pacote completo com roteiro e direção de arte') pacote = 'Pacote Comercial';

    if (prazo === 'Essa semana') {
        const [uMin, uMax] = PRICING_CONFIG.urgenciaEssaSemana;
        min += min * uMin; max += max * uMax;
    }

    if (PRICING_CONFIG.equipamentoAlugado) {
        const [qMin, qMax] = PRICING_CONFIG.equipamentoTaxa;
        min += min * qMin; max += max * qMax;
    }

    min = Math.max(Math.round(min / 5) * 5, PRICING_CONFIG.pisoAbsoluto);
    max = Math.max(Math.round(max / 5) * 5, min + 20);

    const faixa = `R$${min}-${max}`;
    const resumo = `Pelo que você me contou (${describeAnswers(respostas)}), a faixa fica em torno de ${faixa}. É uma estimativa rápida — o valor fechado a gente combina certinho no WhatsApp.`;

    return { pacote, faixa_preco: faixa, resumo, mensagem_whatsapp: buildWhatsappMessage(respostas, faixa) };
}

function describeAnswers(r) {
    const parts = [];
    if (r.subtipo) parts.push(r.subtipo.toLowerCase());
    if (r.horas) parts.push(r.horas.toLowerCase());
    if (r.local) parts.push(r.local.toLowerCase());
    return parts.join(', ');
}

function buildWhatsappMessage(r, faixa) {
    const nome = (state.lead.nome || '').trim();
    const linhas = [
        `Olá, Will!${nome ? ` Meu nome é ${nome}.` : ''} Vim pelo site e fiz o orçamento inteligente:`,
        `• Perfil: ${r.perfil}${r.subtipo ? ' — ' + r.subtipo : ''}`,
    ];
    if (r.horas) linhas.push(`• Duração: ${r.horas}`);
    if (r.local) linhas.push(`• Local: ${r.local}`);
    if (r.prazo) linhas.push(`• Prazo: ${r.prazo}`);
    if (r.entregavel) linhas.push(`• Entrega: ${r.entregavel}`);
    linhas.push(`Faixa estimada: ${faixa}`);
    linhas.push('Podemos conversar sobre os detalhes?');
    return linhas.join('\n');
}

function consultaMessage(kind) {
    const nome = (state.lead.nome || '').trim();
    if (kind === 'politico') {
        return `Olá, Will!${nome ? ` Meu nome é ${nome}.` : ''} Quero conversar sobre uma parceria institucional.`;
    }
    // recorrente
    const r = state.respostas;
    const linhas = [
        `Olá, Will!${nome ? ` Meu nome é ${nome}.` : ''} Quero fechar uma parceria recorrente mensal.`,
    ];
    if (r.horas) linhas.push(`• Duração média por job: ${r.horas}`);
    if (r.local) linhas.push(`• Local: ${r.local}`);
    if (r.entregavel) linhas.push(`• Entrega: ${r.entregavel}`);
    linhas.push('Podemos combinar os detalhes?');
    return linhas.join('\n');
}

// ════════════════════════════════════════════════════════════════════
// QUIZ — perguntas e fluxo condicional (seção 6 do briefing)
// ════════════════════════════════════════════════════════════════════
const Q = {
    perfil:     { key: 'perfil',     title: 'Qual é o seu perfil?', options: ['Político/Institucional', 'Freelancer/Criador de Conteúdo', 'Comercial/Empresa', 'Evento Pessoal'] },
    horas:      { key: 'horas',      title: 'Quantas horas de cobertura você precisa?', options: ['Até 2h', '2 a 4h', 'Dia inteiro'] },
    local:      { key: 'local',      title: 'Onde vai ser?', options: ['Teresina, mesma região', 'Teresina, outra região', 'Fora de Teresina'] },
    prazo:      { key: 'prazo',      title: 'Quando é o evento ou prazo de entrega?', options: ['Essa semana', 'Próximas 2 semanas', 'Sem pressa'] },
    entregavel: { key: 'entregavel', title: 'O que você precisa receber no final?', options: ['Só o vídeo bruto', 'Reels editados', 'Reels + Stories em tempo real', 'Pacote completo com roteiro e direção de arte'] },
};

function getSubtipoConfig(perfil) {
    if (perfil === 'Evento Pessoal') return { key: 'subtipo', title: 'Que tipo de evento?', options: ['Show', 'Show de humor', 'Chá de revelação', 'Aniversário', 'Casamento', 'Outro'] };
    if (perfil === 'Comercial/Empresa') return { key: 'subtipo', title: 'Que tipo de conteúdo?', options: ['Vídeo institucional', 'Reels de divulgação', 'Cobertura de inauguração ou evento da empresa'] };
    if (perfil === 'Freelancer/Criador de Conteúdo') return { key: 'subtipo', title: 'Você pensa numa parceria recorrente (mensal)?', options: ['Sim', 'Não, só esse trabalho'] };
    return null;
}

const STEP_ORDER = ['perfil', 'subtipo', 'horas', 'local', 'prazo', 'entregavel', 'lead'];

function isConsultaOnly(r) {
    if (r.perfil === 'Político/Institucional') return true;
    if (r.perfil === 'Freelancer/Criador de Conteúdo' && r.subtipo === 'Sim') return true;
    return false;
}

function getFlow(perfil) {
    if (perfil === 'Político/Institucional') return ['perfil', 'lead'];
    return STEP_ORDER;
}

let state = {
    stepIndex: 0,
    respostas: { perfil: null, subtipo: null, horas: null, local: null, prazo: null, entregavel: null },
    lead: { nome: '', contato: '' },
    result: null,
};

function resetDownstream() {
    state.respostas.subtipo = null;
    state.respostas.horas = null;
    state.respostas.local = null;
    state.respostas.prazo = null;
    state.respostas.entregavel = null;
}

// ════════════════════════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════════════════════════
const root = document.getElementById('quiz-root');

function currentFlow() { return getFlow(state.respostas.perfil); }
function currentStepKey() { return currentFlow()[state.stepIndex]; }

function perfDotsHtml() {
    const flow = currentFlow();
    return flow.map((_, i) => {
        if (i < state.stepIndex) return '<span class="perf-dot done"></span>';
        if (i === state.stepIndex) return '<span class="perf-dot active"></span>';
        return '<span class="perf-dot"></span>';
    }).join('');
}

function slateHtml(label) {
    const flow = currentFlow();
    return `
    <div class="quiz-slate">
        <div class="quiz-take">Take <b>${String(state.stepIndex + 1).padStart(2, '0')}</b> / ${String(flow.length).padStart(2, '0')} — ${label}</div>
        <div class="quiz-perf">${perfDotsHtml()}</div>
    </div>`;
}

function optionButton(text, selected) {
    return `
    <button type="button" class="quiz-opt${selected ? ' selected' : ''}" data-opt="${escapeAttr(text)}">
        <span>${text}</span>
        <span class="quiz-opt-check"><svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>
    </button>`;
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderQuestion(config) {
    const selected = state.respostas[config.key];
    root.innerHTML = `
        ${slateHtml('Escolha uma opção')}
        <h3 class="quiz-q">${config.title}</h3>
        <div class="quiz-options">${config.options.map(o => optionButton(o, o === selected)).join('')}</div>
        <div class="quiz-nav">${state.stepIndex > 0 ? '<button type="button" class="quiz-back" data-back>← Voltar</button>' : ''}</div>
    `;
    root.querySelectorAll('[data-opt]').forEach(btn => {
        btn.addEventListener('click', () => selectOption(config.key, btn.dataset.opt));
    });
    wireBack();
}

function selectOption(key, value) {
    if (key === 'perfil' && state.respostas.perfil !== value) resetDownstream();
    state.respostas[key] = value;
    root.querySelectorAll('[data-opt]').forEach(b => b.classList.toggle('selected', b.dataset.opt === value));
    setTimeout(goNext, 320);
}

function renderLead() {
    root.innerHTML = `
        ${slateHtml('Últimos dados')}
        <h3 class="quiz-q">Pra fechar, como te chamo?</h3>
        <div class="quiz-field">
            <label for="q-nome">Seu nome</label>
            <input id="q-nome" type="text" placeholder="Nome" value="${escapeAttr(state.lead.nome)}" autocomplete="name">
        </div>
        <div class="quiz-field">
            <label for="q-contato">WhatsApp ou Instagram</label>
            <input id="q-contato" type="text" placeholder="(86) 9xxxx-xxxx ou @seu.perfil" value="${escapeAttr(state.lead.contato)}" autocomplete="tel">
        </div>
        <p class="quiz-error" id="q-lead-error" style="display:none">Preenche nome e contato pra eu conseguir te chamar.</p>
        <div class="quiz-nav">
            <button type="button" class="quiz-back" data-back>← Voltar</button>
            <button type="button" class="btn-pill quiz-next" data-lead-submit>Ver meu orçamento</button>
        </div>
    `;
    wireBack();
    root.querySelector('[data-lead-submit]').addEventListener('click', submitLead);
    root.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') submitLead(); });
    });
}

function submitLead() {
    const nome = root.querySelector('#q-nome').value.trim();
    const contato = root.querySelector('#q-contato').value.trim();
    if (!nome || !contato) {
        root.querySelector('#q-lead-error').style.display = 'block';
        return;
    }
    state.lead = { nome, contato };
    goNext();
}

function renderLoading() {
    const msgs = ['Rodando os números da agenda…', 'Cruzando duração, distância e prazo…', 'Fechando a claquete…'];
    root.innerHTML = `
        <div class="quiz-loading">
            <div class="clapper"><div class="clapper-top"></div><div class="clapper-body"></div></div>
            <p id="quiz-loading-msg">${msgs[0]}</p>
        </div>`;
    let i = 0;
    const int = setInterval(() => {
        i = (i + 1) % msgs.length;
        const el = document.getElementById('quiz-loading-msg');
        if (el) el.textContent = msgs[i]; else clearInterval(int);
    }, 900);
    return () => clearInterval(int);
}

function renderResult(quote) {
    const isConsulta = /consulta/i.test(quote.faixa_preco);
    const priceHtml = isConsulta
        ? `<div class="result-price consulta">Sob Consulta</div>`
        : `<div class="result-price">${quote.faixa_preco.replace('-', '<span> – </span>')}</div>`;

    const waHref = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(quote.mensagem_whatsapp)}`;

    root.innerHTML = `
        <div class="quiz-result">
            <span class="result-badge">${escapeHtml(quote.pacote)}</span>
            ${priceHtml}
            <p class="result-summary">${escapeHtml(quote.resumo)}</p>
            <div class="result-lead">
                <p class="result-lead-label">Beleza, ${escapeHtml((state.lead.nome || '').split(' ')[0] || '')}! Bora fechar</p>
                <a href="${waHref}" target="_blank" rel="noopener" class="btn-pill" style="width:100%">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.8 14.16c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.66.5.24.58.82 2 .9 2.14.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.24.09 1.53.72 1.79.85.26.13.44.19.5.3.07.11.07.62-.17 1.3z"/></svg>
                    Chamar no WhatsApp
                </a>
            </div>
            <button type="button" class="quiz-restart" data-restart>Refazer orçamento</button>
        </div>`;
    root.querySelector('[data-restart]').addEventListener('click', restartQuiz);
}

function renderError(msg) {
    root.innerHTML = `
        <div class="quiz-result">
            <span class="result-badge">Ops</span>
            <p class="result-summary">${escapeHtml(msg)} Mas relaxa — chama direto no WhatsApp que eu te passo o orçamento na mão.</p>
            <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(CONFIG.WHATSAPP_DEFAULT_MSG)}" target="_blank" rel="noopener" class="btn-pill" style="width:100%">Chamar no WhatsApp</a>
            <button type="button" class="quiz-restart" data-restart>Tentar de novo</button>
        </div>`;
    root.querySelector('[data-restart]').addEventListener('click', restartQuiz);
}

function wireBack() {
    const btn = root.querySelector('[data-back]');
    if (btn) btn.addEventListener('click', goBack);
}

function restartQuiz() {
    state = { stepIndex: 0, respostas: { perfil: null, subtipo: null, horas: null, local: null, prazo: null, entregavel: null }, lead: { nome: '', contato: '' }, result: null };
    render();
}

// ════════════════════════════════════════════════════════════════════
// NAVEGAÇÃO ENTRE STEPS
// ════════════════════════════════════════════════════════════════════
function goBack() {
    if (state.stepIndex > 0) { state.stepIndex--; render(); }
}

async function goNext() {
    const flow = currentFlow();
    if (state.stepIndex < flow.length - 1) {
        state.stepIndex++;
        render();
    } else {
        // último step (lead) concluído → calcular resultado
        await resolveResult();
    }
}

async function resolveResult() {
    const r = state.respostas;

    if (isConsultaOnly(r)) {
        const kind = r.perfil === 'Político/Institucional' ? 'politico' : 'recorrente';
        const pacote = kind === 'politico' ? 'Parceria Institucional' : 'Parceria Recorrente';
        const resumo = kind === 'politico'
            ? 'Esse tipo de parceria eu negocio direto, sem faixa fechada — vou te chamar no WhatsApp pra alinharmos os detalhes.'
            : 'Parceria mensal é combinado à parte: geralmente fica entre R$700 e R$950/mês, em vários pagamentos ao longo do mês, mas isso varia com o combinado — bora fechar no WhatsApp.';
        const quote = { pacote, faixa_preco: 'sob consulta', resumo, mensagem_whatsapp: consultaMessage(kind), source: 'regra-fixa' };
        state.result = quote;
        renderResult(quote);
        saveLead(quote);
        return;
    }

    const stopLoading = renderLoading();
    try {
        const quote = await fetchQuote(r);
        stopLoading();
        state.result = quote;
        renderResult(quote);
        saveLead(quote);
    } catch (err) {
        stopLoading();
        console.error('Falha total ao calcular orçamento:', err);
        renderError('Deu ruim aqui na hora de calcular.');
    }
}

// ════════════════════════════════════════════════════════════════════
// CHAMADA DE IA — Gemini (principal) → Groq (fallback) → local (seção acima)
// ════════════════════════════════════════════════════════════════════
async function fetchWithTimeout(url, respostas, ms) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ respostas }),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchQuote(respostas) {
    try {
        const res = await fetchWithTimeout('/api/quote', respostas, 12_000);
        if (res.ok) return await res.json();
        console.warn('[quote] Gemini respondeu com erro, tentando Groq…', res.status);
    } catch (err) {
        console.warn('[quote] Gemini falhou, tentando Groq…', err?.message || err);
    }

    try {
        const res = await fetchWithTimeout('/api/quote-groq', respostas, 12_000);
        if (res.ok) return await res.json();
        console.warn('[quote] Groq também respondeu com erro, usando cálculo local…', res.status);
    } catch (err) {
        console.warn('[quote] Groq também falhou, usando cálculo local…', err?.message || err);
    }

    return { source: 'local', ...calculateFallback(respostas) };
}

// ════════════════════════════════════════════════════════════════════
// LEAD → FIRESTORE (opcional, não bloqueia o fluxo se não configurado)
// ════════════════════════════════════════════════════════════════════
function saveLead(quote) {
    if (!window.firebaseReady || !window.db) return;
    try {
        window.fb.addDoc(window.fb.collection(window.db, 'leads'), {
            nome: state.lead.nome,
            contato: state.lead.contato,
            respostas: state.respostas,
            pacote: quote.pacote,
            faixaPreco: quote.faixa_preco,
            fonte: quote.source || 'ia',
            criadoEm: window.fb.serverTimestamp(),
        }).catch(err => console.warn('[saveLead] falha ao salvar:', err?.message || err));
    } catch (err) {
        console.warn('[saveLead] falha ao salvar:', err?.message || err);
    }
}

// ════════════════════════════════════════════════════════════════════
// MASTER RENDER
// ════════════════════════════════════════════════════════════════════
function render() {
    const key = currentStepKey();
    if (key === 'perfil') return renderQuestion(Q.perfil);
    if (key === 'subtipo') return renderQuestion(getSubtipoConfig(state.respostas.perfil));
    if (key === 'lead') return renderLead();
    if (Q[key]) return renderQuestion(Q[key]);
}

if (root) render();

// ════════════════════════════════════════════════════════════════════
// HEADER, MENU MOBILE, LINKS DE WHATSAPP/DRIVE, FOOTER
// ════════════════════════════════════════════════════════════════════
const header = document.getElementById('header');
const onScroll = () => header?.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const hamburger = document.getElementById('hamburger');
const navOverlay = document.getElementById('nav-overlay');
function toggleNav(open) {
    const isOpen = open ?? !navOverlay.classList.contains('active');
    navOverlay.classList.toggle('active', isOpen);
    hamburger.classList.toggle('is-open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
}
hamburger?.addEventListener('click', () => toggleNav());
navOverlay?.querySelectorAll('[data-nav-link]').forEach(a => a.addEventListener('click', () => toggleNav(false)));

document.querySelectorAll('[data-wa-link]').forEach(a => {
    a.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(CONFIG.WHATSAPP_DEFAULT_MSG)}`;
});
document.querySelectorAll('[data-drive-link]').forEach(a => { a.href = CONFIG.DRIVE_LINK; });

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ════════════════════════════════════════════════════════════════════
// PORTFÓLIO — bolinha ativa acompanha o scroll horizontal
// ════════════════════════════════════════════════════════════════════
const folioScroll = document.querySelector('.folio-scroll');
const fdots = document.querySelectorAll('.fdot');
if (folioScroll && fdots.length) {
    const cards = folioScroll.querySelectorAll('.folio-card');
    let ticking = false;
    folioScroll.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const center = folioScroll.scrollLeft + folioScroll.clientWidth / 2;
            let closest = 0, minDist = Infinity;
            cards.forEach((card, i) => {
                const dist = Math.abs((card.offsetLeft + card.offsetWidth / 2) - center);
                if (dist < minDist) { minDist = dist; closest = i; }
            });
            const activeIndex = Math.min(closest, fdots.length - 1);
            fdots.forEach((d, i) => d.classList.toggle('active', i === activeIndex));
            cards.forEach((card, i) => card.classList.toggle('is-active', i === activeIndex));
            ticking = false;
        });
    }, { passive: true });
    // Estado inicial: primeiro card já entra em destaque
    cards[0]?.classList.add('is-active');
}

// ════════════════════════════════════════════════════════════════════
// REVEAL AO ROLAR — fade-in sutil quando os elementos entram na tela
// ════════════════════════════════════════════════════════════════════
const revealTargets = document.querySelectorAll('.reveal');
if (revealTargets.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add('in-view'), (i % 4) * 80);
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(el => io.observe(el));
} else {
    revealTargets.forEach(el => el.classList.add('in-view'));
}
