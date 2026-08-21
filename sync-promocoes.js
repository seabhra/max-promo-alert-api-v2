// sync-promocoes.js - Sincroniza PROMOÇÕES/OFERTAS da Awin com Neon (tabela: promocoes)
// Diferente do sync.js (que só cataloga programas em `programas_awin`, sem gerar comissão) —
// este é o que efetivamente publica ofertas com link de afiliado, gerando clique e comissão.
//
// Endpoint confirmado em produção (21/06/2026):
//   POST https://api.awin.com/publisher/{publisherId}/promotions
//   Header: Authorization: Bearer <accessToken>   <-- accessToken na query string falha silenciosamente (200 + vazio)
//   Body: { filters: { membership, type }, pagination: { page, pageSize } }

const { neon } = require('@neondatabase/serverless');

const AWIN_TOKEN        = process.env.AWIN_TOKEN;
const AWIN_PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;
const sql = neon(process.env.DATABASE_URL);

const TIPO_MAP = {
	'frete': 'frete_gratis', 'free shipping': 'frete_gratis', 'cashback': 'cashback',
	'flash': 'flash', 'relâmpago': 'flash', 'saldão': 'saldao', 'saldao': 'saldao',
	'outlet': 'outlet', 'leve': 'leve', 'compre': 'leve', 'brinde': 'brinde', 'gift': 'brinde',
	'mystery': 'misterio', 'misteriosa': 'misterio', 'dourado': 'bilhete', 'golden ticket': 'bilhete',
	'live': 'live', 'kit': 'combo', 'combo': 'combo', 'parcela': 'parcela', 'sem juros': 'parcela',
	'sorteio': 'sorteio', 'concorra': 'sorteio', 'fidelidade': 'fidelidade', 'pontos': 'fidelidade',
	'primeira compra': 'primeira', 'novo cliente': 'primeira', 'black friday': 'blackfriday', 'cyber monday': 'blackfriday',
};

function mapTipo(promo) {
	const texto = `${promo.title || ''} ${promo.description || ''}`.toLowerCase();
	for (const [key, value] of Object.entries(TIPO_MAP)) {
		if (texto.includes(key)) return value;
	}
	if (promo.type === 'voucher') return 'cupom';
	if (promo.type === 'promotion') return 'desconto';
	return 'desconto';
}

async function resolveAdvertiserIds() {
  if (process.env.AWIN_ADVERTISER_IDS) {
    return process.env.AWIN_ADVERTISER_IDS.split(',').map(s => s.trim());
  }
  // Fallback: usa a tabela já populada pelo sync.js (programas_awin) — todos os programas ativos
  const rows = await sql`SELECT awin_id FROM programas_awin WHERE status = 'active'`;
  return rows.map(r => r.awin_id);
}

async function fetchAwinPromotions(advertiserIds) {
  const url = `https://api.awin.com/publisher/${AWIN_PUBLISHER_ID}/promotions`;
  const body = {
    filters: {
      membership: 'joined',
      type: 'all',
      ...(advertiserIds.length > 0 ? { advertiserIds: advertiserIds.map(id => Number(id)) } : {}),
    },
    pagination: { page: 1, pageSize: 100 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${AWIN_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Awin API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.data || data.promotions || []);
}

function normalizar(promo) {
  let temporestante = 0;
  if (promo.endDate) {
    const diffMs = new Date(promo.endDate).getTime() - Date.now();
    temporestante = diffMs > 0 ? Math.floor(diffMs / 3600000) : 0;
  }
  const urlAfiliado = promo.urlTracking || promo.url || null;
  return {
    tipo: mapTipo(promo),
    titulo: (promo.title || `Oferta ${promo.advertiser?.name}`).substring(0, 200),
    descricao: promo.description || '',
    loja: promo.advertiser?.name || 'Awin',
    precoold: null,
    preconew: null,
    cupom: promo.voucher?.code || null,
    temporestante,
    ativo: promo.status === 'active',
    url_afiliado: urlAfiliado,
    validade: promo.endDate ? new Date(promo.endDate).toISOString() : null,
    fonte: 'AWIN',
    image_url: null,
    awin_advertiser_id: promo.advertiser?.id ? String(promo.advertiser.id) : null,
  };
}

async function upsertPromos(rows) {
  let inseridos = 0, atualizados = 0, erros = 0;
  for (const row of rows) {
    try {
      const existing = await sql`SELECT id FROM promocoes WHERE titulo = ${row.titulo} AND loja = ${row.loja} LIMIT 1`;
      if (existing.length > 0) {
        await sql`
          UPDATE promocoes SET
            tipo = ${row.tipo}, descricao = ${row.descricao}, precoold = ${row.precoold},
            preconew = ${row.preconew}, cupom = ${row.cupom}, temporestante = ${row.temporestante},
            ativo = ${row.ativo}, url_afiliado = ${row.url_afiliado}, validade = ${row.validade},
            fonte = ${row.fonte}, awin_advertiser_id = ${row.awin_advertiser_id}
          WHERE id = ${existing[0].id}
        `;
        atualizados++;
      } else {
        await sql`
          INSERT INTO promocoes (
            tipo, titulo, descricao, loja, precoold, preconew, cupom,
            temporestante, ativo, url_afiliado, validade, fonte, image_url, awin_advertiser_id
          ) VALUES (
            ${row.tipo}, ${row.titulo}, ${row.descricao}, ${row.loja}, ${row.precoold}, ${row.preconew},
            ${row.cupom}, ${row.temporestante}, ${row.ativo}, ${row.url_afiliado}, ${row.validade},
            ${row.fonte}, ${row.image_url}, ${row.awin_advertiser_id}
          )
        `;
        inseridos++;
      }
    } catch (err) {
      console.error(err.message, row.titulo);
      erros++;
    }
  }
  return { inseridos, atualizados, erros };
}

async function desativarExpiradas() {
  try {
    await sql`UPDATE promocoes SET ativo = false WHERE fonte = 'AWIN' AND validade IS NOT NULL AND validade < now()`;
  } catch (err) {
    console.error('Expiradas:', err.message);
  }
}

module.exports = async (req, res) => {
  const inicio = Date.now();
  res.setHeader('Access-Control-Allow-Origin', '*');

  const auth = req.headers.authorization;
  const secret = req.query.secret;
  const autorizado = auth === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET;
  if (process.env.CRON_SECRET && !autorizado) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const advertiserIds = await resolveAdvertiserIds();
    const promos = await fetchAwinPromotions(advertiserIds);
    console.log(`[sync-promocoes] ${promos.length} promoções recebidas para ${advertiserIds.length} anunciantes`);

    if (!promos.length) {
      return res.status(200).json({ ok: true, mensagem: 'Nenhuma promoção retornada', inseridos: 0 });
    }

    const agora = Date.now();
    const ativas = promos.filter(p => p.status === 'active' && (!p.endDate || new Date(p.endDate).getTime() > agora));
    const rows = ativas.map(normalizar);
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
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sync-promocoes]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};