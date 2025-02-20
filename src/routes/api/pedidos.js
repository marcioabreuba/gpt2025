import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import 'dotenv/config'; // Carrega as variáveis de ambiente

const router = express.Router();
const prisma = new PrismaClient();

// Configuração do Shopify
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN; // Ex: 6281d6-2.myshopify.com
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN; // Seu Access Token

router.post('/pedidos', async (req, res) => {
  try {
    let allOrders = []; // Armazena todos os pedidos
    let nextPageUrl = `https://${SHOPIFY_SHOP_DOMAIN}/admin/api/2023-10/orders.json?limit=250`; // URL inicial

    // Loop para buscar todas as páginas de pedidos
    while (nextPageUrl) {
      const response = await axios.get(nextPageUrl, {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        },
      });

      const orders = response.data.orders;
      allOrders = allOrders.concat(orders); // Adiciona os pedidos da página atual

      // Verifica se há mais páginas
      const linkHeader = response.headers.link;
      nextPageUrl = null;

      if (linkHeader) {
        const links = linkHeader.split(',');
        const nextLink = links.find((link) => link.includes('rel="next"'));

        if (nextLink) {
          nextPageUrl = nextLink.split(';')[0].trim().slice(1, -1); // Extrai a URL da próxima página
        }
      }
    }

    console.log(`Total de pedidos encontrados: ${allOrders.length}`);

    // Inserir cada pedido no banco de dados usando Prisma
    for (const order of allOrders) {
      try {
        await prisma.orders.create({
          data: {
            orderId: order.id.toString(), // orderId (String)
            status: order.financial_status || 'unknown', // status (String)
            statusDescription: order.customer?.note || null, // statusDescription (String?)
            origin: 'shopify', // origin (String)
            externalId: order.order_number?.toString() || null, // externalId (String?)
            value: order.total_price, // value (String)
            discount: order.total_discounts, // discount (String?)
            currency: order.currency, // currency (String?)
            linkStatus: null, // linkStatus (String?)
            formPayment: order.gateway, // formPayment (String?)
            formSend: null, // formSend (String?)
            datePurchase: order.created_at, // datePurchase (String?)
            forecast: 0, // forecast (Int?)
            coupon: order.discount_codes || [], // coupon (Json?)
            Address: order.shipping_address || {}, // Address (Json?)
            items: order.line_items || [], // items (Json)
            recovery: { attempts: 0 }, // recovery (Json?)
            tracking: order.fulfillments || [], // tracking (Json?)
            shopifyId: { id: order.id, name: order.name }, // shopifyId (Json?)
            yampiId: {}, // yampiId (Json?)
          },
        });
        console.log(`Pedido ${order.id} inserido com sucesso!`);
      } catch (error) {
        console.error(`Erro ao inserir pedido ${order.id}:`, error);
      }
    }

    // Responder com sucesso
    res.send({
      success: true,
      message: 'Todos os pedidos foram processados!',
      totalPedidos: allOrders.length,
    });
  } catch (error) {
    console.error('Erro ao obter pedidos:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;