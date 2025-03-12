// Rota para obtenção de informações de produtos via Shopify
import express from 'express';
import { getCollectionIds, getProductsByCollectionId } from '../services/shopifyService.js';
import { getProductsByCategory } from '../services/shopifyProductService.js';

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

/**
 * Endpoint para buscar produtos por categoria
 * Exemplo de uso:
 *   GET /products?category=roupas&instanceId=ID_DA_INSTANCIA_ZAPI
 */
router.get('/products', async (req, res) => {
  try {
    const { category, instanceId } = req.query;
    
    if (!category) {
      return res.status(400).json({ error: "Categoria é obrigatória" });
    }
    
    // Busca produtos passando o instanceId para determinar qual loja usar
    const products = await getProductsByCategory(category, instanceId);
    
    if (!products || products.length === 0) {
      return res.json({ 
        message: "Nenhum produto encontrado para esta categoria",
        products: []
      });
    }
    
    return res.json({ products });
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get('/api/collections', async (req, res) => {
  try {
    const collectionIds = await getCollectionIds();
    res.json({ collectionIds });
  } catch (error) {
    console.error("Erro ao buscar coleções:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/collections/:id/products', async (req, res) => {
  try {
    const { id } = req.params;
    const products = await getProductsByCollectionId(id);
    res.json({ products });
  } catch (error) {
    console.error("Erro ao buscar produtos da coleção:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
