// api/test-db.js
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT version()`;
    res.status(200).json({ 
      success: true, 
      message: 'Conectado ao Neon!', 
      version: result[0].version 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}