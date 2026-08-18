export default function handler(req, res) {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Servidor está funcionando!',
    timestamp: new Date().toISOString()
  });
}
