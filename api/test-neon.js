import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT version()`;
    res.status(200).json({ 
      success: true, 
      message: 'Conectado ao Neon!', 
      db: result[0]
    });
  } catch (err) {
    console.error('Erro Neon:', err);
    res.status(500).json({ 
      error: err.message,
      hint: 'Verifique se DATABASE_URL está configurada no Vercel'
    });
  }
}
