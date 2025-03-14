// Rota simples para verificação do status da API
import express from 'express';
const router = express.Router();

/**
 * GET /verificarStatusAPI
 * Retorna um JSON indicando que a API está funcionando
 */
router.get('/verificarStatusAPI', (req, res) => {
  res.json({ content: "está funcionando" });
});

export default router;
