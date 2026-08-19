// awin-webhook-v2.js - Recebe notificações da Awin (versão limpa)
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('📨 Webhook da Awin v2 recebido!');
    
    if (req.method === 'GET') {
      return res.status(200).json({ 
        success: true, 
        message: 'Webhook Awin v2 está ativo!' 
      });
    }

    const body = req.body;
    console.log('📦 Dados recebidos:', JSON.stringify(body, null, 2));

    // Verificar se é uma transação
    const transacao = body.transaction || body;
    
    if (transacao.id || transacao.transactionId) {
      const sql = neon(process.env.DATABASE_URL);
      
      console.log('💾 Salvando transação:', transacao.id);
      
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
          ${transacao.id || transacao.transactionId || 'N/A'},
          ${transacao.advertiserId || transacao.merchantId || null},
          ${transacao.advertiserName || transacao.merchantName || null},
          ${transacao.amount || transacao.saleAmount || null},
          ${transacao.commissionAmount || transacao.commission || null},
          ${transacao.currency || 'GBP'},
          ${transacao.status || 'pending'},
          ${transacao.transactionDate || transacao.date || new Date().toISOString()}
        )
        ON CONFLICT (awin_transaction_id) DO UPDATE SET
          status = EXCLUDED.status,
          valor = EXCLUDED.valor,
          comissao = EXCLUDED.comissao,
          atualizado_em = CURRENT_TIMESTAMP
      `;

      console.log('✅ Transação salva com sucesso!');
      return res.status(200).json({
        success: true,
        message: 'Transação recebida e salva com sucesso! (v2)'
      });
    }

    // Se for uma lista de transações
    if (body.transactions && Array.isArray(body.transactions)) {
      const sql = neon(process.env.DATABASE_URL);
      let count = 0;
      
      for (const t of body.transactions) {
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
            ${t.id || t.transactionId || 'N/A'},
            ${t.advertiserId || t.merchantId || null},
            ${t.advertiserName || t.merchantName || null},
            ${t.amount || t.saleAmount || null},
            ${t.commissionAmount || t.commission || null},
            ${t.currency || 'GBP'},
            ${t.status || 'pending'},
            ${t.transactionDate || t.date || new Date().toISOString()}
          )
          ON CONFLICT (awin_transaction_id) DO UPDATE SET
            status = EXCLUDED.status,
            valor = EXCLUDED.valor,
            comissao = EXCLUDED.comissao,
            atualizado_em = CURRENT_TIMESTAMP
        `;
        count++;
      }
      
      console.log(`✅ ${count} transações salvas com sucesso!`);
      return res.status(200).json({
        success: true,
        message: `${count} transações salvas com sucesso! (v2)`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook recebido (estrutura não reconhecida)',
      recebido: body
    });

  } catch (err) {
    console.error('❌ Erro no webhook da Awin v2:', err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
};
