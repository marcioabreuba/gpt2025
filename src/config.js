// Carrega as variáveis de ambiente do arquivo .env
import dotenv from 'dotenv';
dotenv.config();

export default {
  // Configuração da porta do servidor
  port: process.env.PORT || 3000,

  // Chave de API para operações administrativas
  adminApiKey: process.env.ADMIN_API_KEY || 'admin-secret-key',

  // Configuração da API OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    assistantId: process.env.ASSISTANT_ID,
    model: "gpt-4o"
  },

  // Configuração do Redis
  redis: {
    url: process.env.REDIS_URL ? `redis://default:${process.env.REDIS_PASSWORD}@${process.env.REDIS_URL}` : null
  },

  // Configuração da Shopify
  shopify: {
    // Configuração para múltiplas lojas
    loja1: {
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN_LOJA1,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN_LOJA1
    },
    loja2: {
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN_LOJA2,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN_LOJA2
    },
    loja3: {
      shopDomain: process.env.SHOPIFY_SHOP_DOMAIN_LOJA3,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN_LOJA3
    },
    // Mantida por compatibilidade com código existente - aponta para loja1
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN_LOJA1,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN_LOJA1
  },

  // Configuração do ZAPI
  zapi: {
    instanceId: process.env.ZAPI_INSTANCE_ID,
    token: process.env.ZAPI_TOKEN,
    clientToken: process.env.ZAPI_CLIENT_TOKEN
  },

  // Configuração do banco de dados PostgreSQL
  database: {
    url: process.env.DATABASE_URL
  },

  // Configuração do Pinecone
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    index: process.env.PINECONE_INDEX
  },

  // API Jina
  jina: {
    apiKey: process.env.JINA_API_KEY
  },

  // URL do servidor
  serverLink: process.env.SERVER_LINK,

  // Fuso horário padrão
  timezone: "America/Sao_Paulo",
  
  // Configuração de logging
  loggerLevel: process.env.LOG_LEVEL || 'info',
  
  // Modo de ambiente
  nodeEnv: process.env.NODE_ENV || 'production'
};