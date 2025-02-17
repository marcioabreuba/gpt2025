// Carrega e exporta as configurações do projeto a partir das variáveis de ambiente
import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 3000,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    assistantId: process.env.ASSISTANT_ID,
    model: "gpt-4o"
  },
  redis: {
    url: `redis://default:${process.env.REDIS_PASSWORD}@${process.env.REDIS_URL}`
  },
  shopify: {
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN
  },
  zapi: {
    instanceId: process.env.ZAPI_INSTANCE_ID,
    token: process.env.ZAPI_TOKEN,
    clientToken: process.env.ZAPI_CLIENT_TOKEN
  },
  graphApiToken: process.env.GRAPH_API_TOKEN,
  serverLink: process.env.SERVER_LINK,
  timezone: "America/Sao_Paulo"
};
