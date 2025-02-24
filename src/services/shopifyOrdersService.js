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
import { findOrderByUser } from './prismaOrdersService.js';

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

// Configuração de constantes
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

// Constantes HTTP
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_SERVER_ERROR = 500;
const DEFAULT_REQUEST_TIMEOUT = 10000;

// Instância do Axios configurada
const axiosInstance = axios.create({
  timeout: DEFAULT_REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
  },
});

// Helpers
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isValidUrl = (urlString) => {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
};

const extractNextUrl = (linkHeader) => {
  if (!linkHeader) return null;
  const regex = /<([^>]+)>;\s*rel="next"/;
  const match = linkHeader.match(regex);
  return match?.[1] || null;
};

const calculateBackoff = (base, attempt) => {
  const jitter = Math.random() * base;
  return base * Math.pow(2, attempt) + jitter;
};

// Funções principais
const fetchOrdersPage = async (url, retries = MAX_RETRIES, attempt = 0) => {
  try {
    logger.debug(`Buscando pedidos na URL: ${url.toString()}`);
    const response = await axiosInstance.get(url.toString());
    return response;
  } catch (error) {
    const { response } = error;
    if (response && (response.status === HTTP_STATUS_BAD_REQUEST || response.status === HTTP_STATUS_NOT_FOUND)) {
      logger.warn(`Erro de paginação ou token inválido: ${response.status} - ${JSON.stringify(response.data)}`);
      return null;
    }
    if (retries > 0 && (!response || response.status >= HTTP_STATUS_SERVER_ERROR)) {
      const backoffTime = calculateBackoff(INITIAL_BACKOFF, attempt);
      logger.warn(`Erro ao buscar pedidos: ${error.message}. Tentando novamente em ${backoffTime.toFixed(0)}ms. Tentativas restantes: ${retries}`, { stack: error.stack });
      await sleep(backoffTime);
      return fetchOrdersPage(url, retries - 1, attempt + 1);
    }
    logger.error(`Falha ao buscar pedidos do Shopify: ${error.message}`, { error, stack: error.stack });
    throw new Error(`Não foi possível obter os pedidos do Shopify: ${error.message}`);
  }
};

const processOrdersWithTracking = (orders = []) => {
  return orders.map((order) => ({
    ...order,
    tracking_info: order.fulfillments?.map((fulfillment) => ({
      tracking_number: fulfillment.tracking_number ?? null,
      tracking_company: fulfillment.tracking_company ?? null,
      tracking_url: fulfillment.tracking_urls?.[0] ?? null,
    })) || []
  }));
};

const setOrdersCache = async (orders) => {
  try {
    await redisClient.set(ORDERS_CACHE_KEY, JSON.stringify(orders), 'EX', CACHE_TTL_SECONDS);
    logger.debug(`Cache atualizado com ${orders.length} pedidos`);
  } catch (error) {
    logger.warn(`Erro ao armazenar pedidos no cache Redis: ${error.message}`, { stack: error.stack });
  }
};

// Exportações principais
export async function getOrdersInfo(endpoint) {
  if (!isValidUrl(endpoint)) {
    logger.error('Endpoint inválido fornecido.');
    throw new Error('Endpoint inválido.');
  }

  let cachedOrders;
  try {
    const cachedData = await redisClient.get(ORDERS_CACHE_KEY);
    cachedOrders = cachedData ? JSON.parse(cachedData) : null;
  } catch (error) {
    logger.warn(`Erro no cache Redis: ${error.message}`, { stack: error.stack });
  }

  if (Array.isArray(cachedOrders)) {
    logger.info(`Retornando ${cachedOrders.length} pedidos do cache`);
    return { orders: cachedOrders };
  }

  let allOrders = [];
  let nextUrl = null;
  const baseUrl = new URL(endpoint);
  baseUrl.searchParams.set('limit', ORDERS_LIMIT);
  baseUrl.searchParams.set('status', 'any');

  do {
    const currentUrl = nextUrl ? new URL(nextUrl) : baseUrl;
    const response = await fetchOrdersPage(currentUrl);
    
    if (response) {
      const ordersFromResponse = response.data?.orders || [];
      allOrders = allOrders.concat(ordersFromResponse);
      nextUrl = extractNextUrl(response.headers.link);
    }
  } while (nextUrl);

  const processedOrders = processOrdersWithTracking(allOrders);
  await setOrdersCache(processedOrders);
  return { orders: processedOrders };
}

export async function getOrderByNumber(endpoint, orderQuery, userPhone, userCpf = null) {
  try {
    // 1. Busca no Prisma seguindo a ordem de prioridade
    const prismaOrder = await findOrderByUser(userPhone, orderQuery, userCpf);
    console.log('Prisma Order:', prismaOrder);
    
    if (!prismaOrder) {
      return {
        status: 'not_found',
        message: 'Não encontrei pedidos com seus dados 😕',
        needs_additional_info: true
      };
    }

    const response = await axios.get(`https://6281d6-2.myshopify.com/admin/api/2024-10/orders/${prismaOrder.orderId}.json`, {
      headers: {
        'X-Shopify-Access-Token': config.shopify.accessToken,
        'Accept-Encoding': 'gzip,deflate,compress'
      },
      timeout: 15000
    });

    if (!response.data.order) {
      return {
        status: 'shopify_error',
        message: 'Detalhes do pedido indisponíveis 🛠️',
        order_number: prismaOrder.externalId
      };
    }

    // 3. Formata resposta
    const order = response.data.order;
    console.log('Order:', order);
    return {
      status: 'found',
      order_number: order.order_number,
      created_at: new Date(order.created_at).toLocaleDateString('pt-BR'),
      total: `${order.total_price} ${order.currency}`,
      tracking: order.fulfillments?.[0]?.tracking_number || 'Não disponível',
      shipping_address: order.shipping_address?.address1 || 'Endereço não disponível'
    };

  } catch (error) {
    logger.error(`Erro completo: ${error.stack}`);
    return {
      status: 'error',
      message: 'Estou com dificuldades técnicas 😥 Tente novamente mais tarde!',
      retry_possible: true
    };
  }
}

// Exportações auxiliares para testes
export const __test__ = {
  isValidUrl,
  extractNextUrl,
  processOrdersWithTracking
};