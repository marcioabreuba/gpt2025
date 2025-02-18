// src/routes/orders.js

import express from 'express';
import { getOrdersInfo } from '../services/shopifyOrdersService.js';

const router = express.Router();

/**
 * Endpoint para buscar informações de pedidos (orders).
 * Ex.: POST /get_orders_info
 */
router.post('/get_orders_info', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: "Falta endpoint" });
    }

    const ordersData = await getOrdersInfo(endpoint);
    res.json(ordersData);

  } catch (error) {
    console.error("Erro ao obter pedidos:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
