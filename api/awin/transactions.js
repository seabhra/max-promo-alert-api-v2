// api/awin/transactions.js
module.exports = async (req, res) => {
  const AWIN_TOKEN = process.env.AWIN_TOKEN;
  const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID; // 2933261

  try {
    const response = await fetch(
      `https://api.awin.com/publishers/${PUBLISHER_ID}/transactions/`,
      {
        headers: {
          'Authorization': `Bearer ${AWIN_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    return res.status(500).json({ error: 'Erro na integração com Awin' });
  }
};