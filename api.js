const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { rota } = req.query;
  
  try {
    if (rota === 'sync-awin') {
      const sql = neon(process.env.DATABASE_URL);
      const AWIN_TOKEN = process.env.AWIN_TOKEN;
      const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

      const response = await fetch(
        `https://api.awin.com/publishers/${PUBLISHER_ID}/programmes/`,
        {
          headers: { 
            'Authorization': `Bearer ${AWIN_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const programas = await response.json();
      const ativos = programas.filter(p => p.status === 'Active').slice(0, 200);

      // Inserção em lote (mais rápido)
      for (const p of ativos) {
        await sql`
          INSERT INTO programas_awin (
            awin_id, nome, descricao, moeda, regiao, setor, url_click, url_logo, status
          ) VALUES (
            ${p.id}, ${p.name}, ${p.description}, ${p.currencyCode}, 
            ${p.primaryRegion?.countryCode}, ${p.primarySector},
            ${p.clickThroughUrl}, ${p.logoUrl}, 'active'
          )
          ON CONFLICT (awin_id) DO NOTHING
        `;
      }

      return res.status(200).json({
        success: true,
        message: `${ativos.length} programas sincronizados`
      });
    }

    // ... outras rotas
    if (rota === 'programas') {
      const sql = neon(process.env.DATABASE_URL);
      const result = await sql`
        SELECT * FROM programas_awin 
        WHERE status = 'active'
        ORDER BY nome ASC
        LIMIT 100
      `;
      return res.status(200).json({
        success: true,
        total: result.length,
        programas: result
      });
    }

    if (rota === 'test-neon') {
      const sql = neon(process.env.DATABASE_URL);
      const result = await sql`SELECT version()`;
      return res.status(200).json({
        success: true,
        message: 'Neon conectado!',
        db: result[0]
      });
    }

    return res.status(404).json({ 
      error: 'Rota não encontrada',
      rotas: ['sync-awin', 'programas', 'test-neon']
    });

  } catch (err) {
    console.error('❌ Erro:', err);
    return res.status(500).json({ error: err.message });
  }
};
