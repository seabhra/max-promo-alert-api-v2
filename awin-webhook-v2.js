// awin-webhook-v2.js - Recebe notificações da Awin com autenticação
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ===================================================================
    // VERIFICAÇÃO DE AUTENTICAÇÃO (segurança)
    // ===================================================================
    const token = req.headers['x-awin-signature'] || req.headers['authorization'];
    const expectedToken = process.env.AWIN_WEBHOOK_SECRET;
    
    if (expectedToken && token !== expectedToken) {
      console.warn('⚠️ Token inválido recebido:', token);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Token de autenticação inválido'
      });
    }

    console.log('📨 Webhook da Awin v2 recebido!');
    
    if (req.method === 'GET') {
      return res.status(200).json({ 
        success: true, 
        message: 'Webhook Awin v2 está ativo!' 
      });
    }

    const body = req.body;
    console.log('📦 Dados recebidos:', JSON.stringify(body, null, 2));

    // Identificar transação em diferentes formatos
    let transacoes = [];
    
    if (body.transaction) {
      transacoes = [body.transaction];
    } else if (body.transactions && Array.isArray(body.transactions)) {
      transacoes = body.transactions;
    } else if (body.id || body.transactionId) {
      transacoes = [body];
    } else if (Array.isArray(body)) {
      transacoes = body;
    }

    if (transacoes.length === 0) {
      console.log('⚠️ Nenhuma transação encontrada');
      return res.status(200).json({
        success: true,
        message: 'Webhook recebido (nenhuma transação identificada)',
        recebido: body
      });
    }

    console.log(`📊 Processando ${transacoes.length} transações...`);
    
    const sql = neon(process.env.DATABASE_URL);
    let count = 0;

    for (const t of transacoes) {
      const transactionId = t.id || t.transactionId || t.awin_transaction_id || 'N/A';
      const advertiserId = t.advertiserId || t.merchantId || t.programa_id || null;
      const advertiserName = t.advertiserName || t.merchantName || t.programa_nome || null;
      const amount = t.amount || t.saleAmount || t.valor || null;
      const commission = t.commissionAmount || t.commission || t.comissao || null;
      const currency = t.currency || t.moeda || 'GBP';
      const status = t.status || 'pending';
      const transactionDate = t.transactionDate || t.date || t.data_transacao || new Date().toISOString();

      console.log(`💾 Salvando transação ${transactionId}...`);

      await sql`
        INSERT INTO transacoes_awin (
          awin_transaction_id,
          programa_id,
          programa_nome,
          valor,
          comissao,
          moeda,
          status,
          data_transacao
        ) VALUES (
          ${transactionId},
          ${advertiserId},
          ${advertiserName},
          ${amount},
          ${commission},
          ${currency},
          ${status},
          ${transactionDate}
        )
        ON CONFLICT (awin_transaction_id) DO UPDATE SET
          status = EXCLUDED.status,
          valor = EXCLUDED.valor,
          comissao = EXCLUDED.comissao
      `;
      count++;
    }

    console.log(`✅ ${count} transações salvas com sucesso!`);
    return res.status(200).json({
      success: true,
      message: `${count} transações salvas com sucesso!`,
      total: count
    });

  } catch (err) {
    console.error('❌ Erro no webhook da Awin v2:', err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
};
