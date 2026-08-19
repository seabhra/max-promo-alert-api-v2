// awin-webhook.js - Recebe notificações da Awin
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('📨 Webhook da Awin recebido!');
    console.log('📦 Método:', req.method);
    
    // Se for GET, retorna confirmação
    if (req.method === 'GET') {
      return res.status(200).send('Webhook Awin está ativo!');
    }

    // Processar POST (notificação)
    const body = req.body;
    console.log('📦 Dados recebidos:', JSON.stringify(body, null, 2));

    // Verificar se é uma notificação de transação
    if (body.transaction) {
      const transacao = body.transaction;
      
      const sql = neon(process.env.DATABASE_URL);
      
      // Salvar transação no Neon
      await sql`
        INSERT INTO transacoes_awin (
          awin_transaction_id,
          programa_id,
          programa_nome,
          valor,
          comissao,
          moeda,
          status,
          data_transacao,
          dados_brutos
        ) VALUES (
          ${transacao.id || body.id || 'N/A'},
          ${transacao.advertiserId || null},
          ${transacao.advertiserName || null},
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
      
      return res.status(200).json({
        success: true,
        message: 'Transação recebida e salva com sucesso!'
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
            data_transacao,
            dados_brutos
          ) VALUES (
            ${t.id || 'N/A'},
            ${t.advertiserId || null},
            ${t.advertiserName || null},
            ${t.amount || null},
            ${t.commissionAmount || null},
            ${t.currency || 'GBP'},
            ${t.status || 'pending'},
            ${t.transactionDate || new Date().toISOString()},
            ${t}
          )
          ON CONFLICT (awin_transaction_id) DO UPDATE SET
            status = EXCLUDED.status,
            dados_brutos = EXCLUDED.dados_brutos,
            atualizado_em = CURRENT_TIMESTAMP
        `;
        count++;
      }
      
      console.log(`✅ ${count} transações salvas com sucesso!`);
      
      return res.status(200).json({
        success: true,
        message: `${count} transações salvas com sucesso!`
      });
    }

    // Se chegou aqui, a estrutura não foi reconhecida
    console.log('⚠️ Estrutura não reconhecida, salvando como recebido');
    return res.status(200).json({
      success: true,
      message: 'Webhook recebido (estrutura não reconhecida)',
      recebido: body
    });

  } catch (err) {
    console.error('❌ Erro no webhook da Awin:', err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
};
