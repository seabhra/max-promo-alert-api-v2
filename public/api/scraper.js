// api/scraper.js — Max Promo Scraper Inteligente v2.1
// Suporte: Groq Cloud (gsk_) e OpenAI (sk-)

require('dotenv').config();

const Parser = require('rss-parser');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

// ============================================================
// CONFIGURAÇÃO — Fontes RSS
// ============================================================
const RSS_SOURCES = [
    {
        nome: 'HardMobi',
        url: 'https://www.hardmob.com.br/forums/promocoes.11/index.rss',
        fonte: 'hardmobi'
    },
    {
        nome: 'Adrenaline',
        url: 'https://adrenaline.com.br/rss',
        fonte: 'adrenaline'
    }
    // Adicione mais fontes RSS aqui seguindo o mesmo formato
];

// ============================================================
// CONFIGURAÇÃO — Tipos de promoção (espelho do PROMO_CONFIG)
// ============================================================
const TIPOS_PROMOCAO = [
    'desconto', 'saldao', 'outlet', 'flash', 'frete_gratis',
    'cupom', 'leve_pague', 'cashback', 'blackfriday', 'brinde',
    'progressivo', 'primeira', 'fidelidade', 'misterio', 'bilhete',
    'live', 'combo', 'parcela', 'cross', 'sorteio'
];

const TIPOS_STRING = TIPOS_PROMOCAO.map(t => `"${t}"`).join(', ');

// ============================================================
// INICIALIZAÇÃO — Detecta Groq (gsk_) ou OpenAI (sk-)
// ============================================================
const apiKey = process.env.OPENAI_API_KEY || '';

let openaiConfig = { apiKey };

if (apiKey.startsWith('gsk_')) {
    openaiConfig.baseURL = 'https://api.groq.com/openai/v1';
}

const openai = new OpenAI(openaiConfig);

const NOME_MODELO = apiKey.startsWith('gsk_') ? 'openai/gpt-oss-20b' : 'gpt-4o-mini';

console.log(`🤖 LLM: ${apiKey.startsWith('gsk_') ? 'Groq Cloud' : 'OpenAI'} — Modelo: ${NOME_MODELO}`);

// ============================================================
// Supabase
// ============================================================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// RSS Parser
const rssParser = new Parser({
    timeout: 15000,
    headers: { 'User-Agent': 'MaxPromoBot/2.1' }
});

// ============================================================
// FUNÇÃO AUXILIAR: Limpar resposta JSON da IA
// Remove markdown ```json ... ``` se a IA enviar
// ============================================================
function limparRespostaJSON(texto) {
    let limpo = texto.trim();
    
    // Remove ```json ... ``` wrappers
    if (limpo.startsWith('```json')) {
        limpo = limpo.slice(7);
    } else if (limpo.startsWith('```')) {
        limpo = limpo.slice(3);
    }
    
    if (limpo.endsWith('```')) {
        limpo = limpo.slice(0, -3);
    }
    
    return limpo.trim();
}

// ============================================================
// PASSO 1: Buscar itens dos RSS Feeds
// ============================================================
async function buscarItensRSS() {
    console.log('\n📡 Buscando itens dos RSS Feeds...');
    const todosItens = [];

    for (const source of RSS_SOURCES) {
        try {
            console.log(`  → Buscando: ${source.nome} (${source.url})`);
            const feed = await rssParser.parseURL(source.url);
            console.log(`  ✓ ${feed.items.length} itens encontrados em ${source.nome}`);

            feed.items.forEach(item => {
                todosItens.push({
                    titulo: item.title || '',
                    descricao: item.contentSnippet || item.content || '',
                    link: item.link || '',
                    guid: item.guid || item.link || item.title || '',
                    dataPublicacao: item.pubDate || item.isoDate || new Date().toISOString(),
                    fonte: source.fonte,
                    fonteNome: source.nome
                });
            });
        } catch (err) {
            console.error(`  ✗ Erro ao buscar ${source.nome}: ${err.message}`);
        }
    }

    console.log(`  📊 Total de itens brutos: ${todosItens.length}`);
    return todosItens;
}

// ============================================================
// PASSO 2: Filtrar itens que parecem promoções
// ============================================================
function filtrarPossiveiPromocoes(itens) {
    console.log('\n🔍 Filtrando possíveis promoções...');
    
    const palavrasChave = [
        'off', 'desconto', 'promoção', 'promocao', 'cupom', 'coupon',
        'frete grátis', 'frete gratis', 'cashback', 'saldao', 'saldão',
        'outlet', 'flash', 'black friday', 'cyber monday', 'brinde',
        'leve', 'pague', 'combo', 'kit', 'parcela', 'sem juros',
        'preço', 'preco', 'r$', 'economia', 'menor preço', 'oferta',
        'sorteio', 'live', 'misteriosa', 'misterio', 'bilhete',
        'progressivo', 'fidelidade', 'primeira compra'
    ];

    const filtrados = itens.filter(item => {
        const texto = (item.titulo + ' ' + item.descricao).toLowerCase();
        return palavrasChave.some(palavra => texto.indexOf(palavra) !== -1);
    });

    console.log(`  ✓ ${filtrados.length} itens com potencial de promoção (de ${itens.length} totais)`);
    return filtrados;
}

// ============================================================
// PASSO 3: Processar com IA — extrair dados estruturados
// ============================================================
async function processarComIA(itens) {
    console.log(`\n🤖 Processando ${itens.length} itens com IA (${NOME_MODELO})...`);

    const promocoesExtraidas = [];
    const tamanhoBatch = 10;

    for (let i = 0; i < itens.length; i += tamanhoBatch) {
        const batch = itens.slice(i, i + tamanhoBatch);
        console.log(`  → Batch ${Math.floor(i / tamanhoBatch + 1)}: ${batch.length} itens`);

        const textoBruto = batch.map((item, idx) => {
            return `--- ITEM ${idx + 1} ---\n` +
                   `Título: ${item.titulo}\n` +
                   `Descrição: ${item.descricao.substring(0, 500)}\n` +
                   `Fonte: ${item.fonteNome}\n`;
        }).join('\n');

        const promptSistema = 
            'Você é um sistema de extração de dados de promoções de e-commerce.' +
            ' Receba textos brutos de RSS feeds de sites de ofertas e extraia informações estruturadas.' +
            ' Se um item NÃO for uma promoção real, responda null para ele.' +
            ' Responda SEMPRE em JSON válido, sem markdown, sem comentários.';

        const promptUsuario = 
            'Analise os itens abaixo e extraia os dados de cada promoção.\n' +
            `O campo "tipo" deve ser um dos seguintes valores: [${TIPOS_STRING}].\n` +
            'Escolha o tipo que melhor descreve a promoção.\n' +
            'O campo "preco_antigo" e "preco_novo" devem ser números decimais (ex: 199.90), sem "R$" ou texto. Se não houver preço, use null.\n' +
            'O campo "cupom" deve conter o código do cupom se mencionado, senão null.\n' +
            `O campo "loja" deve ser o nome da loja se mencionado, senão a fonte.\n\n` +
            'Responda no formato JSON com uma chave "promocoes" contendo um array:\n' +
            '{\n' +
            '  "promocoes": [\n' +
            '    {\n' +
            '      "tipo": "flash",\n' +
            '      "titulo": "Nome do Produto",\n' +
            '      "descricao": "Descrição curta da oferta",\n' +
            '      "loja": "Nome da Loja",\n' +
            '      "preco_antigo": 999.90,\n' +
            '      "preco_novo": 499.90,\n' +
            '      "cupom": "CODIGO10"\n' +
            '    },\n' +
            '    null\n' +
            '  ]\n' +
            '}\n' +
            'Use null para itens que não são promoções reais.\n\n' +
            'ITENS:\n' + textoBruto;

        try {
            const completion = await openai.chat.completions.create({
                model: NOME_MODELO,
                messages: [
                    { role: 'system', content: promptSistema },
                    { role: 'user', content: promptUsuario }
                ],
                temperature: 0.1,
                max_tokens: 2000
            });

            const respostaTexto = limparRespostaJSON(completion.choices[0].message.content);
            const resultados = JSON.parse(respostaTexto);

            const lista = resultados.promocoes || resultados.items || (Array.isArray(resultados) ? resultados : []);

            lista.forEach((resultado, idx) => {
                if (!resultado) return;

                let tipo = resultado.tipo || 'desconto';
                if (TIPOS_PROMOCAO.indexOf(tipo) === -1) {
                    console.log(`  ⚠ Tipo inválido "${tipo}" — usando "desconto" como fallback`);
                    tipo = 'desconto';
                }

                let precoAntigo = null;
                let precoNovo = null;
                if (resultado.preco_antigo && !isNaN(parseFloat(resultado.preco_antigo))) {
                    precoAntigo = parseFloat(resultado.preco_antigo);
                }
                if (resultado.preco_novo && !isNaN(parseFloat(resultado.preco_novo))) {
                    precoNovo = parseFloat(resultado.preco_novo);
                }

                promocoesExtraidas.push({
                    tipo: tipo,
                    titulo: (resultado.titulo || batch[idx] ? batch[idx].titulo : 'Sem título').substring(0, 500),
                    descricao: (resultado.descricao || batch[idx] ? batch[idx].descricao : '').substring(0, 1000),
                    loja: resultado.loja || (batch[idx] ? batch[idx].fonteNome : 'Desconhecida'),
                    url_origem: batch[idx] ? batch[idx].link : '',
                    preco_antigo: precoAntigo,
                    preco_novo: precoNovo,
                    cupom: resultado.cupom || null,
                    fonte: batch[idx] ? batch[idx].fonte : 'desconhecida',
                    rss_guid: batch[idx] ? batch[idx].guid : ''
                });
            });

            const countValidos = lista.filter(r => r !== null).length;
            console.log(`  ✓ Batch processado: ${countValidos} promoções extraídas`);

        } catch (err) {
            console.error(`  ✗ Erro ao processar batch com IA: ${err.message}`);
            
            // Fallback: salvar itens sem processamento IA
            batch.forEach(item => {
                promocoesExtraidas.push({
                    tipo: 'desconto',
                    titulo: item.titulo.substring(0, 500),
                    descricao: item.descricao.substring(0, 1000),
                    loja: item.fonteNome,
                    url_origem: item.link,
                    preco_antigo: null,
                    preco_novo: null,
                    cupom: null,
                    fonte: item.fonte,
                    rss_guid: item.guid
                });
            });
        }

        // Pausa entre batches para respeitar rate limit
        if (i + tamanhoBatch < itens.length) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    console.log(`\n  📊 Total de promoções extraídas: ${promocoesExtraidas.length}`);
    return promocoesExtraidas;
}

// ============================================================
// PASSO 4: Salvar no Supabase (evitando duplicatas)
// ============================================================
async function salvarNoSupabase(promocoes) {
    console.log(`\n💾 Salvando ${promocoes.length} promoções no Supabase...`);

    let inseridas = 0;
    let duplicadas = 0;
    let erros = 0;

    for (const promo of promocoes) {
        try {
            // Verificar duplicata pelo rss_guid
            if (promo.rss_guid) {
                const { data: existente } = await supabase
                    .from('promocoes')
                    .select('id')
                    .eq('rss_guid', promo.rss_guid)
                    .limit(1);

                if (existente && existente.length > 0) {
                    duplicadas++;
                    continue;
                }
            }

            // Inserir promoção
            const { data, error } = await supabase
                .from('promocoes')
                .insert({
                    tipo: promo.tipo,
                    titulo: promo.titulo,
                    descricao: promo.descricao,
                    loja: promo.loja,
                    url_origem: promo.url_origem,
                    preco_antigo: promo.preco_antigo,
                    preco_novo: promo.preco_novo,
                    cupom: promo.cupom,
                    fonte: promo.fonte,
                    rss_guid: promo.rss_guid,
                    ativa: true
                });

            if (error) {
                if (error.code === '23505') {
                    duplicadas++;
                } else {
                    console.error(`  ✗ Erro ao inserir "${promo.titulo.substring(0, 50)}": ${error.message}`);
                    erros++;
                }
            } else {
                inseridas++;
            }

        } catch (err) {
            console.error(`  ✗ Exceção ao salvar: ${err.message}`);
            erros++;
        }
    }

    console.log('\n  ✅ Resultado:');
    console.log(`     Inseridas: ${inseridas}`);
    console.log(`     Duplicadas: ${duplicadas}`);
    console.log(`     Erros: ${erros}`);

    return { inseridas, duplicadas, erros };
}

// ============================================================
// PASSO 5: Desativar promoções expiradas
// ============================================================
async function desativarExpiradas() {
    console.log('\n⏰ Verificando promoções expiradas...');

    try {
        const { data, error } = await supabase
            .from('promocoes')
            .update({ ativa: false, atualizado_em: new Date().toISOString() })
            .lt('data_fim', new Date().toISOString())
            .eq('ativa', true);

        if (error) {
            console.error(`  ✗ Erro ao desativar: ${error.message}`);
        } else {
            console.log('  ✓ Promoções expiradas desativadas');
        }
    } catch (err) {
        console.error(`  ✗ Exceção: ${err.message}`);
    }
}

// ============================================================
// EXECUÇÃO PRINCIPAL
// ============================================================
async function executarScraper() {
    console.log('════════════════════════════════════════════════');
    console.log('  MAX PROMO — Scraper Inteligente v2.1');
    console.log(`  ${new Date().toLocaleString('pt-BR')}`);
    console.log('════════════════════════════════════════════════');

    const inicio = Date.now();

    try {
        // 1. Buscar RSS
        const itensBrutos = await buscarItensRSS();

        if (itensBrutos.length === 0) {
            console.log('\n⚠ Nenhum item encontrado nos feeds. Encerrando.');
            return { inseridas: 0, duplicadas: 0, erros: 0 };
        }

        // 2. Filtrar possíveis promoções
        let itensFiltrados = filtrarPossiveiPromocoes(itensBrutos);

        if (itensFiltrados.length === 0) {
            console.log('\n⚠ Nenhuma promoção potencial encontrada. Encerrando.');
            return { inseridas: 0, duplicadas: 0, erros: 0 };
        }

        // Limitar a 50 itens por execução para controlar custos da API
        if (itensFiltrados.length > 50) {
            console.log(`  ✂ Limitando de ${itensFiltrados.length} para 50 itens (controle de custo)`);
            itensFiltrados = itensFiltrados.slice(0, 50);
        }

        // 3. Processar com IA
        const promocoes = await processarComIA(itensFiltrados);

        if (promocoes.length === 0) {
            console.log('\n⚠ Nenhuma promoção extraída pela IA. Encerrando.');
            return { inseridas: 0, duplicadas: 0, erros: 0 };
        }

        // 4. Salvar no Supabase
        const resultado = await salvarNoSupabase(promocoes);

        // 5. Desativar expiradas
        await desativarExpiradas();

        const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
        console.log('\n════════════════════════════════════════════════');
        console.log(`  EXECUÇÃO CONCLUÍDA em ${duracao}s`);
        console.log(`  Inseridas: ${resultado.inseridas} | Duplicadas: ${resultado.duplicadas} | Erros: ${resultado.erros}`);
        console.log('════════════════════════════════════════════════');

        return resultado;

    } catch (err) {
        console.error('\n💥 ERRO FATAL:', err.message);
        console.error(err.stack);
        return { inseridas: 0, duplicadas: 0, erros: 1 };
    }
}

// ============================================================
// EXPORTAR para Vercel Cron / uso como módulo
// ============================================================
module.exports = { executarScraper };

// Executar diretamente se chamado via linha de comando
if (require.main === module) {
    executarScraper().catch(err => {
        console.error('Erro fatal:', err);
        process.exit(1);
    });
}