import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { loja_nome, loja_url, loja_categoria, loja_email, status, pix_txid, valor_pago } = req.body;
  const { error } = await supabase.from('solicitacoes_lojas').insert([
    { loja_nome, loja_url, loja_categoria, loja_email, status, pix_txid, valor_pago }
  ]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}