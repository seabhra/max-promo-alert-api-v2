const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const sql = neon(process.env.DATABASE_URL);
    const AWIN_TOKEN = process.env.AWIN_TOKEN;
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    const response = await fetch(
      `https://api.awin.com/publishers/${PUBLISHER_ID}/programmes/`,
      { headers: { 'Authorization': `Bearer ${AWIN_TOKEN}` } }
    );

    const programas = await response.json();
    let count = 0;

    for (const p of programas) {
      await sql`
        INSERT INTO programas_awin (awin_id, nome, descricao, moeda, regiao, setor, url_click, url_logo)
        VALUES (${p.id}, ${p.name}, ${p.description}, ${p.currencyCode}, ${p.primaryRegion?.countryCode}, ${p.primaryRegion?.primarySector}, ${p.clickThroughUrl}, ${p.logoUrl})
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
      count++;
    }

    res.status(200).json({ success: true, message: `${count} programas sincronizados` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
