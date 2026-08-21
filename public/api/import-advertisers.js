/**
 * Importa o CSV de anunciantes Awin (export do painel) para a tabela `awin_advertisers` no Neon.
 *
 * Uso:
 *   node scripts/import-advertisers.js caminho/para/advertiser-directory.csv
 *
 * Requer:
 *   - env DATABASE_URL apontando pro Neon (a integração Neon-Vercel já injeta isso)
 *   - npm install pg csv-parse
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { Client } = require("pg");

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Uso: node import-advertisers.js <caminho-do-csv>");
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(csvPath), "utf-8");
  const records = parse(raw, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Lidos ${records.length} anunciantes do CSV.`);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const upsertSql = `
    INSERT INTO awin_advertisers (
      advertiser_id, programme_name, conversion_rate, approval_rate, epc,
      launch_date, payment_status, payment_risk_level, awin_index,
      feed_enabled, product_reporting, commission_min, commission_max,
      cookie_length_days, parent_sectors, sub_sectors, primary_sector,
      average_payment_time, primary_region, description_short, logo_url,
      display_url, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22, now()
    )
    ON CONFLICT (advertiser_id) DO UPDATE SET
      programme_name       = EXCLUDED.programme_name,
      conversion_rate       = EXCLUDED.conversion_rate,
      approval_rate         = EXCLUDED.approval_rate,
      epc                   = EXCLUDED.epc,
      payment_status        = EXCLUDED.payment_status,
      payment_risk_level    = EXCLUDED.payment_risk_level,
      awin_index            = EXCLUDED.awin_index,
      feed_enabled          = EXCLUDED.feed_enabled,
      product_reporting     = EXCLUDED.product_reporting,
      commission_min        = EXCLUDED.commission_min,
      commission_max        = EXCLUDED.commission_max,
      cookie_length_days    = EXCLUDED.cookie_length_days,
      parent_sectors        = EXCLUDED.parent_sectors,
      sub_sectors            = EXCLUDED.sub_sectors,
      primary_sector        = EXCLUDED.primary_sector,
      average_payment_time  = EXCLUDED.average_payment_time,
      primary_region        = EXCLUDED.primary_region,
      description_short     = EXCLUDED.description_short,
      logo_url              = EXCLUDED.logo_url,
      display_url           = EXCLUDED.display_url,
      updated_at             = now();
  `;

  const toBool = (v) => String(v).trim().toLowerCase() === "yes";
  const toNumOrNull = (v) => {
    if (v === undefined || v === null || v === "" || v === "null") return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  };
  const toDateOrNull = (v) => (v && v !== "null" ? v : null);

  let ok = 0;
  let failed = 0;

  for (const row of records) {
    try {
      await client.query(upsertSql, [
        row.advertiserId,
        row.programmeName,
        toNumOrNull(row.conversionRate),
        toNumOrNull(row.approvalRate),
        toNumOrNull(row.epc),
        toDateOrNull(row.launchDate),
        row.paymentStatus || null,
        row.paymentRiskLevel || null,
        toNumOrNull(row.awinIndex),
        toBool(row.feedEnabled),
        toBool(row.productReporting),
        toNumOrNull(row.commissionMin),
        toNumOrNull(row.commissionMax),
        toNumOrNull(row.cookieLength),
        row.parentSectors || null,
        row.subSectors || null,
        row.primarySector || null,
        toNumOrNull(row.averagePaymentTime),
        row.primaryRegion || null,
        row.descriptionShort || null,
        row.logoUrl || null,
        row.displayUrl || null,
      ]);
      ok++;
    } catch (err) {
      failed++;
      console.error(`Falha no anunciante ${row.advertiserId} (${row.programmeName}):`, err.message);
    }
  }

  console.log(`Importação concluída: ${ok} ok, ${failed} falharam.`);

  const { rows: summary } = await client.query(`
    SELECT
      count(*) FILTER (WHERE feed_enabled) AS com_feed,
      count(*) FILTER (WHERE NOT feed_enabled) AS sem_feed,
      count(*) FILTER (WHERE primary_region = 'BR') AS regiao_br
    FROM awin_advertisers;
  `);
  console.log("Resumo na base:", summary[0]);

  await client.end();
}

main().catch((err) => {
  console.error("Erro fatal na importação:", err);
  process.exit(1);
});