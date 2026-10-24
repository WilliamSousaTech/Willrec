// firebase-config.js — chaves PÚBLICAS do projeto Firebase (Console > Configurações do projeto)
// Essas chaves não são segredo (o apiKey aqui não autentica nada sozinho) — pode ficar no git
// aberto numa boa. A segurança real é feita pelas Regras do Firestore (ver firestore.rules).
//
// Projeto: willrec-a13a3 (já preenchido).
// Crie um projeto novo (recomendado, separado do VELOX) em https://console.firebase.google.com
// > Adicionar projeto > Compilação > Firestore Database > Criar banco de dados.
// Depois: Configurações do projeto > Geral > Seus apps > Web (</>) > copiar o objeto abaixo.
//
// Se preferir não configurar o Firebase agora, tudo bem: o site funciona normalmente sem ele —
// o lead continua chegando pra você via WhatsApp, só não fica salvo numa lista à parte.
window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyA_gaDGYJDD6J64yoo35evXrYKbCFajcng",
    authDomain: "willrec-a13a3.firebaseapp.com",
    projectId: "willrec-a13a3",
    storageBucket: "willrec-a13a3.firebasestorage.app",
    messagingSenderId: "879806763995",
    appId: "1:879806763995:web:ebdb37d272106ddf6c8dfe"
};

// E-mails (conta Google) que podem entrar no painel /admin. Tem que ser o MESMO e-mail das regras em firestore.rules.
// (Esta lista só decide o que a tela mostra; quem protege os dados de verdade são as regras do Firestore.)
window.ADMIN_EMAILS = ["williamsousa.tech@gmail.com"];
