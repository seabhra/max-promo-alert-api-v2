// api/promocoes.js — Endpoint para o frontend buscar promoções

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY // Anon key para leitura pública
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método não permitido' });
    }

    try {
        const { tipo, fonte, limite, pagina } = req.query;

        let query = supabase
            .from('promocoes')
            .select('*')
            .eq('ativa', true)
            .order('criado_em', { ascending: false });

        // Filtro por tipo
        if (tipo) {
            query = query.eq('tipo', tipo);
        }

        // Filtro por fonte
        if (fonte) {
            query = query.eq('fonte', fonte);
        }

        // Paginação
        const limit = parseInt(limite) || 20;
        const page = parseInt(pagina) || 1;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        query = query.range(from, to);

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(200).json({
            promocoes: data,
            pagina: page,
            limite: limit,
            total: data.length
        });

    } catch (error) {
        console.error('Erro ao buscar promoções:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
}