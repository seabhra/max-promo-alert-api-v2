const { coletarAwin } = require('../../collectors/awin');

module.exports = async (req, res) => {
  // Protege a rota — só o Vercel Cron (ou você manualmente com o header) pode chamar
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const total = await coletarAwin();
    res.status(200).json({ ok: true, promocoes_salvas: total });
  } catch (err) {
    console.error('Erro no collector Awin:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};