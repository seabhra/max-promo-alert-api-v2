require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const app = express();

// Pool de conexão com o Neon (a integração Neon-Vercel injeta DATABASE_URL automaticamente)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rota raiz — servir o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Chat
app.post('/api/chat', (req, res) => {
    try {
        const { pergunta } = req.body;
        if (!pergunta) return res.status(400).json({ error: "O campo 'pergunta' e obrigatorio." });
        res.status(200).json({ choices: [{ message: { content: "Resposta da IA para: " + pergunta } }] });
    } catch (error) {
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// API: Scraper (importação lazy)
app.post('/api/scraper', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.replace('Bearer ', '');
    const tokenValido = token === process.env.SCRAPER_SECRET_TOKEN || token === process.env.OPENAI_API_KEY;
    if (!tokenValido) return res.status(401).json({ error: 'Token invalido' });
    try {
        const { executarScraper } = require('./api/scraper');
        executarScraper().catch(err => console.error('Scraper bg:', err.message));
        res.status(200).json({ status: 'scraper_iniciado', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ error: 'Erro scraper: ' + error.message });
    }
});

// API: Promoções (Neon/Postgres, tabela `promos`)
app.get('/api/promocoes', async (req, res) => {
    try {
        const { tipo, limite, pagina } = req.query;
        const limit = parseInt(limite) || 20;
        const page = parseInt(pagina) || 1;
        const offset = (page - 1) * limit;

        const params = [];
        let where = '';
        if (tipo) {
            params.push(tipo);
            where = `WHERE tipo = $${params.length}`;
        }
        params.push(limit, offset);

        const sql = `
            SELECT id, tipo, titulo, "desc" AS descricao, loja,
                   precoold AS preco_antigo, preconew AS preco_novo
            FROM promos
            ${where}
            ORDER BY id DESC
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `;
        const { rows } = await pool.query(sql, params);
        res.status(200).json({ promocoes: rows, pagina: page, limite: limit, total: rows.length });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno: ' + error.message });
    }
});

// Fallback: servir index.html para qualquer rota não-API (SPA)
app.use((req, res) => {
    if (req.url.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|mp3|css|js)$/i)) return res.status(404).end();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Erro global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Erro interno" });
});

// Servidor local
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log('========================================');
        console.log('  MAX PROMO - Servidor Local');
        console.log('  http://localhost:' + PORT);
        console.log('========================================');
    });
}

module.exports = app;