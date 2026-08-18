// Integra com Gerencianet/Efí, Mercado Pago, ou webhook manual
export default async function handler(req, res) {
  const { txid } = req.query;
  // Consulta sua PSP (ex: EfiPay/Gerencianet) pelo txid
  // Por ora, retorna mock para testar o fluxo:
  res.json({ pago: false, txid });
}