const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const AWIN_TOKEN = process.env.AWIN_TOKEN;
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    console.log('🔍 Buscando programas da Awin...');
    
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
      throw new Error(`Erro na API: ${response.status}`);
    }

    const programas = await response.json();
    
    // Pegar os 3 primeiros para análise
    const amostra = programas.slice(0, 3);
    
    // Analisar estrutura de status
    const statusInfo = programas.slice(0, 10).map(p => ({
      id: p.id,
      nome: p.name,
      temStatus: !!p.status,
      status: p.status || 'N/A',
      temPrimaryRegion: !!p.primaryRegion,
      primaryRegionStatus: p.primaryRegion?.status || 'N/A'
    }));

    return res.status(200).json({
      total: programas.length,
      amostra,
      statusInfo,
      camposDisponiveis: Object.keys(programas[0] || {}),
      exemploCompleto: programas[0]
    });

  } catch (err) {
    console.error('❌ Erro:', err);
    return res.status(500).json({ 
      error: err.message,
      stack: err.stack
    });
  }
};
