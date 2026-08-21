// api/quote.js — Vercel Serverless Function
// Motor de orçamento inteligente do site Will Rec.
// Integração com Google Gemini 2.0 Flash via @google/genai v2.x (IA principal).
// Fallback automático: se essa function falhar, o frontend chama /api/quote-groq.

import { GoogleGenAI } from '@google/genai';

const RATE_LIMIT = new Map();
const MAX_REQ = 20;
const WINDOW_MS = 60_000;

// ════════════════════════════════════════════════════════════════════
// 7.1 a 7.5 — BASE DE CUSTO, PISO DE MERCADO E FÓRMULA DE PRECIFICAÇÃO
// Isso é o "cérebro" do orçamento. Edite só este bloco quando sua
// situação de equipamento/preços mudar — o resto do arquivo não precisa
// ser tocado.
// ════════════════════════════════════════════════════════════════════
const BUSINESS_CONTEXT = `
CONTEXTO DE NEGÓCIO (base de conhecimento interna — não mostrar ao cliente):

Quem é o profissional: William Sousa (Will Rec), videomaker mobile freelancer em
Teresina-PI, atuando desde 2025. Serviços: cobertura de eventos ao vivo (shows,
shows de humor com múltiplos personagens, aniversários, casamentos, chá de
revelação, eventos religiosos e institucionais), produção de Reels/Stories em
tempo real, vídeos comerciais e institucionais, roteiro e copywriting de
anúncios, parcerias recorrentes/mensais.

CREDENCIAL (o que justifica o preço, não é achismo): portfólio ativo com dezenas
de milhares de visualizações em cobertura de eventos, publicidade e lifestyle,
cobertura recorrente para clientes fixos, conexão com criadores locais de
alcance relevante, e um diferencial técnico raro no mercado local: também é
desenvolvedor web/IA, então entrega não só captação/edição mas também roteiro,
copywriting e direção de conteúdo com peso estratégico. Isso justifica não
competir por baixo.

7.1 CUSTO REAL DE EQUIPAMENTO (situação atual — ainda depende de equipamento
emprestado/alugado de terceiro para parte dos jobs):
- Aluguel do aparelho: 10-20% do valor do job
- Transporte/carona mesma região (Teresina): R$10-15
- Transporte/carona outra região de Teresina: R$15-25
- Transporte/carona fora de Teresina: R$25-40+
- Margem líquida alvo depois desses custos: nunca menos que 70% do valor cobrado.

7.2 PISO DE MERCADO (histórico real de jobs):
- Cliente recorrente/parceria mensal: R$700-950/mês, em vários pagamentos ao
  longo do mês
- Freela avulso simples: R$150-300
- Freela avulso comercial/institucional: R$300-450+
- PISO ABSOLUTO: nunca sugerir abaixo de R$150 por job avulso, mesmo o mais
  simples.

7.3 TABELA-BASE POR PERFIL E DURAÇÃO (valores reais confirmados pelo William —
use como referência principal, os exemplos abaixo mostram como combinar com
as demais variáveis):
- Evento Pessoal (chá de revelação, aniversário, etc.):
    Até 2h: R$150-200 · 2-4h: R$180-260 · Dia inteiro: R$280-420
- Comercial/Empresa:
    Até 2h: R$300-400 · 2-4h: R$380-520 · Dia inteiro: R$450-650
- Freelancer/Criador de Conteúdo (job avulso, sem recorrência):
    Até 2h: R$150-200 · 2-4h: R$180-240 · Dia inteiro: R$220-300
(R$150 já é o preço real de "1 vídeo/reels editado simples", confirmado pelo
William tanto pra evento pessoal quanto pra comercial — é o piso, não uma
base pra somar entregável em cima.)

7.4 VARIÁVEIS QUE ENTRAM NO CÁLCULO:
- Perfil do cliente define a tabela-base (ver 7.3)
- Duração da cobertura: até 2h / 2-4h / dia inteiro (dia inteiro = valor mais
  alto dentro da faixa)
- Distância/deslocamento define a taxa de transporte (ver 7.1)
- Urgência "essa semana" soma +10-15% sobre o subtotal (prioridade em cima da
  agenda)
- Entregável soma valor sobre a tabela-base: vídeo bruto ou Reels editados
  (já inclusos na tabela-base, R$0 adicional) → Reels + Stories em tempo real
  (+R$70-100, confirmado: 1 vídeo editado R$150 + stories ≈ R$250 real) →
  pacote completo com roteiro e direção de arte (+R$100-150, empurra para
  "Pacote Comercial")
- Recorrência: se o cliente sinalizar que quer parceria recorrente mensal, NÃO
  feche preço automático — direcione para negociação no WhatsApp.

7.5 FÓRMULA (sempre devolver uma FAIXA, nunca um número fechado — dá margem de
negociação e reflete a natureza de trabalho freelance):
preço_final = preço_base(perfil, duração)  [ver tabela 7.3]
            + taxa_deslocamento(distância)
            + taxa_urgência(prazo)
            + adicional_entregável(nível)
            + custo_equipamento(aplicar 10-20% sobre o subtotal, pois ainda
              depende de equipamento de terceiro)
Nunca devolver faixa abaixo do piso absoluto de R$150.

EXEMPLOS CALIBRADOS (few-shot — aprenda o padrão de raciocínio, não copie os
números literalmente, adapte às respostas reais do quiz):
1) Evento Pessoal, Aniversário, 2-4h, mesma região, próximas 2 semanas, Reels
   editados → Base R$180-260 + transporte R$10-15 + entregável R$0 (já
   incluso) + equipamento 10-20% = faixa final aproximada R$210-330 → pacote
   "Cobertura de Evento"
2) Comercial/Empresa, Reels de divulgação, até 2h, outra região, essa semana,
   pacote completo → Base R$300-400 + transporte R$15-25 + urgência +10-15% +
   entregável +R$100-150 = faixa final aproximada R$460-660 → pacote
   "Comercial"
3) Freelancer/Criador de Conteúdo, recorrente = Sim → NÃO calcular faixa.
   faixa_preco = "sob consulta". Direcionar para negociação no WhatsApp.
4) Político/Institucional → NÃO calcular faixa. faixa_preco = "sob consulta".
   Direcionar para negociação no WhatsApp.
`.trim();

const SYSTEM_PROMPT = `
Você é o motor de orçamento do site da Will Rec (William Sousa), videomaker
mobile freelancer em Teresina-PI. Sua única função é calcular um preço
estimado a partir das respostas do quiz e devolver um resultado estruturado.

REGRAS RÍGIDAS:
- Nunca invente serviços fora da lista de serviços do negócio.
- Nunca devolva um valor fixo — sempre uma faixa (mínimo-máximo), no formato
  "R$XXX-YYY".
- Nunca vá abaixo do piso de R$150 por job avulso.
- Se perfil = "Político/Institucional" OU (perfil = "Freelancer/Criador de
  Conteúdo" E recorrente = "Sim"), NÃO calcule faixa de preço — devolva
  faixa_preco como "sob consulta" e direcione para o WhatsApp.
- Responda APENAS com o JSON pedido, sem texto antes ou depois, sem markdown,
  sem \`\`\`.

${BUSINESS_CONTEXT}

FORMATO DE SAÍDA — responda SOMENTE este JSON, preenchido:
{
  "pacote": "string curta, ex: Cobertura de Evento / Pacote Comercial / Parceria Recorrente / Parceria Institucional",
  "faixa_preco": "string, ex: R$240-365 ou sob consulta",
  "resumo": "2-3 frases em tom direto, simpático e sem enrolação, explicando o que foi entendido do pedido",
  "mensagem_whatsapp": "mensagem pronta em 1a pessoa (como se o CLIENTE estivesse escrevendo pro Will Rec), resumindo o pedido e citando a faixa de preço quando houver, pronta pra colar no WhatsApp"
}
`.trim();

function buildUserMessage(respostas) {
    return `RESPOSTAS DO QUIZ (injetadas pela aplicação):\n${JSON.stringify(respostas, null, 2)}`;
}

function safeParseJSON(text) {
    if (!text) return null;
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { return null; }
        }
        return null;
    }
}

function isValidQuote(obj) {
    return obj
        && typeof obj.pacote === 'string'
        && typeof obj.faixa_preco === 'string'
        && typeof obj.resumo === 'string'
        && typeof obj.mensagem_whatsapp === 'string';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Rate limiting por IP
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = RATE_LIMIT.get(ip) || { count: 0, start: now };
    if (now - entry.start > WINDOW_MS) { entry.count = 0; entry.start = now; }
    entry.count++;
    RATE_LIMIT.set(ip, entry);
    if (entry.count > MAX_REQ) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const { respostas } = req.body || {};
    if (!respostas || typeof respostas !== 'object') {
        return res.status(400).json({ error: 'Campo "respostas" obrigatório (objeto).' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ role: 'user', parts: [{ text: buildUserMessage(respostas) }] }],
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.4,
                maxOutputTokens: 512,
                responseMimeType: 'application/json',
            },
        });

        clearTimeout(timeout);

        const parsed = safeParseJSON(response.text ?? '');
        if (!isValidQuote(parsed)) {
            throw new Error('Resposta da IA fora do formato esperado.');
        }

        return res.status(200).json({ source: 'gemini', ...parsed });
    } catch (err) {
        console.error('[quote.js] Gemini error:', err?.message || err);
        return res.status(500).json({ error: err?.message || 'Erro interno Gemini' });
    }
}
