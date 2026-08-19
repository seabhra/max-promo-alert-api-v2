// awin-webhook.js - Recebe notificações da Awin
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  // ... (cabeçalhos CORS permanecem iguais) ...

  try {
    console.log('📨 Webhook da Awin recebido!');
    
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, message: 'Webhook Awin está ativo!' });
    }

    const body = req.body;
    console.log('📦 Dados recebidos:', JSON.stringify(body, null, 2));

    // ... (verificação de transação) ...

    if (body.transaction) {
      const transacao = body.transaction;
      const sql = neon(process.env.DATABASE_URL);
      
      // Inserir apenas os campos que existem na tabela
      await sql`
        INSERT INTO transacoes_awin (
          awin_transaction_id,
          programa_id,
          valor,
          comissao,
          moeda,
          status,
          data_transacao,
          dados_brutos
        ) VALUES (
          ${transacao.id || body.id || 'N/A'},
          ${transacao.advertiserId || null},
          ${transacao.amount || null},
          ${transacao.commissionAmount || null},
          ${transacao.currency || 'GBP'},
          ${transacao.status || 'pending'},
          ${transacao.transactionDate || new Date().toISOString()},
          ${body}
        )
        ON CONFLICT (awin_transaction_id) DO UPDATE SET
          status = EXCLUDED.status,
          dados_brutos = EXCLUDED.dados_brutos,
          atualizado_em = CURRENT_TIMESTAMP
      `;

      console.log('✅ Transação salva com sucesso!');
      return res.status(200).json({ success: true, message: 'Transação recebida e salva com sucesso!' });
    }

    // ... (lida com lista de transações) ...

    return res.status(200).json({
      success: true,
      message: 'Webhook recebido (estrutura não reconhecida)',
      recebido: body
    });

  } catch (err) {
    console.error('❌ Erro no webhook da Awin:', err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
