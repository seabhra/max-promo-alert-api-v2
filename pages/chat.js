// api/chat.js — Max Promo (Vercel Serverless Function)

export default async function handler(req, res) {
    // Configura os cabeçalhos CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Trata a requisição pré-voo (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Verifica se é POST
    if (req.method === 'POST') {
        try {
            const pergunta = req.body?.pergunta;

            if (!pergunta) {
                return res.status(400).json({ error: "O campo 'pergunta' é obrigatório." });
            }

            // ============================================================
            // CHAMADA REAL À API DO GROQ NOVO
            // ============================================================
            const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
                    messages: [
                        { role: 'system', content: 'Você é um assistente útil e direto.' },
                        { role: 'user', content: pergunta }
                    ],
                    temperature: 0.7,
                    max_tokens: 1024,
                }),
            });

            if (!groqResponse.ok) {
                const errorData = await groqResponse.json();
                console.error("Erro da API Groq:", errorData);
                return res.status(502).json({ 
                    error: "Erro na API do Groq", 
                    details: errorData 
                });
            }

            const data = await groqResponse.json();
            const resposta = data.choices[0].message.content;

            // Mantém o formato compatível com o frontend
            res.status(200).json({
                choices: [{
                    message: {
                        content: resposta
                    }
                }]
            });

        } catch (error) {
            console.error("Erro ao processar POST:", error);
            res.status(500).json({ error: "Erro interno no servidor" });
        }
    } else {
        res.status(405).json({ error: `Método ${req.method} não permitido` });
    }
}