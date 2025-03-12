import config from '../config.js';
import axios from 'axios';
import { getShopifyConfigByInstanceId } from '../utils/shopInstanceResolver.js';

/**
 * Busca produtos por categoria na loja Shopify
 * @param {string} category - Categoria de produtos a buscar
 * @param {string} instanceId - ID da instância do ZAPI (opcional)
 * @returns {Promise<Array>} - Lista de produtos simplificada
 */
export async function getProductsByCategory(category, instanceId) {
  try {
    // Obtém a configuração da loja com base no instanceId
    const shopConfig = await getShopifyConfigByInstanceId(instanceId);
    
    const shopifyUrl = `https://${shopConfig.shopDomain}/admin/api/2024-10/products.json`;
    
    // Buscar produtos - pode precisar adicionar filtros apropriados
    const response = await axios.get(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': shopConfig.accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    // Filtrar por categoria e simplificar os dados
    const allProducts = response.data.products;
    const filteredProducts = allProducts.filter(product => {
      // Verifique se o produto se encaixa na categoria - ajuste conforme sua estrutura
      return product.product_type.toLowerCase().includes(category.toLowerCase()) ||
             product.tags.toLowerCase().includes(category.toLowerCase());
    });
    
    // Simplificar para facilitar a análise pela IA
    return filteredProducts.map(product => ({
      id: product.id,
      title: product.title,
      description: product.body_html.replace(/<[^>]*>/g, ''), // remove HTML
      price: product.variants[0]?.price || '',
      url: `https://${shopConfig.shopDomain}/products/${product.handle}`,
      image: product.images[0]?.src || '',
      shopName: shopConfig.name // Adiciona o nome da loja para referência
    }));
    
  } catch (error) {
    console.error('Erro ao buscar produtos do Shopify:', error);
    return [];
  }
} 