const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Suporte a filtros via query string
    const { setor, limite = 100 } = req.query;
    
    let query = sql`
      SELECT * FROM programas_awin 
      WHERE status = 'active'
    `;
    
    if (setor) {
      query = sql`
        SELECT * FROM programas_awin 
        WHERE status = 'active' AND setor ILIKE ${'%' + setor + '%'}
      `;
    }
    
    const result = await query;
    
    return res.status(200).json({
      success: true,
      total: result.length,
      programas: result
    });

  } catch (err) {
    console.error('❌ Erro ao listar programas:', err);
    return res.status(500).json({ error: err.message });
  }
};
