// firebase-init.js — módulo único de inicialização (Firestore)
// firebase-config.js (script clássico) roda ANTES deste módulo e define
// window.FIREBASE_CONFIG. Configure as chaves lá — ver README.
//
// Se firebase-config.js ainda estiver com os valores placeholder, este
// arquivo simplesmente não inicializa nada — o site funciona 100% sem
// Firebase; o formulário de lead só deixa de salvar uma cópia extra (o
// WhatsApp continua funcionando normal).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getFirestore, collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

window.firebaseReady = false;

const cfg = window.FIREBASE_CONFIG;
const isPlaceholder = !cfg || cfg.apiKey === 'SUA_API_KEY_AQUI';

if (!isPlaceholder) {
    try {
        const app = initializeApp(cfg);
        window.db = getFirestore(app);
        window.fb = { collection, addDoc, serverTimestamp };
        window.firebaseReady = true;
    } catch (err) {
        console.warn('[firebase-init] Firebase não inicializado:', err?.message || err);
    }
} else {
    console.info('[firebase-init] FIREBASE_CONFIG ainda não configurado — leads não serão salvos no Firestore (o WhatsApp continua funcionando normalmente).');
}

window.dispatchEvent(new Event('firebase-ready'));
