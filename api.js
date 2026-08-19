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
    // Rota: sync-awin (versão otimizada)
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
      
      // Filtrar apenas os 100 primeiros para evitar timeout
      const limit = 100;
      const ativos = programas
        .filter(p => p.status === 'Active')
        .slice(0, limit);
      
      let count = 0;
      for (const p of ativos) {
        await sql`
          INSERT INTO programas_awin (
            awin_id, nome, descricao, moeda, regiao, setor, url_click, url_logo, status
          ) VALUES (
            ${p.id}, ${p.name}, ${p.description}, ${p.currencyCode}, 
            ${p.primaryRegion?.countryCode}, ${p.primarySector},
            ${p.clickThroughUrl}, ${p.logoUrl}, 'active'
          )
          ON CONFLICT (awin_id) DO UPDATE SET
            nome = EXCLUDED.nome,
            descricao = EXCLUDED.descricao,
            moeda = EXCLUDED.moeda,
            regiao = EXCLUDED.regiao,
            setor = EXCLUDED.setor,
            url_click = EXCLUDED.url_click,
            url_logo = EXCLUDED.url_logo,
            status = 'active',
            atualizado_em = CURRENT_TIMESTAMP
        `;
        count++;
      }

      return res.status(200).json({
        success: true,
        message: `${count} programas sincronizados (limitado a ${limit})`,
        total_disponiveis: programas.filter(p => p.status === 'Active').length
      });
    }

    // Rota: programas
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

    // Rota: test-neon
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
