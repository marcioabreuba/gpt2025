import axios from 'axios';
import fetch from 'node-fetch';
import config from '../config.js';
import pineconeSearch from './BuscaPinecone.js';
import embeddingText from './embeddingText.js';
import Shopify from 'shopify-api-node';

const shopify = new Shopify({
  shopName: config.shopify.shopDomain,
  accessToken: config.shopify.accessToken
});

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

export const buscarProdutoPorId = async (productId) => {
  try {
    if (!productId) {
      console.warn("ProductId não fornecido");
      return null;
    }

    console.log(`Buscando produto com ID: ${productId}`);
    const productItem = await shopify.product.get(productId);
    
    return {
      public_url: `https://www.tropicalize.com.br/products/${productItem.handle}`,
      title: productItem.title,
      price: productItem.variants[0].price,
      description: productItem.body_html,
    }
  } catch (error) {
    console.error(`Erro ao buscar produto com ID ${productId}:`, error);
    return null;
  }
};

export async function get_products_info(nomes_produtos) {
  try {
    console.log("Nomes de produtos recebidos:", nomes_produtos);
    
    const embeddings = await Promise.all(nomes_produtos.map((nome_produto) => embeddingText(nome_produto)));
    console.log("Embeddings gerados:", embeddings);
    
    const items = await Promise.all(embeddings.map((vectors) => pineconeSearch('text', vectors)));
    console.log("Itens encontrados no Pinecone:", JSON.stringify(items, null, 2));
    
    // Achatar o array de items
    const flattenedItems = items.flat();
    console.log("Itens achatados:", flattenedItems);
    
    // Buscar produtos para cada item, garantindo que só itens com productId sejam processados
    const products = await Promise.all(
      flattenedItems
        .filter(item => item.productId !== undefined)
        .map(item => buscarProdutoPorId(item.productId))
    );

    const validProducts = products.filter(product => product !== null);
    console.log("Produtos finais:", validProducts);
    
    return validProducts;
  } catch (error) {
    console.error("Erro detalhado ao recuperar informações de produtos:", error);
    return { error: "Falha ao recuperar informações de produtos", detailedError: error.message };
  }
}