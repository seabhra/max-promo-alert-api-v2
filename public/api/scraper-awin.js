/**
 * Puxa promoções/ofertas da API Awin (Promotions) apenas para os anunciantes
 * marcados como feed_enabled=true na tabela awin_advertisers, e grava/atualiza
 * em `promocoes` com origem = 'awin'.
 *
 * ATENÇÃO: o endpoint e a autenticação abaixo (POST /publisher/{id}/promotions
 * com Authorization: Bearer AWIN_TOKEN) foram confirmados como corretos no seu
 * projeto anteriormente — mas os parâmetros exatos de filtro por advertiserId
 * e o formato da resposta podem variar. Se você tiver o `api_backup/scraper.js`
 * original, vale comparar/colar o corpo da requisição real antes de rodar isso
 * em produção — aqui assumi o padrão mais comum da API Awin.
 *
 * Uso:
 *   node scripts/scraper-awin.js
 *
 * Requer env: DATABASE_URL, AWIN_TOKEN
 */

const { Client } = require("pg");

const AWIN_PUBLISHER_ID = "2933261";
const AWIN_TOKEN = process.env.AWIN_TOKEN;
const AWIN_ENDPOINT = `https://api.awin.com/publisher/${AWIN_PUBLISHER_ID}/promotions`;

async function fetchPromotionsForAdvertiser(advertiserId) {
  const res = await fetch(`${AWIN_ENDPOINT}?advertiserId=${advertiserId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${AWIN_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Awin respondeu ${res.status} para advertiser ${advertiserId}`);
  }

  const data = await res.json();
  // TODO: confirmar o nome real do campo de lista na resposta (ex: data.promotions)
  return data.promotions || data.results || [];
}

function buildAffiliateLink(advertiserId, destinationUrl) {
  const params = new URLSearchParams({
    awinmid: advertiserId,
    awinaffid: AWIN_PUBLISHER_ID,
    ued: destinationUrl,
  });
  return `https://www.awin1.com/cread.php?${params.toString()}`;
}

async function main() {
  if (!AWIN_TOKEN) {
    console.error("Defina a env AWIN_TOKEN antes de rodar.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: advertisers } = await client.query(`
    SELECT advertiser_id, programme_name, display_url
    FROM awin_advertisers
    WHERE feed_enabled = true AND active = true
    ORDER BY primary_region = 'BR' DESC, awin_index DESC NULLS LAST
  `);

  console.log(`Rodando scraper para ${advertisers.length} anunciantes com feed ativo.`);

  const upsertPromo = `
    INSERT INTO promocoes (titulo, loja, link, imagem, origem, awin_advertiser_id, criado_em)
    VALUES ($1, $2, $3, $4, 'awin', $5, now())
    ON CONFLICT (titulo, loja) DO UPDATE SET
      link = EXCLUDED.link,
      imagem = EXCLUDED.imagem,
      awin_advertiser_id = EXCLUDED.awin_advertiser_id;
  `;

  let totalOfertas = 0;
  let advertidersComErro = 0;

  for (const adv of advertisers) {
    try {
      const promos = await fetchPromotionsForAdvertiser(adv.advertiser_id);

      for (const promo of promos) {
        const titulo = promo.title || promo.name;
        const linkDestino = promo.url || adv.display_url;
        const link = buildAffiliateLink(adv.advertiser_id, linkDestino);
        const imagem = promo.imageUrl || null;

        await client.query(upsertPromo, [
          titulo,
          adv.programme_name,
          link,
          imagem,
          adv.advertiser_id,
        ]);
        totalOfertas++;
      }

      await client.query(
        `UPDATE awin_advertisers SET last_scraped_at = now() WHERE advertiser_id = $1`,
        [adv.advertiser_id]
      );
    } catch (err) {
      advertidersComErro++;
      console.error(`Erro no anunciante ${adv.advertiser_id} (${adv.programme_name}):`, err.message);
    }
  }

  console.log(`Concluído: ${totalOfertas} ofertas gravadas. ${advertidersComErro} anunciantes com erro.`);

  await client.end();
}

main().catch((err) => {
  console.error("Erro fatal no scraper:", err);
  process.exit(1);
});