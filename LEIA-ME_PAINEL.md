# Painel privado (/admin) — como ligar

O painel fica em `https://willrec.vercel.app/admin/`. Ele só funciona depois que o Firebase está configurado (uns 10 minutos, uma vez).
Sem isso o site continua igual; só o painel mostra "Firebase ainda não configurado".

## 1. Criar o projeto no Firebase
1. Acesse <https://console.firebase.google.com> → **Adicionar projeto** (pode ser um novo, separado do VELOX).
2. **Compilação → Firestore Database → Criar banco de dados** (modo produção).
3. **Compilação → Authentication → Vamos começar → Google → Ativar** (escolha o seu e-mail como e-mail de suporte).
4. **Authentication → Configurações → Domínios autorizados → Adicionar domínio:** `willrec.vercel.app`
   (sem isso o botão "Entrar com Google" mostra "endereço não autorizado").
5. **Configurações do projeto → Seus apps → Web (`</>`)** → copie o objeto de configuração.

## 2. Preencher os arquivos
- `firebase-config.js`: cole as chaves no lugar dos valores de exemplo e já estão preenchidos com o projeto willrec-a13a3 e o e-mail williamsousa.tech@gmail.com.
- `firestore.rules`: já estão preenchidos com o projeto willrec-a13a3 e o e-mail williamsousa.tech@gmail.com.
  É essa regra que protege os dados; a lista do `firebase-config.js` só decide o que a tela mostra.

## 3. Publicar
Suba o projeto como de costume (Vercel). Abra `/admin/`, toque em **Entrar com Google**.
No celular, use "Adicionar à tela inicial" para abrir como um app.

## O que o painel faz
- **Agenda:** trabalhos por dia, com aviso de **hoje** e **amanhã**, e uma lista "Para entregar" (gravados ou em edição com data passada).
  - **Lembrar cliente:** abre o WhatsApp do cliente com a mensagem pronta ("Oi, Ana! Passando pra confirmar a nossa gravação amanhã às 16:30 em…"). Você só toca em enviar.
  - **Agenda:** baixa um arquivo `.ics` que entra no calendário do celular com **alarmes 1 dia e 2 horas antes**. Esses alertas funcionam com o site fechado.
  - **→ Gravado / Editando / Entregue:** avança o status com um toque.
- **Pedidos:** quem fez o orçamento no site aparece aqui (nome, contato, pacote, faixa e respostas). **Responder** abre o WhatsApp;
  **Virar trabalho** já preenche o cadastro (só falta a data); **Arquivar** tira da lista.
- **Dinheiro:** por mês, o total fechado, o recebido (sinal ou pago) e o que falta receber.

## Limites (de propósito, por enquanto)
- Lembrete **automático** com o site fechado é feito pelo calendário do celular (arquivo `.ics`). Avisar por Telegram ou notificação push exige uma tarefa agendada no servidor; fica para uma próxima etapa.
- WhatsApp automático (sem você tocar em enviar) exige a API oficial paga do WhatsApp Business. Não está incluído.

## Se algo der errado
- "Sem permissão no Firestore": as regras ainda não foram publicadas, ou o e-mail das regras é diferente do que você usou para entrar.
- "Este endereço não está autorizado": faltou o passo 1.4.
- Entrou, mas "A conta … não tem acesso": o e-mail não está em `ADMIN_EMAILS`.
