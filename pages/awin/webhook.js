// api/awin/webhook.js
module.exports = (req, res) => {
  if (req.method === 'POST') {
    console.log('📨 Notificação da Awin:', req.body);
    
    // Processar a notificação (atualizar status, enviar alerta, etc.)
    // Exemplo: se transação foi aprovada, registrar no Redis
    
    return res.status(200).send('OK');
  }
  
  res.status(405).send('Method Not Allowed');
};