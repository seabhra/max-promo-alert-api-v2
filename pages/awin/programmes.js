// api/awin/programmes.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Conectar ao Neon
    const sql = neon(process.env.DATABASE_URL);
    
    // Buscar programas da Awin (API externa)
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

    // Salvar/atualizar no Neon
    for (const p of programas) {
      await sql`
        INSERT INTO programas_awin (
          awin_id, nome, descricao, moeda, regiao, setor, 
          url_click, url_logo, atualizado_em
        ) VALUES (
          ${p.id}, ${p.name}, ${p.description}, 
          ${p.currencyCode}, ${p.primaryRegion?.countryCode}, 
          ${p.primaryRegion?.primarySector},
          ${p.clickThroughUrl}, ${p.logoUrl || null},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (awin_id) 
        DO UPDATE SET
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

    // Buscar programas salvos no banco
    const programasSalvos = await sql`
      SELECT * FROM programas_awin 
      ORDER BY nome ASC
    `;

    return res.status(200).json(programasSalvos);

  } catch (err) {
    console.error('Erro ao sincronizar programas:', err);
    return res.status(500).json({ error: err.message });
  }
}