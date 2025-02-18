import axios from 'axios';
import config from '../config.js';

/**
 * Faz a requisição à API de pedidos do Shopify com paginação.
 * @param {string} endpoint - Ex.: https://sualoja.myshopify.com/admin/api/2024-10/orders.json
 * @returns {Promise<Object>} - Objeto contendo a lista de pedidos, ex.: { orders: [...] }
 */
export async function getOrdersInfo(endpoint) {
  try {
    let allOrders = [];
    let nextUrl = null; // URL completa para a próxima página

    do {
      // Se houver uma URL para a próxima página, utiliza-a; senão, usa o endpoint inicial com os parâmetros desejados.
      let currentUrl = nextUrl ? new URL(nextUrl) : new URL(endpoint);
      if (!nextUrl) {
        currentUrl.searchParams.set('limit', '250');
        currentUrl.searchParams.set('status', 'any');
      }
      
      let response;
      try {
        response = await axios.get(currentUrl.toString(), {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': config.shopify.accessToken
          }
        });
      } catch (error) {
        // Se ocorrer erro 400 (por exemplo, devido ao uso do parâmetro page_info com status), interrompe a paginação.
        if (error.response && error.response.status === 400) {
          console.error("Token de paginação inválido ou fim da paginação:", error.response.data);
          break;
        } else {
          console.error("Erro ao obter pedidos do Shopify:", error.message);
          throw new Error("Não foi possível obter os pedidos.");
        }
      }

      // Concatena os pedidos retornados
      if (response.data.orders) {
        allOrders = allOrders.concat(response.data.orders);
      } else {
        allOrders = allOrders.concat(response.data);
      }

      // Verifica se existe o header 'Link' que indica a próxima página
      const linkHeader = response.headers.link;
      if (linkHeader) {
        // Exemplo de linkHeader:
        // <https://sualoja.myshopify.com/admin/api/2024-10/orders.json?limit=250&page_info=abcd>; rel="next"
        const regex = /<([^>]+)>;\s*rel="next"/;
        const match = linkHeader.match(regex);
        if (match && match[1]) {
          nextUrl = match[1];
        } else {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    } while (nextUrl);

    return { orders: allOrders };
  } catch (error) {
    console.error("Erro ao obter pedidos do Shopify:", error.message);
    throw new Error("Não foi possível obter os pedidos.");
  }
}
