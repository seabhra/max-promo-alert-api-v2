const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('📡 Conectando ao Neon...');
    const sql = neon(process.env.DATABASE_URL);
    
    console.log('📡 Buscando programas da Awin...');
    const AWIN_TOKEN = process.env.AWIN_TOKEN;
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    if (!AWIN_TOKEN || !PUBLISHER_ID) {
      return res.status(500).json({ 
        error: 'Variáveis AWIN_TOKEN e AWIN_PUBLISHER_ID são obrigatórias'
      });
    }

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

    // Filtrar programas com status 'Active' (campo correto)
    const ativos = programas.filter(p => p.status === 'Active');
    console.log(`✅ ${ativos.length} programas ativos de ${programas.length} total`);

    let count = 0;
    for (const p of ativos) {
      try {
        await sql`
          INSERT INTO programas_awin (
            awin_id, nome, descricao, moeda, regiao, setor, url_click, url_logo, status
          ) VALUES (
            ${p.id}, 
            ${p.name || 'Sem nome'}, 
            ${p.description || null}, 
            ${p.currencyCode || null}, 
            ${p.primaryRegion?.countryCode || null}, 
            ${p.primarySector || null}, 
            ${p.clickThroughUrl || null}, 
            ${p.logoUrl || null},
            'active'
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
      } catch (err) {
        console.error(`❌ Erro ao processar programa ${p.id}:`, err.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `${count} programas ativos sincronizados com sucesso!`,
      total: programas.length,
      ativos: count
    });

  } catch (err) {
    console.error('❌ Erro na sincronização:', err);
    return res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
