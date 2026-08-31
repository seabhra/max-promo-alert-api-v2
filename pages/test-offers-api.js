// test-offers-api.js
// TESTE ISOLADO — não mexe no awin-sync.js de produção.
// Objetivo: verificar se a Offers API retorna promoções/vouchers
// de lojas que você AINDA NÃO ADERIU (membership = "notJoined").
//
// USO:
//   AWIN_PUBLISHER_ID=2933261 AWIN_ACCESS_TOKEN=seu_token node test-offers-api.js
//
// Onde pegar o accessToken:
//   ui.awin.com → ícone de conta → "Awin API" (ou Account Settings → API)
//   É um token diferente do Publisher ID.

const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID || '2933261';
const ACCESS_TOKEN = process.env.AWIN_ACCESS_TOKEN;
const MEMBERSHIP = process.env.AWIN_MEMBERSHIP || 'notJoined';

if (!ACCESS_TOKEN) {
  console.error('❌ Defina AWIN_ACCESS_TOKEN como variável de ambiente antes de rodar.');
  console.error('   Exemplo: AWIN_ACCESS_TOKEN=xxxxx node test-offers-api.js');
  process.exit(1);
}

// --------------------------------------------------------------
// EDITE AQUI: coloque 2-3 advertiser IDs que aparecem como
// "(Não Inscrito)" no seu painel — os mesmos da screenshot.
// O ID do advertiser NÃO é o nome da loja; pra achar o número,
// abra o programa no painel Awin e veja a URL ou os detalhes.
// --------------------------------------------------------------
const ADVERTISER_IDS_NAO_ADERIDOS = [
  // 1234, 5678, 9012  <- substitua pelos IDs reais
];

async function testarOffersAPI() {
  const url = `https://api.awin.com/publisher/${PUBLISHER_ID}/promotions?accessToken=${ACCESS_TOKEN}`;

  const body = {
    filters: {
      membership: MEMBERSHIP,
      type: 'all',
      ...(ADVERTISER_IDS_NAO_ADERIDOS.length > 0
        ? { advertiserIds: ADVERTISER_IDS_NAO_ADERIDOS }
        : {}),
    },
    pagination: {
      page: 1,
      pageSize: 20,
    },
  };

  console.log('📡 Chamando Offers API...');
  console.log('   URL:', url.replace(ACCESS_TOKEN, '***TOKEN***'));
  console.log('   Body:', JSON.stringify(body, null, 2));
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    console.log(`📥 Status HTTP: ${response.status} ${response.statusText}`);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.log('⚠️  Resposta não é JSON válido. Corpo bruto:');
      console.log(text);
      return;
    }

    if (!response.ok) {
      console.log('❌ Erro retornado pela API:');
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    const ofertas = Array.isArray(data) ? data : data.promotions || data.items || [];

    console.log(`✅ Resposta OK. Total de ofertas retornadas: ${ofertas.length}`);
    console.log('');

    if (ofertas.length === 0) {
      console.log('⚠️  Nenhuma oferta retornada para membership=notJoined.');
      console.log('   Isso pode indicar:');
      console.log('   - Não há ofertas ativas dessas lojas no momento, OU');
      console.log('   - A API realmente exige adesão para retornar dados, OU');
      console.log('   - O accessToken/publisherId está incorreto.');
      return;
    }

    console.log('📋 Amostra das primeiras ofertas:');
    ofertas.slice(0, 5).forEach((o, i) => {
      console.log(`\n--- Oferta ${i + 1} ---`);
      console.log('Loja:', o.advertiser?.name, '| ID:', o.advertiser?.id, '| Aderido:', o.advertiser?.joined);
      console.log('Título:', o.title);
      console.log('Tipo:', o.type);
      if (o.voucher) {
        console.log('Código do voucher:', o.voucher.code ?? '⚠️ NULL (precisa aderir para ver)');
      }
    });

    console.log('\n\n🔎 CONCLUSÃO DO TESTE:');
    const semCodigo = ofertas.filter(o => o.type === 'voucher' && !o.voucher?.code).length;
    const comCodigo = ofertas.filter(o => o.type === 'voucher' && o.voucher?.code).length;
    const promocoesSimples = ofertas.filter(o => o.type === 'promotion').length;

    console.log(`   - Promoções sem código (tipo "promotion"): ${promocoesSimples} — devem funcionar normalmente`);
    console.log(`   - Vouchers COM código mesmo sem adesão: ${comCodigo}`);
    console.log(`   - Vouchers SEM código (null) por falta de adesão: ${semCodigo}`);

    if (semCodigo > 0) {
      console.log('\n   ➡️  Confirmado: para vouchers, a adesão É necessária para ver o código.');
      console.log('       Promoções sem voucher devem funcionar sem aderir.');
    }
  } catch (err) {
    console.error('❌ Erro de rede/execução:', err.message);
  }
}

testarOffersAPI();