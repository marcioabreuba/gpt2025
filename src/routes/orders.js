// src/routes/orders.js

import express from 'express';
import { getOrdersInfo } from '../services/shopifyOrdersService.js';

const router = express.Router();

/**
 * Endpoint para buscar informações de pedidos (orders).
 * Exemplo de uso:
 *   POST /get_orders_info
 *   Body:
 *     {
 *       "endpoint": "https://sualoja.myshopify.com/admin/api/2024-10/orders.json",
 *       "instanceId": "ID_DA_INSTANCIA_ZAPI" // opcional
 *     }
 */
router.post('/get_orders_info', async (req, res) => {
  try {
    const { endpoint, instanceId } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: "Falta endpoint" });
    }

    // Busca os pedidos utilizando a função do serviço do Shopify
    // Passa o instanceId para determinar qual loja usar
    const ordersData = await getOrdersInfo(endpoint, instanceId);
    return res.json(ordersData);

  } catch (error) {
    console.error("Erro ao obter pedidos:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
