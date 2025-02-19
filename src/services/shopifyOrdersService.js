'use strict';
/**
 * Shopify Orders Service
 *
 * Responsável por buscar, processar e retornar pedidos da API do Shopify,
 * utilizando paginação, cache global com Redis (TTL de 24 horas), retry com backoff exponencial e
 * busca específica por número de pedido.
 */

import axios from 'axios';
import config from '../config.js';
import redisClient from '../redisClient.js';
import winston from 'winston';

// Configuração do logger com Winston, incluindo timestamp e stack trace
const logger = winston.createLogger({
  level: config.loggerLevel || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
    )
  ),
  transports: [new winston.transports.Console()],
});

// Configuração: o cache é global com TTL de 24 horas (86400 segundos)
const {
  cache: {
    ordersCacheKey: ORDERS_CACHE_KEY = 'shopify:orders',
    ttlSeconds: CACHE_TTL_SECONDS = 86400,
  } = {},
  shopify: {
    ordersLimit: ORDERS_LIMIT = 250,
    maxRetries: MAX_RETRIES = 3,
    initialBackoff: INITIAL_BACKOFF = 500,
    accessToken: SHOPIFY_ACCESS_TOKEN,
  } = {},
} = config;

// Constantes HTTP e de timeout
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_SERVER_ERROR = 500;
const DEFAULT_REQUEST_TIMEOUT = 10000; // 10 segundos

// Instância do Axios configurada para a API do Shopify
const axiosInstance = axios.create({
  timeout: DEFAULT_REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
  },
});

/**
 * Aguarda um período especificado.
 * @param {number} ms - Milissegundos para aguardar.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Valida se a string é uma URL válida.
 * @param {string} urlString
 * @returns {boolean}
 */
const isValidUrl = (urlString) => {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
};

/**
 * Extrai a URL da próxima página a partir do header "Link".
 * Exemplo: '<https://.../orders.json?limit=250&page_info=abcd>; rel="next"'
 * @param {string} linkHeader - Header contendo os links de paginação.
 * @returns {string|null} URL da próxima página ou null.
 */
const extractNextUrl = (linkHeader) => {
  if (!linkHeader) return null;
  const regex = /<([^>]+)>;\s*rel="next"/;
  const match = linkHeader.match(regex);
  return match?.[1] || null;
};

/**
 * Calcula o tempo de backoff exponencial com jitter.
 * @param {number} base - Tempo base em ms.
 * @param {number} attempt - Número da tentativa atual.
 * @returns {number} Tempo de espera em ms.
 */
const calculateBackoff = (base, attempt) => {
  const jitter = Math.random() * base;
  return base * Math.pow(2, attempt) + jitter;
};

/**
 * Realiza a requisição para uma página de pedidos na API do Shopify com retry.
 * @param {URL} url - URL com os parâmetros de consulta.
 * @param {number} retries - Tentativas restantes.
 * @param {number} attempt - Tentativa atual.
 * @returns {Promise<import('axios').AxiosResponse|null>}
 */
const fetchOrdersPage = async (url, retries = MAX_RETRIES, attempt = 0) => {
  try {
    logger.debug(`Buscando pedidos na URL: ${url.toString()}`);
    const response = await axiosInstance.get(url.toString());
    return response;
  } catch (error) {
    const { response } = error;
    if (response && (response.status === HTTP_STATUS_BAD_REQUEST || response.status === HTTP_STATUS_NOT_FOUND)) {
      logger.warn(
        `Erro de paginação ou token inválido: ${response.status} - ${JSON.stringify(response.data)}`
      );
      return null;
    }
    if (retries > 0 && (!response || response.status >= HTTP_STATUS_SERVER_ERROR)) {
      const backoffTime = calculateBackoff(INITIAL_BACKOFF, attempt);
      logger.warn(
        `Erro ao buscar pedidos: ${error.message}. Tentando novamente em ${backoffTime.toFixed(0)}ms. Tentativas restantes: ${retries}`,
        { stack: error.stack }
      );
      await sleep(backoffTime);
      return fetchOrdersPage(url, retries - 1, attempt + 1);
    }
    logger.error(`Falha ao buscar pedidos do Shopify: ${error.message}`, { error, stack: error.stack });
    throw new Error(`Não foi possível obter os pedidos do Shopify: ${error.message}`);
  }
};

/**
 * Processa a lista de pedidos, extraindo as informações de rastreamento dos fulfillments.
 * @param {Array} orders - Lista de pedidos.
 * @returns {Array} Lista de pedidos com o campo "tracking_info" incluído.
 */
const processOrdersWithTracking = (orders = []) => {
  return orders.map((order) => {
    const tracking_info =
      order.fulfillments?.map((fulfillment) => ({
        tracking_number: fulfillment.tracking_number ?? null,
        tracking_company: fulfillment.tracking_company ?? null,
        tracking_url:
          Array.isArray(fulfillment.tracking_urls) && fulfillment.tracking_urls.length > 0
            ? fulfillment.tracking_urls[0]
            : null,
      })) || [];
    return { ...order, tracking_info };
  });
};

/**
 * Armazena os pedidos no cache Redis com TTL de 24 horas.
 * @param {Array} orders - Lista de pedidos.
 * @returns {Promise<void>}
 */
const setOrdersCache = async (orders) => {
  try {
    await redisClient.set(ORDERS_CACHE_KEY, JSON.stringify(orders), 'EX', CACHE_TTL_SECONDS);
    logger.debug('Pedidos armazenados no cache Redis com sucesso.');
    const sortedOrderNames = orders
      .map((order) => order.name)
      .sort((a, b) => {
        const numA = parseInt(a.replace('#', '').trim(), 10);
        const numB = parseInt(b.replace('#', '').trim(), 10);
        return numA - numB;
      });
    logger.debug(`Cache atualizado com ${orders.length} pedidos. Lista completa: ${sortedOrderNames.join(', ')}`);
  } catch (error) {
    logger.warn(`Erro ao armazenar pedidos no cache Redis: ${error.message}`, { stack: error.stack });
  }
};

/**
 * Obtém todos os pedidos da API do Shopify, utilizando cache Redis.
 * Se os pedidos estiverem em cache (TTL de 24h), eles serão retornados sem nova busca.
 * @param {string} endpoint - Exemplo: 'https://sualoja.myshopify.com/admin/api/2024-10/orders.json'
 * @returns {Promise<{ orders: Array }>}
 */
export async function getOrdersInfo(endpoint) {
  if (!isValidUrl(endpoint)) {
    logger.error('Endpoint inválido fornecido.');
    throw new Error('Endpoint inválido.');
  }

  let cachedOrders;
  try {
    const cachedData = await redisClient.get(ORDERS_CACHE_KEY);
    if (cachedData) {
      try {
        cachedOrders = JSON.parse(cachedData);
      } catch (parseError) {
        logger.warn(`Erro ao fazer parse dos dados do cache Redis: ${parseError.message}`, { stack: parseError.stack });
      }
    }
  } catch (cacheError) {
    logger.warn(`Erro ao acessar o cache Redis: ${cacheError.message}`, { stack: cacheError.stack });
  }

  if (Array.isArray(cachedOrders)) {
    const sortedOrderNames = cachedOrders
      .map((order) => order.name)
      .sort((a, b) => parseInt(a.replace('#', '').trim(), 10) - parseInt(b.replace('#', '').trim(), 10));
    logger.info(`Retornando pedidos do cache Redis. Total: ${cachedOrders.length}. Lista completa: ${sortedOrderNames.join(', ')}`);
    return { orders: cachedOrders };
  }

  let allOrders = [];
  let nextUrl = null;
  const baseUrl = new URL(endpoint);
  baseUrl.searchParams.set('limit', String(ORDERS_LIMIT));
  baseUrl.searchParams.set('status', 'any');

  do {
    const currentUrl = nextUrl ? new URL(nextUrl) : baseUrl;
    let response;
    try {
      response = await fetchOrdersPage(currentUrl);
    } catch (fetchError) {
      logger.error(`Erro ao buscar página: ${fetchError.message}`, { stack: fetchError.stack });
      throw fetchError;
    }
    if (!response) break;

    const { data, headers } = response;
    let ordersFromResponse = [];
    if (data?.orders && Array.isArray(data.orders)) {
      ordersFromResponse = data.orders;
    } else if (Array.isArray(data)) {
      ordersFromResponse = data;
    } else {
      logger.warn('Formato inesperado dos dados retornados.', { data });
    }

    if (Array.isArray(ordersFromResponse)) {
      allOrders = allOrders.concat(ordersFromResponse);
    } else {
      logger.warn('Os dados dos pedidos não estão no formato esperado.');
    }

    nextUrl = extractNextUrl(headers.link);
    logger.info(`Pedidos acumulados até o momento: ${allOrders.length}`);
  } while (nextUrl);

  if (!Array.isArray(allOrders)) {
    logger.warn('Nenhum pedido foi retornado ou o formato está incorreto.');
    allOrders = [];
  }

  const ordersWithTracking = processOrdersWithTracking(allOrders);
  await setOrdersCache(ordersWithTracking);
  return { orders: ordersWithTracking };
}

/**
 * Retorna um subconjunto dos dados do pedido.
 * @param {Object} order - Objeto do pedido.
 * @returns {Object} Dados sanitizados do pedido, incluindo tracking code.
 */
const sanitizeOrderData = (order) => {
  const tracking = (order.tracking_info && order.tracking_info.length > 0)
    ? order.tracking_info[0]
    : {};
  return {
    order_number: order.order_number,
    name: order.name,
    created_at: order.created_at,
    total_price: order.total_price,
    currency: order.currency,
    tracking_info: order.tracking_info,
    tracking_code: tracking.tracking_number || null,
    tracking_company: tracking.tracking_company || null,
    tracking_url: tracking.tracking_url || null,
  };
};

/**
 * Extrai todos os dígitos de uma string.
 * @param {string} value - String de entrada.
 * @returns {string} Apenas os dígitos contidos na string.
 */
const extractDigits = (value) => {
  if (!value) return '';
  return value.replace(/\D/g, '');
};

/**
 * Normaliza o número do pedido de um objeto, utilizando os dígitos do campo order_number (se disponível)
 * ou do campo name.
 * @param {Object} order - Objeto do pedido.
 * @returns {string} Dígitos normalizados.
 */
const normalizeOrderNumberFromOrder = (order) => {
  if (order.order_number) {
    const normalized = extractDigits(order.order_number.toString());
    if (normalized) return normalized;
  }
  return extractDigits(order.name);
};

/**
 * Normaliza a query, extraindo apenas os dígitos.
 * @param {string} query - Query do pedido.
 * @returns {string} Dígitos normalizados.
 */
const normalizeQueryNumber = (query) => extractDigits(query);

/**
 * Busca um pedido específico na lista, utilizando o número normalizado.
 * Aceita formatos como "#1355", "1355" ou "Pedido #1355".
 * @param {Array} orders - Lista de pedidos.
 * @param {string} orderQuery - Query do pedido.
 * @returns {Object|null} Pedido encontrado ou null.
 */
const findOrderByNumber = (orders, orderQuery) => {
  if (!orders || !orderQuery) return null;
  const queryNormalized = normalizeQueryNumber(orderQuery);
  if (!queryNormalized) return null;
  return orders.find((order) => {
    const orderNormalized = normalizeOrderNumberFromOrder(order);
    logger.debug(`Comparando query ${queryNormalized} com pedido: ${order.name} (normalized: ${orderNormalized})`);
    return orderNormalized === queryNormalized;
  });
};

/**
 * Obtém um pedido específico por número, utilizando o cache global e busca na lista de pedidos.
 * @param {string} endpoint - URL do endpoint da Shopify.
 * @param {string} orderQuery - Número do pedido a ser buscado (ex.: "#1355" ou "1355").
 * @returns {Promise<Object|null>} Dados sanitizados do pedido se encontrado, ou null.
 */
export async function getOrderByNumber(endpoint, orderQuery) {
  if (!orderQuery) {
    logger.error('Número do pedido não foi fornecido.');
    throw new Error('Número do pedido é obrigatório.');
  }
  logger.info(`Buscando pedido com número: ${orderQuery}`);
  const startTime = Date.now();
  try {
    const ordersData = await getOrdersInfo(endpoint);
    const foundOrder = findOrderByNumber(ordersData.orders, orderQuery);
    const duration = Date.now() - startTime;
    logger.info(`Busca pelo pedido ${orderQuery} concluída em ${duration}ms.`);
    if (!foundOrder) {
      logger.info(`Pedido com número ${orderQuery} não encontrado.`);
      return null;
    }
    return sanitizeOrderData(foundOrder);
  } catch (error) {
    logger.error(`Erro ao buscar pedido com número ${orderQuery}: ${error.message}`, {
      stack: error.stack,
    });
    throw new Error(`Falha ao obter o pedido ${orderQuery}: ${error.message}`);
  }
}
