import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import config from './config.js';
import limiter from './middlewares/rateLimiter.js';
import { checkMessageSize } from './middlewares/messageSize.js';
import { errorHandler } from './middlewares/errorHandler.js';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// Importa o cronjob (ele roda automaticamente)
import './services/cronjobTraining.js'

// Rotas
import statusRoutes from './routes/status.js';
import productsRoutes from './routes/products.js';
import webhookRoutes from './routes/webhook.js';
import ordersRoutes from './routes/orders.js';
import pedidosRoutes from './routes/api/pedidos.js';
import produtosRoutes from './routes/api/produtos.js';
import trueRoutes from './routes/api/true.js';

// Inicialização do Express
const app = express();
const prisma = new PrismaClient();

// Inicializa o banco de dados
const startDb = async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco:', error);
    process.exit(1);
  }
};

// Middlewares
app.use(bodyParser.json({ limit: '50mb' }));
app.set('trust proxy', 1);
app.use(limiter);
app.use(cors({ origin: '*', credentials: true }));
app.use(checkMessageSize);

// Inicialização segura do servidor
async function startServer() {
  await startDb();

  // Registra as rotas corretamente
  app.use(statusRoutes);
  app.use(productsRoutes);
  app.use(webhookRoutes);
  app.use('/api', ordersRoutes);
  app.use('/api', pedidosRoutes);
  app.use('/api', produtosRoutes);
  app.use('/api', trueRoutes);

  // Tratamento de erros (deve ser o último middleware)
  app.use(errorHandler);

  // Inicia o servidor
  app.listen(config.port, () => {
    console.log(`🚀 Servidor rodando na porta ${config.port}`);
  });
}

// Inicia a aplicação de forma segura
startServer().catch(error => {
  console.error('❌ Falha na inicialização:', error);
  process.exit(1);
});
