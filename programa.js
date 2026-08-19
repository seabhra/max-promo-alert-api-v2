// programa.js - Buscar um programa específico por ID
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({
        error: 'Parâmetro "id" é obrigatório',
        exemplo: '/programa?id=3'
      });
    }

    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`
      SELECT * FROM programas_awin 
      WHERE awin_id = ${parseInt(id)}
      AND status = 'active'
    `;

    if (result.length === 0) {
      return res.status(404).json({
        error: `Programa com ID ${id} não encontrado`
      });
    }

    res.status(200).json({
      success: true,
      programa: result[0]
    });

  } catch (err) {
    console.error('❌ Erro:', err);
    res.status(500).json({ error: err.message });
  }
};
