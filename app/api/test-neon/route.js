import { neon } from '@neondatabase/serverless';

export async function GET() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT version()`;
    return Response.json({ 
      success: true, 
      message: 'Conectado ao Neon!', 
      db: result[0] 
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
