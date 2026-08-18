const express = require('express');
const router = express.Router();
const supabase = require('../src/config/supabase');

router.get('/promocoes', async (req, res) => {
    try {
        const limite = parseInt(req.query.limite) || 50;
        const tipo = req.query.tipo;

        let query = supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limite);

        if (tipo) query = query.eq('tipo', tipo);

        const { data, error } = await query;

        if (error) throw error;
        
        res.json({ promocoes: data || [] });
    } catch (err) {
        console.error('Erro na API:', err.message);
        res.status(500).json({ error: 'Erro ao buscar promoções' });
    }
});

module.exports = router;
