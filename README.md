# Importação de anunciantes Awin → max-promo-alert-api-v2

## 1. Rodar a migração SQL
Cole o conteúdo de `sql/001_create_awin_advertisers.sql` no editor SQL do Neon
(ou via `psql $DATABASE_URL -f sql/001_create_awin_advertisers.sql`).

Isso cria:
- a tabela `awin_advertisers` (cadastro dos 151 programas do CSV)
- a coluna `origem` em `promocoes` (`awin` | `pix` | `csv_manual`)
- a coluna `awin_advertiser_id` em `promocoes`, ligando cada oferta ao anunciante

## 2. Importar o CSV
```bash
npm install pg csv-parse
node scripts/import-advertisers.js advertiser-directory.csv
```

Isso faz upsert dos 151 anunciantes. Roda de novo sempre que você exportar um
CSV atualizado do painel Awin — não duplica (chave é `advertiser_id`).

## 3. Puxar as ofertas (só dos 87 com feedEnabled=yes)
```bash
export AWIN_TOKEN="seu_token_awin"
export DATABASE_URL="sua_connection_string_neon"
node scripts/scraper-awin.js
```

Isso grava as ofertas em `promocoes` com `origem='awin'`, e link já formatado
como link de afiliado (`awin1.com/cread.php?awinmid=...&awinaffid=2933261`).

**Antes de rodar em produção**: os 15 primeiros comentários do arquivo
`scraper-awin.js` explicam que o formato exato da resposta da API de
Promotions da Awin foi assumido pelo padrão mais comum — se você tiver o
`api_backup/scraper.js` original do projeto, vale comparar o corpo da
requisição real antes de rodar, pra não gerar erros silenciosos.

## Os 64 anunciantes sem feed (feedEnabled=no)
Ficam cadastrados em `awin_advertisers` mas não geram `promocoes`
automaticamente — são candidatos a uma seção "lojas parceiras" no site,
usando `logo_url` e `display_url` + link de afiliado genérico, sem oferta
específica.
