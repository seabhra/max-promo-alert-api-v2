// api/promos.js
export default async function handler(req, res) {
	// CORS
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
	if (req.method === 'OPTIONS') {
	  return res.status(200).end();
	}
  
	try {
	  const supabaseUrl = process.env.SUPABASE_URL;
	  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
	  // Debug: loga no console do Vercel (não no navegador)
	  console.log('ENV check:', { 
		url: supabaseUrl ? 'OK' : 'MISSING', 
		key: supabaseKey ? 'OK (len=' + (supabaseKey?.length || 0) + ')' : 'MISSING' 
	  });
  
	  if (!supabaseUrl || !supabaseKey) {
		return res.status(500).json({ 
		  error: 'Variáveis de ambiente não configuradas',
		  missing: {
			SUPABASE_URL: !supabaseUrl,
			SUPABASE_SERVICE_KEY: !supabaseKey
		  }
		});
	  }
  
	  const { createClient } = require('@supabase/supabase-js');
	  const supabase = createClient(supabaseUrl, supabaseKey);
  
	  const { data, error } = await supabase
		.from('promocoes')
		.select('*')
		.order('created_at', { ascending: false });
  
	  if (error) throw error;
  
	  console.log('Supabase retornou:', data?.length || 0, 'registros');
	  return res.status(200).json(data || []);
  
	} catch (err) {
	  console.error('API Error:', err);
	  return res.status(500).json({ 
		error: err.message,
		type: err.constructor.name,
		hint: 'Verifique: 1) Variáveis de ambiente, 2) Tabela promocoes existe, 3) Service Key tem permissão'
	  });
	}
  }