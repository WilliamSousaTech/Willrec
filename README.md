# Will Rec 🎬 — Site Mobile de Orçamento Inteligente

> Landing page mobile-first para videomaker freelancer, com quiz de orçamento
> calculado por IA (Gemini + Groq) a partir das regras reais de precificação
> do negócio.

![Deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)
![IA](https://img.shields.io/badge/IA-Gemini%202.0%20Flash%20%2B%20Groq%20Llama%203.3-blue)
![License](https://img.shields.io/badge/license-ISC-green)

---

## ✨ Sobre o projeto

Site institucional + portfólio para **Will Rec (William Sousa)**, com uma seção
central de **Orçamento Inteligente**: o visitante responde 5-7 perguntas
objetivas sobre o job (perfil, tipo de evento, duração, local, prazo,
entregável) e a IA devolve uma **faixa de preço** calculada com base nas regras
reais de custo e piso de mercado do negócio — sempre terminando num botão de
WhatsApp com a mensagem já pronta pra fechar o lead.

Segue a mesma arquitetura do projeto [VELOX Seminovos](https://github.com/WilliamSousaTech/Velox):
frontend em HTML/CSS/JS puro, IA via Vercel Serverless Functions, Gemini como
motor principal e Groq/Llama 3.3 como fallback automático.

---

## 🧠 Como o orçamento funciona

```
Frontend (script.js)
    │
    ▼ POST { respostas }
api/quote.js       ──── Gemini 2.0 Flash (motor principal)
    │
    └── se erro/timeout ──► api/quote-groq.js ──── Groq Llama 3.3 70B (fallback)
                                │
                                └── se erro/timeout ──► calculateFallback()
                                                          cálculo local em
                                                          script.js — o site
                                                          NUNCA fica sem
                                                          responder um preço
```

Casos de **Político/Institucional** e **Freelancer com parceria recorrente**
não passam pela IA — são resolvidos direto no frontend com a regra fixa
"sob consulta", exatamente como pedido no briefing original (mais rápido e
sem depender de API pra esses dois casos).

As chaves de API nunca ficam expostas no frontend — tudo passa pelas funções
serverless da Vercel.

---

## 📁 Estrutura do projeto

```
willrec/
├── index.html            ← Página principal (HTML semântico + SEO)
├── styles.css             ← Design system (dark + âmbar, mobile-first)
├── script.js               ← Quiz, chamadas de IA, WhatsApp, lead
├── firebase-config.js      ← Chaves públicas do Firebase (editar)
├── firebase-init.js        ← Inicialização do Firestore (opcional)
├── firestore.rules         ← Regras de segurança do Firestore
├── api/
│   ├── quote.js            ← Serverless: Gemini (motor principal)
│   └── quote-groq.js       ← Serverless: Groq (fallback)
└── images/
    └── hero-videomaker.webp
```

## 🎨 Redesign da Home

A Home recebeu uma direção visual inspirada na referência fornecida, com linguagem
premium/cinematográfica, foco em tipografia, composição e hierarquia.

### Regra de imagens

O Hero usa somente duas fotografias:
- `images/site/willrec-hero-background.webp`: foto maior, exclusivamente como fundo.
- `images/site/willrec-phone-card.webp`: foto menor, com a mão em primeiro plano, exclusivamente no card flutuante.

Essas duas fotografias não são reutilizadas visualmente em outras seções. O restante
do portfólio mantém suas imagens próprias, sem substituir categorias por repetições.

---

## 🚀 Deploy no Vercel

### 1. Suba o projeto pro GitHub

```bash
cd willrec
git init
git add .
git commit -m "Site Will Rec — orçamento inteligente"
git remote add origin https://github.com/WilliamSousaTech/SEU-REPO.git
git push -u origin main
```

### 2. Importe no Vercel

Acesse [vercel.com/new](https://vercel.com/new), conecte o repositório e
clique em **Deploy**. Não precisa configurar build command nem output
directory — é um projeto estático + funções serverless, a Vercel detecta
sozinha.

### 3. Configure as variáveis de ambiente

No painel do Vercel → **Settings → Environment Variables**, adicione:

| Variável | Onde conseguir | Obrigatória? |
|---|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/app/apikey) — grátis | Sim (motor principal) |
| `GROQ_API_KEY` | [Groq Console](https://console.groq.com) — grátis | Recomendada (fallback) |

> Sem essas variáveis, o site continua funcionando: depois de duas falhas de
> API ele cai automaticamente no cálculo local (`calculateFallback` em
> `script.js`) e o cliente ainda recebe uma faixa de preço.

Depois de salvar, vá em **Deployments → Redeploy**.

### 4. Edite os dados do negócio antes de publicar

Abra `script.js` e troque no topo do arquivo:

```js
const CONFIG = {
    WHATSAPP_NUMBER: '5586900000000', // ⚠️ seu número real, só dígitos, com 55 + DDD
    DRIVE_LINK: 'https://drive.google.com/...', // ⚠️ link real da pasta de portfólio
    ...
};
```

E em `index.html`, troque `@willrec_oficial` pelo seu Instagram se for
diferente.

### 5. (Opcional) Configure o Firebase pra salvar os leads numa lista

O WhatsApp já garante que você recebe o pedido — o Firebase é só um "banco de
leads" extra, pra você ver tudo numa lista sem depender do WhatsApp.

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com)
2. Ative o **Firestore Database** (modo produção)
3. Em Configurações do projeto → Seus apps → Web, copie as chaves para
   `firebase-config.js`
4. Cole o conteúdo de `firestore.rules` em Firestore Database → Regras
5. Os leads aparecerão na coleção `leads` conforme forem enviados

Se pular esse passo, tudo bem — o site funciona 100% normal sem Firebase.

---

## 🛠️ Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES Modules, sem framework)
- **Backend:** Vercel Serverless Functions (Node.js)
- **IA principal:** Google Gemini 2.0 Flash (`gemini-2.0-flash`)
- **IA fallback:** Groq — Llama 3.3 70B (`llama-3.3-70b-versatile`)
- **3ª camada de fallback:** cálculo determinístico local (sempre responde)
- **Leads:** Firestore (opcional) + WhatsApp (sempre ativo)
- **Deploy:** Vercel

---

## 💰 Editando a precificação

Toda a lógica de preço vive em **três lugares que precisam ficar
sincronizados** quando você mudar sua tabela de custos:

1. `api/quote.js` → bloco `BUSINESS_CONTEXT` (o que a IA principal lê)
2. `api/quote-groq.js` → bloco `BUSINESS_CONTEXT` (o que o fallback lê)
3. `script.js` → objeto `PRICING_CONFIG` (o cálculo local de emergência)

Quando você tiver equipamento próprio (em vez de alugado/emprestado), mude
`equipamentoAlugado: false` em `PRICING_CONFIG` e ajuste o texto equivalente
nos dois arquivos de `api/`.

---

## 🔒 Segurança

- API Keys armazenadas exclusivamente em variáveis de ambiente Vercel
- Rate limiting por IP nas funções serverless (20 req/min · janela de 60s)
- Timeout de 10s com `AbortController` em toda chamada de IA
- Regras do Firestore permitem só **criar** leads pelo site — leitura e
  edição são bloqueadas publicamente

---

## 📝 Antes de publicar, não esqueça de

- [ ] Trocar `WHATSAPP_NUMBER` em `script.js`
- [ ] Trocar `DRIVE_LINK` em `script.js` pelo link real do portfólio
- [ ] Substituir os depoimentos de exemplo em `index.html` (seção
      `#depoimentos`) por avaliações reais de clientes
- [ ] Configurar `GEMINI_API_KEY` e `GROQ_API_KEY` na Vercel
- [ ] (Opcional) Configurar Firebase em `firebase-config.js`

---

## 👤 Autor

**William Sousa (Will Rec)** — Videomaker Mobile · Teresina-PI

---

## 📄 Licença

ISC © 2026 — Will Rec


## V6
- Added supplied visual image to the identity section.
- Rebuilt testimonials using the two real client feedback images.
- Removed placeholder testimonial copy in favor of real feedback-based presentation.
