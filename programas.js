// programas.js - Listar programas da Awin salvos no Neon
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Suporte a filtros via query string
    const { setor, limite = 100, pagina = 1 } = req.query;
    const offset = (pagina - 1) * limite;
    
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
    
    // Adicionar ordenação e limites
    const result = await query;
    const total = result.length;
    const paginados = result.slice(offset, offset + parseInt(limite));

    res.status(200).json({
      success: true,
      total,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      programas: paginados
    });

  } catch (err) {
    console.error('❌ Erro ao listar programas:', err);
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
};
