// script.js — Will Rec
// Quiz de orçamento inteligente, captura de lead (Firestore opcional) e links de WhatsApp.
// O PREÇO vem de js/pricing.js (regras, sai na hora). A IA (api/quote.js) só reescreve o resumo em texto.
import { PERFIS_SOB_CONSULTA, ehSobConsulta, orcamentoPadrao } from './js/pricing.js';

// ════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO — edite aqui
// (links do Drive por categoria e por vídeo ficam em data/videos.json)
// ════════════════════════════════════════════════════════════════════
const CONFIG = {
    // Número de WhatsApp com DDI+DDD, só dígitos.
    WHATSAPP_NUMBER: '5586995419670',
    WHATSAPP_DEFAULT_MSG: 'Olá, Will! Vim pelo site e quero saber mais sobre seus serviços.',
    DRIVE_LINK: 'https://drive.google.com/drive/folders/1e2cakWT7Kuvx8ew_lwIZw9r2uTTmuvDP?usp=drive_link',
    IA_TIMEOUT_MS: 5000,
};

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

function getFlow(perfil) {
    if (PERFIS_SOB_CONSULTA.includes(perfil)) return ['perfil', 'lead'];   // político e comercial: combinado no WhatsApp
    return STEP_ORDER;
}

let state = {
    stepIndex: 0,
    respostas: { perfil: null, subtipo: null, horas: null, local: null, prazo: null, entregavel: null },
    lead: { nome: '', contato: '' },
    result: null,
    run: 0,
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
        : `<div class="result-price">${escapeHtml(quote.faixa_preco).replace('-', '<span> – </span>')}</div>`;

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
    state = { stepIndex: 0, respostas: { perfil: null, subtipo: null, horas: null, local: null, prazo: null, entregavel: null }, lead: { nome: '', contato: '' }, result: null, run: state.run + 1 };
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

const dormir = ms => new Promise(r => setTimeout(r, ms));

// A IA só devolve o texto do resumo. Qualquer falha → null (o resumo padrão já está na tela).
async function buscarResumoIA(respostas, nome) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.IA_TIMEOUT_MS);
    try {
        const res = await fetch('/api/quote', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ respostas, nome }), signal: controller.signal,
        });
        if (!res.ok) return null;
        const j = await res.json();
        return j && j.source === 'gemini' && typeof j.resumo === 'string' ? j : null;
    } catch { return null; } finally { clearTimeout(timer); }
}

async function resolveResult() {
    const r = state.respostas;
    const nome = state.lead.nome;
    const quote = orcamentoPadrao(r, nome);            // preço e textos por regra: instantâneo e sempre igual
    const run = ++state.run;
    const stopLoading = renderLoading();
    const ia = ehSobConsulta(r) ? Promise.resolve(null) : buscarResumoIA(r, nome);
    await dormir(700);                                  // a claquete aparece um instante, o resultado não depende da IA
    stopLoading();
    if (run !== state.run) return;                      // a pessoa refez o quiz nesse meio-tempo
    state.result = quote;
    renderResult(quote);
    saveLead(quote);
    ia.then(j => {
        if (!j || run !== state.run || j.faixa_preco !== quote.faixa_preco) return;   // a IA nunca muda o preço
        const el = root.querySelector('.result-summary');
        if (!el) return;
        el.classList.add('is-swap');
        setTimeout(() => { el.textContent = j.resumo; el.classList.remove('is-swap'); }, 220);
    });
}

// ════════════════════════════════════════════════════════════════════
// LEAD → FIRESTORE (opcional; o Firebase só é baixado aqui, e não bloqueia o fluxo)
// ════════════════════════════════════════════════════════════════════
function saveLead(quote) {
    import('./firebase-init.js')
        .then(m => m.salvarLead({
            nome: state.lead.nome,
            contato: state.lead.contato,
            respostas: state.respostas,
            pacote: quote.pacote,
            faixaPreco: quote.faixa_preco,
            fonte: quote.source || 'regra',
        }))
        .catch(err => console.warn('[saveLead] falha ao salvar:', err?.message || err));
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
// LINKS DE WHATSAPP/DRIVE E RODAPÉ
// (header, dock, hero, portfólio e reveal agora vivem em js/)
// ════════════════════════════════════════════════════════════════════
document.querySelectorAll('[data-wa-link]').forEach(a => {
    a.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(CONFIG.WHATSAPP_DEFAULT_MSG)}`;
});
document.querySelectorAll('[data-drive-link]').forEach(a => { a.href = CONFIG.DRIVE_LINK; });   // js/videos.js refina por categoria

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
