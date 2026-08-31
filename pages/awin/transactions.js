// api/awin/transactions.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Buscar transações da Awin
    const AWIN_TOKEN = process.env.AWIN_TOKEN;
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    const response = await fetch(
      `https://api.awin.com/publishers/${PUBLISHER_ID}/transactions/`,
      {
        headers: {
          'Authorization': `Bearer ${AWIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const transacoes = await response.json();

    // Salvar no Neon
    for (const t of transacoes) {
      await sql`
        INSERT INTO transacoes_awin (
          awin_transaction_id, programa_id, valor, comissao, moeda, status, data_transacao
        ) VALUES (
          ${t.id}, ${t.advertiserId}, ${t.amount}, 
          ${t.commissionAmount}, ${t.currency}, 
          ${t.status}, ${t.transactionDate}
        )
        ON CONFLICT (awin_transaction_id) DO NOTHING
      `;
    }

    // Buscar do banco
    const transacoesSalvas = await sql`
      SELECT * FROM transacoes_awin 
      ORDER BY data_transacao DESC 
      LIMIT 100
    `;

    return res.status(200).json(transacoesSalvas);

  } catch (err) {
    console.error('Erro ao buscar transações:', err);
    return res.status(500).json({ error: err.message });
  }
}