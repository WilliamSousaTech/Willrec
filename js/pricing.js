// js/pricing.js — ÚNICA fonte de verdade do orçamento do Will Rec.
// Usado pelo navegador (script.js) e pelo servidor (api/quote.js): o preço é o mesmo nos dois lugares,
// sai na hora e NÃO depende de IA. A IA só escreve o resumo em texto (ver api/quote.js).
//
// ► Para mudar preço, edite SÓ o bloco PRECOS aqui embaixo.

// ═════════════════════════════════════════════════════════════════
// PRECOS — edite aqui
// ═════════════════════════════════════════════════════════════════
export const PRECOS = {
    equipamentoAlugado: true,          // true = ainda depende de equipamento de terceiro (aplica a taxa abaixo)
    equipamentoTaxa: [0.10, 0.20],     // 10% a 20% sobre o subtotal
    pisoAbsoluto: 150,                 // nunca devolver faixa abaixo disso
    transporte: {
        'Teresina, mesma região': [10, 15],
        'Teresina, outra região': [15, 25],
        'Fora de Teresina': [25, 40],
    },
    urgenciaEssaSemana: [0.10, 0.15],  // +10% a +15% sobre o subtotal
    entregavelAdicional: {
        'Só o vídeo bruto': [0, 0],
        'Reels editados': [0, 0],                                   // 1 vídeo editado: já é o piso, não soma em cima
        'Reels + Stories em tempo real': [70, 100],
        'Pacote completo com roteiro e direção de arte': [100, 150],
    },
    baseEventoPessoal:    { 'Até 2h': [150, 200], '2 a 4h': [180, 260], 'Dia inteiro': [280, 420] },
    baseFreelancerAvulso: { 'Até 2h': [150, 200], '2 a 4h': [180, 240], 'Dia inteiro': [220, 300] },

    // Casamento e aniversário com COBERTURA COMPLETA (Reels + Stories em tempo real, ou pacote completo):
    // evento grande → o valor mínimo da faixa sobe para a base de R$500.
    // Só um vídeo (bruto ou Reels editados) continua pela tabela normal: R$150–200 para pouco tempo, mais se ficar mais horas.
    eventoGrande: {
        subtipos: ['Casamento', 'Aniversário'],
        entregaveis: ['Reels + Stories em tempo real', 'Pacote completo com roteiro e direção de arte'],
        horas: ['Dia inteiro'],        // acrescente '2 a 4h' aqui se quiser a base de R$500 também nesse tempo
        minimo: 500,
    },
};

// Perfis que NÃO têm preço no site: o orçamento é combinado direto no WhatsApp.
export const PERFIS_SOB_CONSULTA = ['Político/Institucional', 'Comercial/Empresa'];

// ═════════════════════════════════════════════════════════════════
// OPÇÕES DO QUIZ (o servidor só aceita estes valores)
// ═════════════════════════════════════════════════════════════════
export const OPCOES = {
    perfil: ['Político/Institucional', 'Freelancer/Criador de Conteúdo', 'Comercial/Empresa', 'Evento Pessoal'],
    subtipo: {
        'Evento Pessoal': ['Show', 'Show de humor', 'Chá de revelação', 'Aniversário', 'Casamento', 'Outro'],
        'Comercial/Empresa': ['Vídeo institucional', 'Reels de divulgação', 'Cobertura de inauguração ou evento da empresa'],
        'Freelancer/Criador de Conteúdo': ['Sim', 'Não, só esse trabalho'],
    },
    horas: ['Até 2h', '2 a 4h', 'Dia inteiro'],
    local: Object.keys(PRECOS.transporte),
    prazo: ['Essa semana', 'Próximas 2 semanas', 'Sem pressa'],
    entregavel: Object.keys(PRECOS.entregavelAdicional),
};

export function ehSobConsulta(r) {
    if (PERFIS_SOB_CONSULTA.includes(r.perfil)) return true;
    return r.perfil === 'Freelancer/Criador de Conteúdo' && r.subtipo === 'Sim';   // parceria recorrente
}

// Valida e limpa o que chega do navegador. Devolve { ok, respostas } ou { ok:false, erro }.
export function validarRespostas(entrada) {
    if (!entrada || typeof entrada !== 'object') return { ok: false, erro: 'respostas ausentes' };
    const r = {};
    if (!OPCOES.perfil.includes(entrada.perfil)) return { ok: false, erro: 'perfil inválido' };
    r.perfil = entrada.perfil;
    if (PERFIS_SOB_CONSULTA.includes(r.perfil)) return { ok: true, respostas: r };

    const subs = OPCOES.subtipo[r.perfil];
    if (subs) {
        if (!subs.includes(entrada.subtipo)) return { ok: false, erro: 'subtipo inválido' };
        r.subtipo = entrada.subtipo;
    }
    if (ehSobConsulta({ ...r })) return { ok: true, respostas: r };
    for (const k of ['horas', 'local', 'prazo', 'entregavel']) {
        if (!OPCOES[k].includes(entrada[k])) return { ok: false, erro: `${k} inválido` };
        r[k] = entrada[k];
    }
    return { ok: true, respostas: r };
}

const arred5 = n => Math.round(n / 5) * 5;

// ═════════════════════════════════════════════════════════════════
// CÁLCULO — devolve sempre uma faixa (mínimo-máximo) ou "sob consulta"
// ═════════════════════════════════════════════════════════════════
export function calcularFaixa(r) {
    if (ehSobConsulta(r)) return { consulta: true, faixa_preco: 'sob consulta', pacote: pacoteConsulta(r) };

    const P = PRECOS;
    const tabela = r.perfil === 'Evento Pessoal' ? P.baseEventoPessoal : P.baseFreelancerAvulso;
    let pacote = r.perfil === 'Evento Pessoal' ? 'Cobertura de Evento' : 'Freela Avulso';
    let [min, max] = tabela[r.horas] || tabela['2 a 4h'];

    const [tMin, tMax] = P.transporte[r.local] || [0, 0];
    min += tMin; max += tMax;

    const [eMin, eMax] = P.entregavelAdicional[r.entregavel] || [0, 0];
    min += eMin; max += eMax;
    if (r.entregavel === 'Pacote completo com roteiro e direção de arte') pacote = 'Pacote Completo';

    if (r.prazo === 'Essa semana') { min += min * P.urgenciaEssaSemana[0]; max += max * P.urgenciaEssaSemana[1]; }
    if (P.equipamentoAlugado) { min += min * P.equipamentoTaxa[0]; max += max * P.equipamentoTaxa[1]; }

    // evento grande (casamento/aniversário com cobertura completa): base de R$500
    const G = P.eventoGrande;
    const grande = r.perfil === 'Evento Pessoal' && G.subtipos.includes(r.subtipo)
        && G.entregaveis.includes(r.entregavel) && G.horas.includes(r.horas);
    if (grande) { min = Math.max(min, G.minimo); pacote = 'Cobertura Completa'; }

    min = Math.max(arred5(min), P.pisoAbsoluto);
    max = Math.max(arred5(max), min + 20);
    return { consulta: false, min, max, faixa_preco: `R$${min}-${max}`, pacote };
}

function pacoteConsulta(r) {
    if (r.perfil === 'Político/Institucional') return 'Parceria Institucional';
    if (r.perfil === 'Comercial/Empresa') return 'Projeto Comercial';
    return 'Parceria Recorrente';
}

// ═════════════════════════════════════════════════════════════════
// TEXTOS (usados quando a IA não responde — e como base de tudo)
// ═════════════════════════════════════════════════════════════════
function descricao(r) {
    return [r.subtipo, r.horas, r.local].filter(Boolean).map(s => s.toLowerCase()).join(', ');
}

export function resumoPadrao(r, q) {
    if (q.consulta) {
        if (r.perfil === 'Comercial/Empresa') return 'Vídeo comercial eu oriento por projeto: o valor depende do roteiro, do tempo de gravação e do que você precisa receber. Me chama no WhatsApp que eu te passo um valor fechado.';
        if (r.perfil === 'Político/Institucional') return 'Esse tipo de parceria eu negocio direto, sem faixa fechada — vou te chamar no WhatsApp pra alinharmos os detalhes.';
        return 'Parceria mensal é combinado à parte: geralmente fica entre R$700 e R$950/mês, em vários pagamentos ao longo do mês, mas isso varia com o combinado — bora fechar no WhatsApp.';
    }
    return `Pelo que você me contou (${descricao(r)}), a faixa fica em torno de ${q.faixa_preco}. É uma estimativa rápida — o valor fechado a gente combina certinho no WhatsApp.`;
}

export function mensagemWhatsapp(r, q, nome = '') {
    const n = String(nome || '').trim();
    const oi = `Olá, Will!${n ? ` Meu nome é ${n}.` : ''}`;
    if (q.consulta) {
        if (r.perfil === 'Político/Institucional') return `${oi} Quero conversar sobre uma parceria institucional.`;
        if (r.perfil === 'Comercial/Empresa') return `${oi} Vim pelo site e quero orçar um vídeo comercial/institucional para a minha empresa.`;
        const l = [`${oi} Quero fechar uma parceria recorrente mensal.`];
        if (r.horas) l.push(`• Duração média por job: ${r.horas}`);
        if (r.local) l.push(`• Local: ${r.local}`);
        if (r.entregavel) l.push(`• Entrega: ${r.entregavel}`);
        l.push('Podemos combinar os detalhes?');
        return l.join('\n');
    }
    const l = [`${oi} Vim pelo site e fiz o orçamento inteligente:`,
        `• Perfil: ${r.perfil}${r.subtipo ? ' — ' + r.subtipo : ''}`];
    if (r.horas) l.push(`• Duração: ${r.horas}`);
    if (r.local) l.push(`• Local: ${r.local}`);
    if (r.prazo) l.push(`• Prazo: ${r.prazo}`);
    if (r.entregavel) l.push(`• Entrega: ${r.entregavel}`);
    l.push(`Faixa estimada: ${q.faixa_preco}`, 'Podemos conversar sobre os detalhes?');
    return l.join('\n');
}

// Orçamento completo, só com regras (sem IA). O navegador mostra isto na hora.
export function orcamentoPadrao(r, nome = '') {
    const q = calcularFaixa(r);
    return { ...q, resumo: resumoPadrao(r, q), mensagem_whatsapp: mensagemWhatsapp(r, q, nome), source: 'regra' };
}
