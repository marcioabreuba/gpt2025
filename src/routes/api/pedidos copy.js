// src/routes/api/pedidos.js
import express from 'express';

const router = express.Router();

router.post('/pedidos', async (req, res) => {
  try {
    const valor = 2*4;
    res.send({valor});
  } catch (error) {
    console.error("Erro ao obter pedidos:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;