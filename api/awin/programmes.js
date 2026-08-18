// api/awin/programmes.js
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const AWIN_TOKEN = process.env.AWIN_TOKEN;
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID; // 2933261

    // Verificar se as variáveis existem
    console.log('🔑 Awin Programmes:', { 
      token: AWIN_TOKEN ? '✅ OK' : '❌ MISSING', 
      publisher: PUBLISHER_ID || '❌ MISSING' 
    });

    if (!AWIN_TOKEN || !PUBLISHER_ID) {
      return res.status(500).json({ 
        error: 'Variáveis de ambiente da Awin não configuradas',
        missing: {
          AWIN_TOKEN: !AWIN_TOKEN,
          AWIN_PUBLISHER_ID: !PUBLISHER_ID
        }
      });
    }

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

    if (!response.ok) {
      throw new Error(`Erro na API da Awin: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📊 Programas encontrados:', data.length || 0);

    return res.status(200).json(data || []);

  } catch (err) {
    console.error('❌ Erro ao buscar programas da Awin:', err);
    return res.status(500).json({ 
      error: err.message,
      type: err.constructor.name,
      hint: 'Verifique: 1) AWIN_TOKEN válido, 2) AWIN_PUBLISHER_ID correto (2933261), 3) Conexão com internet'
    });
  }
}