import axios from 'axios';
import fetch from 'node-fetch';
import config from '../config.js';
import pineconeSearch from './BuscaPinecone.js';
import embeddingText from './embeddingText.js';
import Shopify from 'shopify-api-node';
import logger from '../utils/logger.js';

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
    public_url: `https://www.${config.store.url}/products/${product.handle}`,
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

export async function buscarProdutoPorId(productId) {
  try {
    if (!productId) {
      logger.warn("ProductId não fornecido");
      return null;
    }

    logger.debug(`Buscando produto com ID: ${productId}`);
    const productItem = await shopify.product.get(productId);

    return {
      public_url: `https://www.${config.store.url}/products/${productItem.handle}`,
      title: productItem.title,
      price: productItem.variants[0].price,
      description: productItem.body_html,
    }
  } catch (error) {
    logger.error(`Erro ao buscar produto com ID ${productId}:`, { error: error.message, stack: error.stack });
    return null;
  }
}

export async function get_products_info(nomes_produtos) {
  try {
    logger.debug("Nomes de produtos recebidos:", { nomes_produtos });

    // Gerar embeddings
    const embeddings = await Promise.all(
      nomes_produtos.map((nome_produto) => embeddingText(nome_produto))
    );
    logger.trace("Embeddings gerados"); // Removendo o log do conteúdo dos embeddings

    // Buscar itens no Pinecone
    const items = await Promise.all(
      embeddings.map((vectors) => pineconeSearch('text', vectors))
    );
    logger.trace("Itens encontrados no Pinecone", { count: items.flat().length });

    // Achatar o array de items e remover productIds duplicados
    const flattenedItems = [...new Set(items.flat().map(item => JSON.stringify(item)))]
      .map(item => JSON.parse(item));
    logger.debug("Itens únicos encontrados:", { count: flattenedItems.length });

    // Função para adicionar delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Preparar busca de produtos com limite de 8 itens
    const productsPromises = flattenedItems.slice(0, 8)
      .filter(item => item.productId !== undefined)
      .map(async (item, index) => {
        // Adicionar delay proporcional para cada requisição
        await delay(index * 3000);
        return buscarProdutoPorId(item.productId);
      });

    // Executar as promises e filtrar produtos válidos
    const products = (await Promise.all(productsPromises)).filter(product => product !== null);

    logger.debug("Produtos finais:", products);

    // Converter produtos em uma string formatada
    const productsString = products.map(product => {
      // Remover tags HTML da descrição
      const cleanDescription = product.description.replace(/<[^>]*>/g, '').trim();

      return `Título: ${product.title}. Preço: R$ ${product.price}. Descrição: ${cleanDescription}. Link do produto: ${product.public_url}.`;
    }).join(' ');

    logger.debug("String de produtos:", productsString);

    return productsString;
  } catch (error) {
    logger.error("Erro detalhado ao recuperar informações de produtos:", error);
    return {
      error: "Falha ao recuperar informações de produtos",
      detailedError: error.message
    };
  }
}

async function embeddingImage(imageUrl) {
  const response = await axios.post(
    'https://api.jina.ai/v1/embeddings',
    {
      input: [{ image: imageUrl }],  // Formato correto para imagens
      model: "jina-clip-v2",             // Modelo conforme documentação
      dimensions: 1024,                  // Dimensão explícita 
      normalized: true                   // Vetores normalizados
    },
    { 
      headers: { 
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
        'Content-Type': 'application/json'
      } 
    }
  );
  return response.data.data[0]?.embedding;
}

export async function get_products_info_by_image(imageUrl, extractedTextInfo = null) {
  try {
    console.log("🖼️ INÍCIO: Busca por similaridade visual de imagem");
    logger.debug("ImageUrl", imageUrl);
    
    // Verificar se há informações de texto extraídas para usar na busca
    let productNameFromText = null;
    if (extractedTextInfo && extractedTextInfo.tipo === 'produto') {
      console.log("📝 Informações de texto extraídas disponíveis:", JSON.stringify(extractedTextInfo, null, 2));
      
      // Extrair nome do produto se disponível
      if (extractedTextInfo.detalhes?.nome) {
        productNameFromText = extractedTextInfo.detalhes.nome;
        console.log("💡 Nome de produto extraído do texto:", productNameFromText);
        
        // Se temos um nome de produto do texto, podemos tentar buscar diretamente
        try {
          console.log("🔍 Tentando busca por texto com o nome extraído...");
          
          // Usar múltiplas estratégias de busca para melhorar a chance de encontrar
          // 1. Nome completo
          // 2. Palavras-chave principais (3-4 primeiras palavras)
          // 3. Termos alternativos baseados na categoria
          
          const searchTerms = [productNameFromText];
          
          // Adicionar palavras-chave principais
          const keywords = productNameFromText.split(' ').slice(0, 4).join(' ');
          if (keywords !== productNameFromText) {
            searchTerms.push(keywords);
          }
          
          // Adicionar termos alternativos baseados na categoria
          if (extractedTextInfo.detalhes?.categoria) {
            searchTerms.push(`${extractedTextInfo.detalhes.categoria} ${keywords}`);
          }
          
          console.log("🔤 Termos de busca gerados:", searchTerms);
          
          const textResults = await get_products_info(searchTerms);
          
          if (textResults && !textResults.error && textResults.length > 20) {
            console.log("✅ Busca por texto bem-sucedida! Usando resultados do texto.");
            return textResults;
          } else {
            console.log("⚠️ Busca por texto não retornou resultados satisfatórios. Continuando com busca visual.");
          }
        } catch (textSearchError) {
          console.error("⚠️ Erro na busca por texto:", textSearchError);
          console.log("⚠️ Continuando com busca visual como fallback.");
        }
      } else {
        console.log("ℹ️ Produto detectado, mas sem nome específico. Usando busca visual.");
      }
    } else {
      console.log("ℹ️ Nenhuma informação de texto extraída disponível. Usando apenas busca visual.");
    }

    // Gerar embeddings
    console.log("🧠 Gerando embeddings visuais via Jina CLIP...");
    const vectorsImage = await embeddingImage(imageUrl);
    console.log("✅ Embeddings visuais gerados com sucesso");
    logger.trace("Embeddings gerados:", vectorsImage);

    // Buscar itens no Pinecone
    console.log("🔍 Buscando produtos similares no Pinecone...");
    const itemsSearch = await pineconeSearch('image', vectorsImage);
    console.log(`🔢 Número de resultados encontrados: ${itemsSearch.length}`);
    console.log("🏆 Top resultados:", JSON.stringify(itemsSearch.slice(0, 3), null, 2));
    logger.trace("Itens encontrados no Pinecone:", JSON.stringify(itemsSearch, null, 2));

    // Achatar o array de items e remover productIds duplicados
    const flattenedItems = [...new Set(itemsSearch.flat().map(item => JSON.stringify(item)))]
      .map(item => JSON.parse(item));
    console.log(`🧹 Após remoção de duplicatas: ${flattenedItems.length} itens únicos`);
    logger.debug("Itens achatados sem duplicatas:", flattenedItems);

    // Função para adicionar delay
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Preparar busca de produtos com limite de 8 itens
    const productsPromises = flattenedItems.slice(0, 8)
      .filter(item => item.productId !== undefined)
      .map(async (item, index) => {
        // Adicionar delay proporcional para cada requisição
        await delay(index * 3000);
        console.log(`🔎 Buscando detalhes do produto ${index+1}/${Math.min(flattenedItems.length, 8)}: ID ${item.productId}`);
        return buscarProdutoPorId(item.productId);
      });

    // Executar as promises e filtrar produtos válidos
    const products = (await Promise.all(productsPromises)).filter(product => product !== null);
    console.log(`✅ ${products.length} produtos encontrados com detalhes completos`);

    logger.debug("Produtos finais:", products);

    // Converter produtos em uma string formatada
    const productsString = products.map(product => {
      // Remover tags HTML da descrição
      const cleanDescription = product.description.replace(/<[^>]*>/g, '').trim();

      return `Título: ${product.title}. Preço: R$ ${product.price}. Descrição: ${cleanDescription}. Link do produto: ${product.public_url}.`;
    }).join(' ');

    console.log(`🏁 Busca visual concluída. ${products.length} produtos encontrados.`);
    if (products.length > 0) {
      console.log(`📊 Primeiro produto encontrado: ${products[0].title} - R$ ${products[0].price}`);
    }
    
    logger.debug("String de produtos:", productsString);

    return productsString;
  } catch (error) {
    console.error('❌ ERRO na busca visual:', error);
    logger.error("Erro detalhado ao recuperar informações de produtos:", error);
    return "Não foi possível encontrar produtos similares. Erro: " + error.message;
  }
}