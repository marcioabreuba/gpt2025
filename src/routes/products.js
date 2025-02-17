// Rota para obtenção de informações de produtos via Shopify
import express from 'express';
import { getCollectionIds, getProductsByCollectionId } from '../services/shopifyService.js';

const router = express.Router();

/**
 * POST /get_products_info
 * Obtém IDs de coleções e produtos de cada coleção e retorna os dados dos produtos
 */
router.post("/get_products_info", async (req, res, next) => {
  try {
    const dadosFinalizados = [];
    // Obtém os IDs das coleções do Shopify
    const collectionIds = await getCollectionIds();
    // Para cada coleção, obtém os produtos e acumula os resultados
    for (const collectionId of collectionIds) {
      const productsWithInventory = await getProductsByCollectionId(collectionId);
      dadosFinalizados.push(...productsWithInventory);
    }
    res.json({ products: dadosFinalizados });
  } catch (error) {
    next(error);
  }
});

export default router;
