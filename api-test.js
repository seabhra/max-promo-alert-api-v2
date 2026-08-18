// api-test.js - Rota na raiz para testar a conexão com Neon
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Tenta conectar ao Neon usando a DATABASE_URL
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT version()`;
    
    res.status(200).json({ 
      success: true, 
      message: 'Conectado ao Neon com sucesso!', 
      db: result[0]
    });
  } catch (err) {
    console.error('Erro Neon:', err);
    res.status(500).json({ 
      error: err.message,
      hint: 'Verifique se DATABASE_URL está configurada no Vercel'
    });
  }
};
