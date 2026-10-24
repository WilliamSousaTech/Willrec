// api/quote.js — Vercel Serverless Function
// O PREÇO sai de js/pricing.js (regras, o mesmo código do navegador). A IA (Gemini) só reescreve o RESUMO em
// texto, num tom simpático. Se a IA falhar, demorar ou inventar valor, devolvemos o resumo padrão: o cliente
// sempre recebe a mesma faixa, e esta função nunca devolve erro por causa da IA.

import { validarRespostas, calcularFaixa, resumoPadrao, mensagemWhatsapp, OPCOES } from '../js/pricing.js';

const RATE_LIMIT = new Map();   // melhor esforço: em serverless cada instância tem a sua memória
const MAX_REQ = 20;
const WINDOW_MS = 60_000;
const TIMEOUT_MS = 4_000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';   // troque via variável de ambiente se o modelo for aposentado

const SYSTEM_PROMPT = `
Você escreve o RESUMO de um orçamento para o site do Will Rec (William Sousa), videomaker mobile freelancer em Teresina-PI.
Tom: direto, simpático, sem enrolação, em primeira pessoa (como se o Will estivesse falando com o cliente).
Regras rígidas:
- 2 ou 3 frases, no máximo 320 caracteres.
- Se houver faixa de preço, cite-a EXATAMENTE como foi dada, sem alterar nem inventar outros valores em reais.
- Se for "sob consulta", não cite valores: diga que o valor é combinado direto no WhatsApp.
- Não invente serviços, prazos, descontos nem condições. Não prometa nada além do que está nos dados.
- Responda SOMENTE com um JSON: {"resumo":"..."} — sem markdown, sem texto antes ou depois.
`.trim();

function parseJson(texto) {
    if (!texto) return null;
    const limpo = String(texto).replace(/```json/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(limpo); } catch {
        const m = limpo.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
        return null;
    }
}

// A IA não pode mudar o preço: qualquer "R$ N" no texto precisa estar na faixa calculada.
function resumoSeguro(resumo, q) {
    if (typeof resumo !== 'string') return null;
    const t = resumo.trim();
    if (t.length < 20 || t.length > 420) return null;
    if (!q.consulta && !t.includes(q.faixa_preco)) return null;               // tem que citar a faixa exata
    const resto = q.consulta ? t : t.split(q.faixa_preco).join(' ');
    if (/R\$\s*\d/.test(resto)) return null;                                  // nenhum outro valor em reais
    if (/\b\d{3,}\b/.test(resto)) return null;                                // nem número solto parecendo preço
    return t;
}

async function resumoComIA(r, q) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });
    const controller = new AbortController();
    const dados = { pedido: r, faixa_preco: q.faixa_preco, pacote: q.pacote };
    const chamada = ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: `DADOS DO PEDIDO:\n${JSON.stringify(dados, null, 2)}` }] }],
        config: {
            systemInstruction: SYSTEM_PROMPT, temperature: 0.5, maxOutputTokens: 256,
            responseMimeType: 'application/json', abortSignal: controller.signal,
        },
    });
    let timer;
    const limite = new Promise((_, rej) => { timer = setTimeout(() => { controller.abort(); rej(new Error('timeout')); }, TIMEOUT_MS); });
    try {
        const resposta = await Promise.race([chamada, limite]);
        return resumoSeguro(parseJson(resposta?.text)?.resumo, q);
    } finally {
        clearTimeout(timer);
        chamada.catch(() => {});      // evita "unhandled rejection" se o timeout vencer a corrida
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
    const agora = Date.now();
    const e = RATE_LIMIT.get(ip) || { count: 0, start: agora };
    if (agora - e.start > WINDOW_MS) { e.count = 0; e.start = agora; }
    e.count++; RATE_LIMIT.set(ip, e);
    if (e.count > MAX_REQ) return res.status(429).json({ error: 'Rate limit exceeded' });

    const v = validarRespostas(req.body?.respostas);
    if (!v.ok) return res.status(400).json({ error: v.erro, opcoes: OPCOES.perfil });
    const r = v.respostas;

    const q = calcularFaixa(r);
    const base = { pacote: q.pacote, faixa_preco: q.faixa_preco, resumo: resumoPadrao(r, q) };
    const nome = typeof req.body?.nome === 'string' ? req.body.nome.slice(0, 60).replace(/[\r\n]+/g, ' ') : '';
    const mensagem_whatsapp = mensagemWhatsapp(r, q, nome);

    try {
        const resumo = await resumoComIA(r, q);
        if (resumo) return res.status(200).json({ ...base, resumo, mensagem_whatsapp, source: 'gemini' });
    } catch (err) {
        console.warn('[quote] IA indisponível, usando resumo padrão:', err?.message || err);
    }
    return res.status(200).json({ ...base, mensagem_whatsapp, source: 'regra' });
}
