import Shopify from 'shopify-api-node';
import config from '../config.js';
import { getShopifyConfigByInstanceId } from '../utils/shopInstanceResolver.js';

// Função para criar uma instância do Shopify com base no instanceId
const createShopifyClient = async (instanceId) => {
  const shopConfig = await getShopifyConfigByInstanceId(instanceId);
  
  return new Shopify({
    shopName: shopConfig.shopDomain,
    accessToken: shopConfig.accessToken
  });
};

// Função para buscar todos os produtos com paginação
export const buscarTodosProdutos = async (instanceId) => {
  try {
    // Cria uma instância do cliente Shopify com base no instanceId
    const shopify = await createShopifyClient(instanceId);
    const shopConfig = await getShopifyConfigByInstanceId(instanceId);
    
    let allProducts = [];
    let params = { limit: 250 }; // O máximo permitido pela API é 250
    
    let moreProductsExist = true;
    
    while (moreProductsExist) {
      const products = await shopify.product.list(params);
      
      // Adiciona os produtos encontrados ao array completo
      allProducts = [...allProducts, ...products];
      
      // Verifica se há mais produtos para buscar
      if (products.length < 250) {
        moreProductsExist = false;
      } else {
        // Configura a próxima página usando o ID do último produto
        params.since_id = products[products.length - 1].id;
      }
      
      console.log(`Carregados ${allProducts.length} produtos até agora da loja ${shopConfig.name}...`);
    }
    
    console.log(`Total de produtos carregados da loja ${shopConfig.name}: ${allProducts.length}`);
    
    // Adiciona informação da loja aos produtos
    allProducts = allProducts.map(product => ({
      ...product,
      shopName: shopConfig.name,
      shopKey: shopConfig.shopKey
    }));
    
    return allProducts;
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return false;
  }
};

// Função para buscar todos os pedidos com paginação
export const buscarTodosPedidos = async () => {
  try {
    let allOrders = [];
    let params = { limit: 250 }; // O máximo permitido pela API é 250
    
    let moreOrdersExist = true;
    
    while (moreOrdersExist) {
      const orders = await shopify.order.list(params);
      
      // Adiciona os pedidos encontrados ao array completo
      allOrders = [...allOrders, ...orders];
      
      // Verifica se há mais pedidos para buscar
      if (orders.length < 250) {
        moreOrdersExist = false;
      } else {
        // Configura a próxima página usando o ID do último pedido
        params.since_id = orders[orders.length - 1].id;
      }
      
      console.log(`Carregados ${allOrders.length} pedidos até agora...`);
    }
    
    console.log(`Total de pedidos carregados: ${allOrders.length}`);
    return allOrders;
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    return false;
  }
};

// Função para buscar pedidos com filtros específicos
export const buscarPedidosComFiltro = async (filtros = {}) => {
  try {
    let allOrders = [];
    let params = { 
      limit: 250,
      ...filtros // Você pode passar filtros como status, financial_status, etc.
    };
    
    let moreOrdersExist = true;
    
    while (moreOrdersExist) {
      const orders = await shopify.order.list(params);
      
      allOrders = [...allOrders, ...orders];
      
      if (orders.length < 250) {
        moreOrdersExist = false;
      } else {
        params.since_id = orders[orders.length - 1].id;
      }
      
      console.log(`Carregados ${allOrders.length} pedidos filtrados até agora...`);
    }
    
    console.log(`Total de pedidos filtrados carregados: ${allOrders.length}`);
    return allOrders;
  } catch (error) {
    console.error('Erro ao buscar pedidos com filtro:', error);
    return false;
  }
};

// Mantém a função original para compatibilidade com código existente
export const buscarProdutos = async () => {
  try {
    const products = await shopify.product.list();
    return products;
  } catch (error) {
    console.error('Erro ao buscar produtos (versão simples):', error);
    return false;
  }
};