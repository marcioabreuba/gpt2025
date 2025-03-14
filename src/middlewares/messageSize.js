// Middleware para verificar se o tamanho da mensagem enviada é aceitável
export function checkMessageSize(req, res, next) {
  const message = req.body.message;
  if (message && message.length > 1000) {
    // Se a mensagem for muito longa, retorna um erro 400
    return res.status(400).json({ error: "Mensagem muito longa" });
  }
  next();
}
