// src/services/shopifyService.js

import axios from 'axios';
import fetch from 'node-fetch';
import config from '../config.js';
import embeddingText from './embeddingText.js';
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
 * Obtém os produtos de uma coleção específica, incluindo paginação.
 * Cada produto recebe um 'public_url' amigável e são removidos campos indesejados.
 *
 * @param {string} collectionId - ID da coleção.
 * @returns {Array} - Lista de produtos com detalhes e 'public_url'.
 */
export async function getProductsByCollectionId(collectionId) {
  let allProducts = [];
  let nextUrl = null;
  const baseUrl = `https://${config.shopify.shopDomain}/admin/api/2024-10/collections/${collectionId}/products.json`;

  do {
    let currentUrl;
    if (nextUrl) {
      currentUrl = nextUrl;
    } else {
      const urlObj = new URL(baseUrl);
      urlObj.searchParams.set('limit', '250');
      currentUrl = urlObj.toString();
    }

    const response = await fetch(currentUrl, {
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
    if (data.products) {
      allProducts = allProducts.concat(data.products);
    } else {
      allProducts = allProducts.concat(data);
    }

    // Verifica se há header 'Link' para paginação
    const linkHeader = response.headers.get('link');
    if (linkHeader) {
      // Exemplo: <https://sualoja.myshopify.com/admin/api/2024-10/collections/123/products.json?limit=250&page_info=abcd>; rel="next"
      const regex = /<([^>]+)>;\s*rel="next"/;
      const match = linkHeader.match(regex);
      nextUrl = match && match[1] ? match[1] : null;
    } else {
      nextUrl = null;
    }
  } while (nextUrl);

  // Mapeia cada produto para manter apenas os campos essenciais e gerar 'public_url'
  const productsWithInventory = allProducts.map(product => ({
    title: product.title,
    handle: product.handle,
    public_url: `https://www.tropicalize.com.br/products/${product.handle}`,
    variants: product.variants
      ? product.variants.map(variant => ({
          id: variant.id,
          title: variant.title,
          price: variant.price,
          sku: variant.sku,
          inventoryItemId: variant.inventory_item_id
        }))
      : []
  }));

  return productsWithInventory;
}

/**
 * Obtém informações de produtos a partir de um endpoint arbitrário com paginação.
 * Caso o JSON retornado seja no formato { products: [...] },
 * cada produto receberá 'public_url' amigável baseado no 'handle'
 * e são removidos campos de imagem/CDN.
 *
 * @param {string} endpoint - URL para obtenção das informações
 *                            (ex.: https://SEU-LOJA.myshopify.com/admin/api/2024-10/products.json).
 * @returns {object} - Dados dos produtos transformados.
 */
export async function get_products_info(nomes_produtos) {
  try {
    const embeddings = await Promise.all(nomes_produtos.map((nome_produto) => embeddingText(nome_produto)));
    const items = await Promise.all(embeddings.map((vectors) => pineconeSearch('text', vectors)));
    console.log("🙏🏾🙏🏾🙏🏾", items);
    return items;
  } catch (error) {
    console.error("Erro ao recuperar informações de produtos:", error);
    return { error: "Falha ao recuperar informações de produtos" };
  }
}
