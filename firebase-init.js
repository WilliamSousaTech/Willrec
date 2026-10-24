// firebase-init.js — salva o pedido do orçamento no Firestore (coleção "leads"), quando o Firebase está configurado.
// O Firebase só é baixado NO MOMENTO de salvar um pedido (depois do resultado do orçamento): fora do caminho crítico,
// sem custo para quem só olha o site. Se firebase-config.js ainda tem os valores de exemplo, nada é baixado e o
// WhatsApp continua funcionando normalmente.
const configurado = () => {
    const c = window.FIREBASE_CONFIG;
    return !!c && !!c.apiKey && c.apiKey !== 'SUA_API_KEY_AQUI';
};

let pronto = null;
function iniciar() {
    if (!pronto) {
        pronto = Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'),
        ]).then(([app, fs]) => ({ fs, db: fs.getFirestore(app.initializeApp(window.FIREBASE_CONFIG)) }));
    }
    return pronto;
}

// dados: { nome, contato, respostas, pacote, faixaPreco, fonte } — os mesmos campos que firestore.rules aceita.
export async function salvarLead(dados) {
    if (!configurado()) return false;
    const { fs, db } = await iniciar();
    await fs.addDoc(fs.collection(db, 'leads'), { ...dados, criadoEm: fs.serverTimestamp() });
    return true;
}
