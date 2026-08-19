const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const AWIN_TOKEN = process.env.AWIN_TOKEN;
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    if (!AWIN_TOKEN || !PUBLISHER_ID) {
      return res.status(500).json({ 
        error: 'Variáveis AWIN_TOKEN e AWIN_PUBLISHER_ID são obrigatórias'
      });
    }

    console.log('📡 Buscando programas da Awin...');
    
    const response = await fetch(
      `https://api.awin.com/publishers/${PUBLISHER_ID}/programmes/`,
      {
        headers: { 
          'Authorization': `Bearer ${AWIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Erro na API da Awin: ${response.status} - ${response.statusText}`);
    }

    const programas = await response.json();
    console.log(`📊 Encontrados ${programas.length} programas`);

    let inseridos = 0;
    let atualizados = 0;

    for (const p of programas) {
      const result = await sql`
        INSERT INTO programas_awin (
          awin_id, nome, descricao, moeda, regiao, setor, url_click, url_logo
        ) VALUES (
          ${p.id}, 
          ${p.name || 'Sem nome'}, 
          ${p.description || null}, 
          ${p.currencyCode || null}, 
          ${p.primaryRegion?.countryCode || null}, 
          ${p.primaryRegion?.primarySector || null}, 
          ${p.clickThroughUrl || null}, 
          ${p.logoUrl || null}
        )
        ON CONFLICT (awin_id) DO UPDATE SET
          nome = EXCLUDED.nome,
          descricao = EXCLUDED.descricao,
          moeda = EXCLUDED.moeda,
          regiao = EXCLUDED.regiao,
          setor = EXCLUDED.setor,
          url_click = EXCLUDED.url_click,
          url_logo = EXCLUDED.url_logo,
          atualizado_em = CURRENT_TIMESTAMP
        RETURNING (xmax = 0) AS inserted
      `;
      
      if (result[0]?.inserted) {
        inseridos++;
      } else {
        atualizados++;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Sincronização concluída',
      total: programas.length,
      inseridos,
      atualizados
    });

  } catch (err) {
    console.error('❌ Erro na sincronização:', err);
    return res.status(500).json({ 
      error: err.message,
      stack: err.stack
    });
  }
};
