const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
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
    
    // Preparar dados para inserção em massa
    const valores = programas.map(p => ({
      awin_id: p.id,
      nome: p.name || 'Sem nome',
      descricao: p.description || null,
      moeda: p.currencyCode || null,
      regiao: p.primaryRegion?.countryCode || null,
      setor: p.primaryRegion?.primarySector || null,
      url_click: p.clickThroughUrl || null,
      url_logo: p.logoUrl || null
    }));

    // Inserir todos de uma vez (mais rápido)
    for (const v of valores) {
      await sql`
        INSERT INTO programas_awin (
          awin_id, nome, descricao, moeda, regiao, setor, url_click, url_logo
        ) VALUES (
          ${v.awin_id}, ${v.nome}, ${v.descricao}, ${v.moeda}, 
          ${v.regiao}, ${v.setor}, ${v.url_click}, ${v.url_logo}
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
      `;
    }

    return res.status(200).json({
      success: true,
      message: `${programas.length} programas sincronizados`
    });

  } catch (err) {
    console.error('❌ Erro:', err);
    return res.status(500).json({ error: err.message });
  }
};
