import express from 'express';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import axios from 'axios';
import 'dotenv/config';

const router = express.Router();
const prisma = new PrismaClient();

// Configurações do Shopify
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Função para buscar todos os pedidos com paginação
async function fetchAllShopifyOrders() {
  let allOrders = [];
  let nextPageUrl = `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2024-10/orders.json?status=any&limit=250`;
  let attempt = 0;
  const maxAttempts = 3;

  while (nextPageUrl && attempt < maxAttempts) {
    try {
      const response = await axios.get(nextPageUrl, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Accept-Encoding': 'gzip,deflate,compress',
        },
        timeout: 30000,
      });

      allOrders = [...allOrders, ...response.data.orders];

      const linkHeader = response.headers.link;
      nextPageUrl = null;

      if (linkHeader) {
        const links = linkHeader.split(',');
        const nextLink = links.find(link => link.includes('rel="next"'));
        if (nextLink) {
          nextPageUrl = nextLink.split(';')[0].trim().slice(1, -1);
        }
      }
      attempt = 0;
    } catch (error) {
      console.error(`Erro na paginação (tentativa ${attempt + 1}/${maxAttempts}):`, error.message);
      attempt++;
      if (attempt >= maxAttempts) {
        throw new Error('Falha na paginação após 3 tentativas');
      }
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }

  return allOrders;
}

// Função para mapear dados do pedido
function mapOrderData(order) {
  const latestFulfillment = order.fulfillments?.length > 0 ? order.fulfillments[order.fulfillments.length - 1] : null;

  return {
    orderId: order.id.toString(),
    externalId: order.order_number?.toString() || null,
    cpf: order.shipping_address?.company || null,
    phone: order.customer?.phone || order.shipping_address?.phone.toString() || null,
  };
}

// Rota principal
router.post('/pedidos', async (req, res) => {
  try {
    const orders = await fetchAllShopifyOrders();
    console.log(`🔄 Total de pedidos encontrados: ${orders.length}`);

    const results = {
      success: 0,
      skipped: 0,
      errors: 0,
      lastOrderId: null,
    };

    for (const order of orders) {
      try {
        const orderData = mapOrderData(order);

        if (!orderData.orderId) {
          console.warn(`⚠️ Pedido ${order.id} inválido, pulando...`);
          results.skipped++;
          continue;
        }

        await prisma.$transaction(async (tx) => {
          await tx.orders.upsert({
            where: { orderId: orderData.orderId },
            update: orderData,
            create: orderData,
          });
        });

        results.success++;
        results.lastOrderId = order.id;
        console.log(`✅ Pedido ${order.id} sincronizado`);

      } catch (error) {
        results.errors++;
        console.error(`❌ Erro no pedido ${order.id}:`, error.message);
        if (process.env.NODE_ENV === 'development') {
          console.error('Detalhes do erro:', error);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Sincronização concluída',
      stats: {
        total: orders.length,
        ...results,
      },
    });

  } catch (error) {
    console.error('🚨 Erro geral na sincronização:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erro na sincronização',
      details: process.env.NODE_ENV === 'development' ? error.message : null,
    });
  } finally {
    await prisma.$disconnect();
  }
});

export default router;