const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
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
    
    // Pegar os 3 primeiros para análise
    const amostra = programas.slice(0, 3);
    
    // Verificar estrutura de status
    const statusInfo = programas.map(p => ({
      id: p.id,
      nome: p.name,
      temStatus: !!p.status,
      status: p.status || 'N/A',
      temPrimaryRegion: !!p.primaryRegion,
      primaryRegionStatus: p.primaryRegion?.status || 'N/A'
    })).slice(0, 10);

    return res.status(200).json({
      total: programas.length,
      amostra,
      statusInfo,
      estrutura: Object.keys(programas[0] || {})
    });

  } catch (err) {
    console.error('❌ Erro:', err);
    return res.status(500).json({ error: err.message });
  }
};
