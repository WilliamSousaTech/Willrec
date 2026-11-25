# Checklist de qualidade — WILLREC

Lista de revisão de UX e publicação do site. Use antes de cada publicação.

- **[auto]**: o script confere sozinho. Para rodar: `python3 tools/qa/revisar-site.py`. Para testar o site no ar: `python3 tools/qa/revisar-site.py https://willrec.vercel.app/`.
- **[iPhone]**: precisa ser conferido no celular de verdade.

A última revisão foi em 25/11/2026 (v25). Resultado: 89 de 89 verificações automáticas OK, e axe sem erros nos dois temas.

---

## 1. Navegação

- [x] **[auto]** O menu de baixo leva cada item à seção certa: Início, Portfólio, Sobre, Serviços, Orçamento e Contato. O item da seção atual fica marcado.
- [x] **[auto]** O título da seção para logo abaixo da barra de cima, sem ficar escondido atrás dela.
- [x] **[auto]** O logo WILLREC da barra volta ao topo.
- [x] **[auto]** "Ver trabalhos", "Pedir orçamento" e "Pular para os trabalhos" (teclado) caem no lugar certo.
- [x] **[auto]** Os links diretos funcionam:
  - `…/#orcamento` abre já na seção;
  - `…/#v-casamento` abre o vídeo em tela cheia.
- [x] O botão "voltar" do celular sai do site, sem andar de seção em seção.
- [ ] **[iPhone]** Tocar em cada item do menu de baixo, partindo do topo e do meio do feed. Nenhum pode voltar para o início sozinho.

## 2. Abertura (2 passos)

- [x] **[auto]** O passo 1 mostra a foto, o WILLREC grande e "Visão · Ritmo · Histórias".
- [x] **[auto]** O passo 2 mostra o nome menor, a frase, o texto e os botões. Os botões só aceitam toque depois que aparecem.
- [x] A troca do nome segue a posição da rolagem quadro a quadro, sem esperar o JavaScript.
  - Safari 26+ e Chrome usam `animation-timeline: scroll()`.
  - Nos outros navegadores, o `js/parallax.js` faz a mesma animação.
- [x] Nada pesado anima na rolagem: sem desfoque (blur) e sem repintura. Só posição e opacidade, na GPU.
- [x] Com "reduzir movimento" ou com o celular deitado, a abertura não prende a rolagem e já mostra o passo 2.
- [ ] **[iPhone]** Arrastar o dedo devagar e rápido. O nome tem que acompanhar o dedo, sem travadinhas.

## 3. Portfólio

- [x] **[auto]** Os botões do perfil abrem o destino certo:
  - Pedir orçamento → seção do orçamento;
  - Mensagem → WhatsApp;
  - Seguir → Instagram;
  - Acervo → Drive.
- [x] **[auto]** Os destaques abrem os vídeos da categoria como stories. O toque à direita passa para o próximo, e o Esc ou o "Fechar" fecha.
- [x] **[auto]** As abas Reels e Grade trocam. A grade mostra todos os vídeos, e cada bloco abre o seu.
- [x] **[auto]** No feed:
  - o vídeo do centro toca sozinho, sem som;
  - o botão de som liga o áudio;
  - o toque no vídeo pausa e continua.
- [x] **[auto]** Os botões do feed funcionam:
  - "Tela cheia" continua de onde o vídeo estava;
  - "Quero assim" abre o WhatsApp citando o vídeo;
  - "Enviar" compartilha ou copia o link.
- [x] **[auto]** No fim do feed, "Ver todos os vídeos" abre a Grade.
- [x] **[auto]** Todo vídeo e capa citado em `data/videos.json` existe em `media/reel/`.
- [ ] **[iPhone]** Ligar o som de um vídeo e conferir que a música está lá.
  - Só o Criativo ainda está sem som, porque o original não foi enviado.

## 4. Sobre, orçamento e contato

- [x] **[auto]** Tocar na foto do "Quem sou eu?" troca a foto. O vídeo do gimbal carrega e toca.
- [x] **[auto]** O orçamento funciona do começo ao fim:
  - avisa quando falta o nome ou o contato;
  - mostra a faixa de preço e o botão do WhatsApp;
  - "Refazer" volta à primeira pergunta.
- [x] Pelo teclado, o foco acompanha as perguntas do orçamento, e o aviso de erro é lido pelo leitor de tela.
- [x] **[auto]** O contato leva para o WhatsApp, o Instagram e o Drive. O rodapé mostra o ano atual.
- [x] **[auto]** Todo link do WhatsApp tem o número (5586995419670) e uma mensagem pronta.

## 5. Acessibilidade e leitura

- [x] **[auto]** Todo botão e link tem nome para o leitor de tela. Links externos abrem em nova aba com `rel="noopener"`.
- [x] axe (WCAG) não encontrou erros nos temas claro e escuro, em 1440, 1280, 820, 390 e 360 px.
- [x] O contraste do texto está OK nos dois temas. Os únicos alertas são as letras decorativas de fundo ("WILL" e "REC"), que são escondidas do leitor de tela.
- [x] Alvos de toque têm 44 px ou mais, e o texto tem 12 px ou mais.
- [x] Não há rolagem lateral, e o layout não pula ao abrir (CLS perto de 0).
- [x] O foco aparece (contorno laranja) para quem usa teclado.

## 6. Desempenho

- [x] A foto de abertura é pré-carregada no tamanho da tela (1200, 1800 ou 2400 px), em WebP.
- [x] Os vídeos só carregam perto da tela. O próximo do feed vem com os dados, e os distantes são descarregados.
- [x] Os vídeos estão em H.264 1080p com `faststart`, então começam a tocar antes de baixar tudo. O som é AAC 160k.
- [x] As barras fixas (topo, abas e menu de baixo) são sólidas, sem `backdrop-filter`. O desfoque sobre vídeo e foto em movimento travava a rolagem no iPhone.
- [x] Não há "encaixe" (scroll-snap) na página. No Safari, ele fazia o menu voltar ao início.

## 7. Publicação (DevOps)

- [x] Ao trocar vídeo ou capa com o mesmo nome, aumentar `mediaVersion` em `data/videos.json`. Assim o navegador baixa a versão nova.
- [x] Ao mudar CSS ou JS, aumentar o `?v=` no `index.html` e nos `import` do `js/main.js`, porque o cache é de 1 hora.
- [x] O `vercel.json` define:
  - cache de 7 dias para mídia, 1 hora para CSS/JS e 5 minutos para `data/`;
  - `nosniff`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`.
- [x] `404.html` próprio, com "Voltar ao início" e WhatsApp.
- [x] `robots.txt` e `sitemap.xml` (data atualizada). A prévia da Vercel não é indexada (`noindex`).
- [x] Vercel: nenhum erro de servidor nos últimos 7 dias (`/api/quote`).

### Antes de publicar

1. Rodar `python3 tools/qa/revisar-site.py`. O resultado precisa ser "OK" em tudo.
2. Enviar para a branch de prévia e esperar o deploy da Vercel ficar **Ready**.
3. Abrir a prévia no iPhone e passar os itens marcados **[iPhone]**.
4. Publicar: levar a branch para a `main`. A Vercel publica sozinha em willrec.vercel.app.
5. Rodar `python3 tools/qa/revisar-site.py https://willrec.vercel.app/`.

### Se algo der errado no ar

No painel da Vercel, abra **Deployments**, escolha a versão anterior e clique em **Promote to Production**. O site volta em segundos, sem mexer no código.
