// api/awin/sync.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Verificar autenticação (CRON_SECRET)
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const AWIN_TOKEN = process.env.AWIN_TOKEN;
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    // Buscar programas da Awin
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

    // Inserir/atualizar no Neon
    let count = 0;
    for (const p of programas) {
      await sql`
        INSERT INTO programas_awin (awin_id, nome, descricao, moeda, regiao, setor, url_click, url_logo)
        VALUES (${p.id}, ${p.name}, ${p.description}, ${p.currencyCode}, ${p.primaryRegion?.countryCode}, ${p.primaryRegion?.primarySector}, ${p.clickThroughUrl}, ${p.logoUrl || null})
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

    return res.status(200).json({ 
      success: true, 
      message: `${count} programas sincronizados com o Neon`
    });

  } catch (err) {
    console.error('Erro na sincronização:', err);
    return res.status(500).json({ error: err.message });
  }
}