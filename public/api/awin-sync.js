// api/awin-sync.js
// Sincronização em tempo real: Awin Publisher API → Supabase (tabela: promos)
// Disparo: Vercel Cron a cada 15 min  OU  GET /api/awin-sync?secret=CRON_SECRET
//
// Endpoint confirmado em produção (21/06/2026):
//   POST https://api.awin.com/publisher/{publisherId}/promotions
//   Header: Authorization: Bearer <accessToken>   <-- accessToken na query string falha silenciosamente (200 + vazio)
//   Body: { filters: { membership, type }, pagination: { page, pageSize } }

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const AWIN_TOKEN           = process.env.AWIN_TOKEN; // accessToken da Awin (Account Settings → API Credentials)
const AWIN_PUBLISHER_ID    = process.env.AWIN_PUBLISHER_ID;

const ADVERTISER_IDS = process.env.AWIN_ADVERTISER_IDS
  ? process.env.AWIN_ADVERTISER_IDS.split(',').map(s => s.trim())
  : [];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Mapeamento tipo Awin → coluna tipo da tabela promos ──
// Confirmado em produção: o campo "type" só assume 'voucher' ou 'promotion'.
// O detalhamento (frete grátis, cashback, flash etc.) não vem estruturado —
// precisa ser inferido do título/descrição via palavras-chave.
const TIPO_MAP = {
	'frete':            'frete_gratis',
	'free shipping':    'frete_gratis',
	'cashback':         'cashback',
	'flash':            'flash',
	'relâmpago':        'flash',
	'saldão':           'saldao',
	'saldao':           'saldao',
	'outlet':           'outlet',
	'leve':             'leve',
	'compre':           'leve',
	'brinde':           'brinde',
	'gift':             'brinde',
	'mystery':          'misterio',
	'misteriosa':       'misterio',
	'dourado':          'bilhete',
	'golden ticket':    'bilhete',
	'live':             'live',
	'kit':              'combo',
	'combo':            'combo',
	'parcela':          'parcela',
	'sem juros':        'parcela',
	'sorteio':          'sorteio',
	'concorra':         'sorteio',
	'fidelidade':       'fidelidade',
	'pontos':           'fidelidade',
	'primeira compra':  'primeira',
	'novo cliente':     'primeira',
	'black friday':     'blackfriday',
	'cyber monday':     'blackfriday',
};

function mapTipo(promo) {
	const texto = `${promo.title || ''} ${promo.description || ''}`.toLowerCase();

	// 1. Palavras-chave específicas têm prioridade (mais informativas que o type genérico)
	for (const [key, value] of Object.entries(TIPO_MAP)) {
		if (texto.includes(key)) return value;
	}

	// 2. Fallback pelo type bruto da Awin
	if (promo.type === 'voucher') return 'cupom';
	if (promo.type === 'promotion') return 'desconto';

	// 3. Último fallback
	return 'desconto';
}

// ── Busca promoções na Awin Offers API ──
async function fetchAwinPromotions() {
  const url = `https://api.awin.com/publisher/${AWIN_PUBLISHER_ID}/promotions`;

  const body = {
    filters: {
      membership: 'joined',
      type: 'all',
      ...(ADVERTISER_IDS.length > 0
        ? { advertiserIds: ADVERTISER_IDS.map(id => Number(id)) }
        : {}),
    },
    pagination: {
      page: 1,
      pageSize: 100,
    },
  };


  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AWIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Awin API ${res.status}: ${await res.text()}`);

  const data = await res.json();
  // Confirmado: resposta vem em { data: [...], pagination: {...} }
  return Array.isArray(data) ? data : (data.data || data.promotions || []);
}

// ── Normaliza para o schema real da tabela promos ──
// Campos confirmados na resposta real da API (21/06/2026):
//   promotionId, type, advertiser{id,name,joined}, title, description, terms,
//   startDate, endDate, status, url, urlTracking, dateAdded, campaign,
//   regions{all,list}, categories[], voucher{code,exclusive,attributable}
function normalizar(promo) {
  let temporestante = 0;
  if (promo.endDate) {
    const diffMs = new Date(promo.endDate).getTime() - Date.now();
    temporestante = diffMs > 0 ? Math.floor(diffMs / 3600000) : 0;
  }

  // urlTracking já vem pronta da Awin com awinmid/awinaffid — não precisa remontar
  const urlAfiliado = promo.urlTracking || promo.url || null;

  return {
    tipo:          mapTipo(promo),
    titulo:        (promo.title || `Oferta ${promo.advertiser?.name}`).substring(0, 200),
    descricao:     promo.description || '',
    loja:          promo.advertiser?.name || 'Awin',
    precoold:      null,
    preconew:      null,
    cupom:         promo.voucher?.code || null,
    temporestante: temporestante,
    ativo:         promo.status === 'active',
    url_afiliado:  urlAfiliado,
    validade:      promo.endDate ? new Date(promo.endDate).toISOString() : null,
    fonte:         'AWIN',
    image_url:     null, // a Offers API não retorna imagem; manter null até decidir fonte alternativa
  };
}

// ── Upsert por (titulo + loja) para evitar duplicatas ──
async function upsertPromos(rows) {
  let inseridos = 0;
  let atualizados = 0;
  let erros = 0;

  for (const row of rows) {
    const { data: existing, error: findError } = await supabase
      .from('promos')
      .select('id')
      .eq('titulo', row.titulo)
      .eq('loja', row.loja)
      .maybeSingle();

    if (findError) {
      console.error(findError.message);
      erros++;
      continue;
    }

    let error;

    if (existing) {
      ({ error } = await supabase
        .from('promos')
        .update(row)
        .eq('id', existing.id));

      if (!error) atualizados++;
    } else {
      ({ error } = await supabase
        .from('promos')
        .insert(row));

      if (!error) inseridos++;
    }

    if (error) {
      console.error(error.message, row.titulo);
      erros++;
    }
  }

  return {
    inseridos,
    atualizados,
    erros
  };
}

// ── Desativa promoções Awin expiradas no banco ──
async function desativarExpiradas() {
  const { error } = await supabase
    .from('promos')
    .update({ ativo: false })
    .eq('fonte', 'AWIN')
    .not('validade', 'is', null)
    .lt('validade', new Date().toISOString());

  if (error) console.error('Expiradas:', error.message);
}

// ── Handler Vercel ──
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Compatível com Vercel Cron e execução manual
const auth = req.headers.authorization;
const secret = req.query.secret;

const autorizado =
  auth === `Bearer ${process.env.CRON_SECRET}` ||
  secret === process.env.CRON_SECRET;

if (process.env.CRON_SECRET && !autorizado) {
  return res.status(401).json({ error: 'Unauthorized' });
}

  try {
    const promos = await fetchAwinPromotions();
    console.log(`[awin-sync] ${promos.length} promoções recebidas`);

    if (!promos.length)
      return res.status(200).json({ ok: true, mensagem: 'Nenhuma promoção retornada', inseridos: 0 });

    const agora  = Date.now();
    const ativas = promos.filter(p => p.status === 'active' && (!p.endDate || new Date(p.endDate).getTime() > agora));
    const rows   = ativas.map(normalizar);
    const result = await upsertPromos(rows);

    await desativarExpiradas();


return res.status(200).json({
  ok: true,
  recebidas: promos.length,
  ativas: ativas.length,
  inseridas: result.inseridos,
  atualizadas: result.atualizados,
  erros: result.erros,
  expiradas: promos.length - ativas.length,
  tempo_execucao_ms: Date.now() - inicio,
  timestamp: new Date().toISOString()
});



  } catch (err) {
    console.error('[awin-sync]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}