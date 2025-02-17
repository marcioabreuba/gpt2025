// src/services/shopifyService.js

import axios from 'axios';
import fetch from 'node-fetch';
import config from '../config.js';

/**
 * Obtém os IDs das coleções do Shopify.
 * @returns {Array} - Lista de IDs das coleções.
 */
export async function getCollectionIds() {
  const url = `https://${config.shopify.shopDomain}/admin/api/2024-10/custom_collections.json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.shopify.accessToken
    }
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();
  // Retorna apenas a lista de IDs das coleções
  return data.custom_collections.map(collection => collection.id);
}

/**
 * Obtém os produtos de uma coleção específica, incluindo detalhes de variantes.
 * Cada produto recebe um 'public_url' que aponta para a página amigável do produto.
 * Nesta versão, removemos links de imagem/CDN para não expor esses dados.
 *
 * @param {string} collectionId - ID da coleção.
 * @returns {Array} - Lista de produtos com detalhes e 'public_url', mas sem links CDN.
 */
export async function getProductsByCollectionId(collectionId) {
  const url = `https://${config.shopify.shopDomain}/admin/api/2024-10/collections/${collectionId}/products.json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.shopify.accessToken
    }
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();

  // Mapeia cada produto para excluir campos de imagem e gerar 'public_url' amigável
  const productsWithInventory = data.products.map(product => ({
    // Mantemos apenas o que realmente precisamos
    title: product.title,
    handle: product.handle,
    // URL amigável para o cliente
    public_url: `https://www.tropicalize.com.br/products/${product.handle}`,
    // Variants sem imagens
    variants: product.variants ? product.variants.map(variant => ({
      id: variant.id,
      title: variant.title,
      price: variant.price,
      sku: variant.sku,
      inventoryItemId: variant.inventory_item_id
    })) : []
  }));

  return productsWithInventory;
}

/**
 * Obtém informações de produtos a partir de um endpoint arbitrário.
 * Caso o JSON retornado seja no formato { products: [...] },
 * cada produto receberá 'public_url' amigável baseado no 'handle'.
 * Removemos campos de imagem/CDN para não expor esses links.
 *
 * @param {string} endpoint - URL para obtenção das informações
 *                            (ex.: https://SEU-LOJA.myshopify.com/admin/api/2024-10/products.json).
 * @returns {object} - Dados dos produtos ou mensagem de erro (sem links CDN).
 */
export async function get_products_info(endpoint) {
  try {
    // Faz a requisição GET ao endpoint com cabeçalho de autenticação
    const response = await axios.get(endpoint, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': config.shopify.accessToken
      }
    });

    const originalData = response.data;

    // Se for um objeto no formato { products: [...] }, transformamos cada produto para incluir 'public_url'
    // e removemos imagens/CDN
    if (originalData.products && Array.isArray(originalData.products)) {
      const transformedProducts = originalData.products.map(product => ({
        // Mantemos apenas campos essenciais
        title: product.title,
        handle: product.handle,
        public_url: `https://www.tropicalize.com.br/products/${product.handle}`,
        variants: product.variants ? product.variants.map(variant => ({
          id: variant.id,
          title: variant.title,
          price: variant.price,
          sku: variant.sku,
          inventoryItemId: variant.inventory_item_id
        })) : []
      }));

      // Retorna o mesmo objeto, mas com a lista transformada e sem links de imagem
      return { ...originalData, products: transformedProducts };
    }

    // Se não tiver 'products', retornamos o original
    return originalData;

  } catch (error) {
    console.error("Erro ao recuperar informações de produtos:", error);
    return { error: "Falha ao recuperar informações de produtos" };
  }
}
