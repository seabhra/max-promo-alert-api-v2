// transacoes.js - Listar transações da Awin
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Parâmetros de filtro
    const { 
      status, 
      programa_id, 
      limite = 100, 
      pagina = 1,
      data_inicio,
      data_fim
    } = req.query;
    
    const offset = (pagina - 1) * limite;
    
    // Buscar transações
    let query = sql`
      SELECT * FROM transacoes_awin 
      WHERE 1=1
    `;
    
    if (status) {
      query = sql`
        SELECT * FROM transacoes_awin 
        WHERE status = ${status}
      `;
    }
    
    if (programa_id) {
      query = sql`
        SELECT * FROM transacoes_awin 
        WHERE programa_id = ${parseInt(programa_id)}
      `;
    }
    
    if (data_inicio) {
      query = sql`
        SELECT * FROM transacoes_awin 
        WHERE data_transacao >= ${data_inicio}
      `;
    }
    
    if (data_fim) {
      query = sql`
        SELECT * FROM transacoes_awin 
        WHERE data_transacao <= ${data_fim}
      `;
    }
    
    // Contar total
    const totalResult = await query;
    const total = totalResult.length;
    
    // Aplicar paginação
    const transacoes = totalResult.slice(offset, offset + parseInt(limite));

    // Calcular resumo
    const totalValor = transacoes.reduce((sum, t) => sum + parseFloat(t.valor || 0), 0);
    const totalComissao = transacoes.reduce((sum, t) => sum + parseFloat(t.comissao || 0), 0);

    res.status(200).json({
      success: true,
      total,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      resumo: {
        total_valor: totalValor.toFixed(2),
        total_comissao: totalComissao.toFixed(2)
      },
      transacoes
    });

  } catch (err) {
    console.error('❌ Erro ao listar transações:', err);
    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
};
