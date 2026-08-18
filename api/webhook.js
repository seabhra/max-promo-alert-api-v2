// api/webhook.js - Facebook Webhook (Vercel Serverless)

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
     const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    console.log('📨 Webhook GET:', { mode, token, challenge });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado!');
      // IMPORTANTE: challenge deve ser texto puro, sem aspas, sem JSON
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(String(challenge));
    } else {
      console.log('❌ Falha na verificação', { esperado: VERIFY_TOKEN, recebido: token });
      return res.status(403).send('Verificação falhou');
    }
  }

  if (req.method === 'POST') {
    console.log('📨 Webhook POST recebido:', JSON.stringify(req.body));
    return res.status(200).send('EVENT_RECEIVED');
  }

  res.status(405).send('Method Not Allowed');
};