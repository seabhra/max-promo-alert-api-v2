// api/programas.js
const { neon } = require('@neondatabase/serverless');

module.exports = async (req, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`
      SELECT * FROM programas_awin 
      WHERE status = 'active'
      ORDER BY nome ASC
    `;
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};