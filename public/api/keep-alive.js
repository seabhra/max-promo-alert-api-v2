import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Proteção opcional
  if (
    process.env.CRON_SECRET &&
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { error } = await supabase
    .from('promos')
    .select('id')
    .limit(1);

  if (error) {
    return res.status(500).json(error);
  }

  return res.status(200).json({
    ok: true,
    time: new Date().toISOString()
  });
}