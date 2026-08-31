// api/awin/commission.js
export default async function handler(req, res) {
  // ... CORS ...
  
  try {
    const AWIN_TOKEN = process.env.AWIN_TOKEN;
    const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;

    const response = await fetch(
      `https://api.awin.com/publishers/${PUBLISHER_ID}/commission/`,
      {
        headers: {
          'Authorization': `Bearer ${AWIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    return res.status(200).json(data || []);

  } catch (err) {
    console.error('Erro ao buscar comissões:', err);
    return res.status(500).json({ error: err.message });
  }
}