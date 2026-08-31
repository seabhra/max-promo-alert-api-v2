import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT version()`;
    
    return res.status(200).json({ 
      success: true, 
      message: 'Conectado ao Neon!', 
      db: result[0]
    });
  } catch (err) {
    console.error('Erro Neon:', err);
    return res.status(500).json({ 
      error: err.message,
      hint: 'Verifique se DATABASE_URL está configurada no Vercel'
    });
  }
}
