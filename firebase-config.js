// firebase-config.js — chaves PÚBLICAS do projeto Firebase (Console > Configurações do projeto)
// Essas chaves não são segredo (o apiKey aqui não autentica nada sozinho) — pode ficar no git
// aberto numa boa. A segurança real é feita pelas Regras do Firestore (ver firestore.rules).
//
// ⚠️ SUBSTITUA pelos dados do SEU projeto Firebase antes de publicar.
// Crie um projeto novo (recomendado, separado do VELOX) em https://console.firebase.google.com
// > Adicionar projeto > Compilação > Firestore Database > Criar banco de dados.
// Depois: Configurações do projeto > Geral > Seus apps > Web (</>) > copiar o objeto abaixo.
//
// Se preferir não configurar o Firebase agora, tudo bem: o site funciona normalmente sem ele —
// o lead continua chegando pra você via WhatsApp, só não fica salvo numa lista à parte.
window.FIREBASE_CONFIG = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
};
