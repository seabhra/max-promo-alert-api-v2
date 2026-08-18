// list-advertisers.js
// Puxa TODOS os programas (advertisers) com relacionamento "notjoined"
// via Awin Publisher API e gera um CSV pra você ordenar/filtrar no Excel/Sheets.
//
// LIMITAÇÃO IMPORTANTE: este endpoint NÃO retorna taxa de aprovação,
// status de pagamento ou "feed do produto" — esses campos só existem
// no painel web (ui.awin.com). O CSV gerado aqui usa o que a API oferece:
// nome, setor, região, status do link, domínio.
// Use-o para cortar lojas irrelevantes/mortas rápido, e confira aprovação
// e feed manualmente só nas finalistas antes de aderir.
//
// USO:
//   AWIN_PUBLISHER_ID=2933261 AWIN_ACCESS_TOKEN=seu_token node list-advertisers.js

const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID || '2933261';
const ACCESS_TOKEN = process.env.AWIN_ACCESS_TOKEN;
const RELATIONSHIP = process.env.AWIN_RELATIONSHIP || 'notjoined'; // joined | pending | suspended | rejected | notjoined
const COUNTRY_CODE = process.env.AWIN_COUNTRY_CODE || 'BR'; // ISO Alpha-2, ex: BR, PT, GB. Deixe vazio ('') para todos os países.

if (!ACCESS_TOKEN) {
  console.error('❌ Defina AWIN_ACCESS_TOKEN antes de rodar.');
  process.exit(1);
}

async function listarProgramas() {
  let url = `https://api.awin.com/publishers/${PUBLISHER_ID}/programmes?accessToken=${ACCESS_TOKEN}&relationship=${RELATIONSHIP}`;
  if (COUNTRY_CODE) {
    url += `&countryCode=${COUNTRY_CODE}`;
  }

  console.log(`📡 Buscando programas com relationship="${RELATIONSHIP}"${COUNTRY_CODE ? ` e countryCode="${COUNTRY_CODE}"` : ''}...`);

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  console.log(`📥 Status HTTP: ${response.status}`);

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('⚠️  Resposta não é JSON:', text);
    process.exit(1);
  }

  if (!response.ok) {
    console.error('❌ Erro da API:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const programas = Array.isArray(data) ? data : [];
  console.log(`✅ Total retornado: ${programas.length} programas`);

  if (programas.length === 0) {
    console.log('⚠️  Nenhum programa retornado. Verifique o token/publisherId.');
    return;
  }

  // Monta CSV
  const header = ['id', 'name', 'primarySector', 'countryCode', 'regionName', 'status', 'linkStatus', 'currencyCode', 'domain', 'displayUrl'];
  const linhas = programas.map(p => {
    const dominio = (p.validDomains && p.validDomains[0]?.domain) || '';
    return [
      p.id ?? '',
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.primarySector || '').replace(/"/g, '""')}"`,
      p.primaryRegion?.countryCode || '',
      `"${(p.primaryRegion?.name || '').replace(/"/g, '""')}"`,
      p.status || '',
      p.linkStatus || '',
      p.currencyCode || '',
      dominio,
      p.displayUrl || '',
    ].join(',');
  });

  const csv = [header.join(','), ...linhas].join('\n');

  const fs = require('fs');
  const sufixoPais = COUNTRY_CODE ? `-${COUNTRY_CODE}` : '';
  const outPath = `advertisers-${RELATIONSHIP}${sufixoPais}.csv`;
  fs.writeFileSync(outPath, csv, 'utf-8');
  console.log(`\n💾 CSV salvo em: ${outPath}`);
  console.log(`   Abra no Excel/Google Sheets e ordene por "status", "linkStatus" ou "primarySector".`);

  // Resumo rápido por status
  const porStatus = {};
  programas.forEach(p => {
    const s = p.status || 'desconhecido';
    porStatus[s] = (porStatus[s] || 0) + 1;
  });
  console.log('\n📊 Resumo por status:');
  Object.entries(porStatus).forEach(([s, n]) => console.log(`   ${s}: ${n}`));

  const porLinkStatus = {};
  programas.forEach(p => {
    const s = p.linkStatus || 'desconhecido';
    porLinkStatus[s] = (porLinkStatus[s] || 0) + 1;
  });
  console.log('\n📊 Resumo por linkStatus:');
  Object.entries(porLinkStatus).forEach(([s, n]) => console.log(`   ${s}: ${n}`));
}

listarProgramas().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});