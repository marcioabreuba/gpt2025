// Middleware de tratamento de erros centralizado
export function errorHandler(err, req, res, next) {
  console.error("Erro:", err);
  // Retorna um erro 500 com a mensagem do erro (ou uma mensagem padrão)
  res.status(500).json({ error: err.message || "Erro Interno do Servidor" });
}
