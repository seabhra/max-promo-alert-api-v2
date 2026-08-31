export default function handler(req, res) {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Awin API está funcionando!',
    timestamp: new Date().toISOString()
  });
}
