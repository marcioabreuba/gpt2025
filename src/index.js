// src/index.js
import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import config from './config.js';
import limiter from './middlewares/rateLimiter.js';
import { checkMessageSize } from './middlewares/messageSize.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { checkAndCreateTables } from './utils/dbCheck.js'; // Nova importação

// Rotas
import statusRoutes from './routes/status.js';
import productsRoutes from './routes/products.js';
import webhookRoutes from './routes/webhook.js';
import ordersRoutes from './routes/orders.js';
import pedidosRoutes from './routes/api/pedidos.js';

const app = express();

// Configuração inicial do banco de dados
async function initializeDatabase() {
  try {
    console.log('🔄 Verificando banco de dados...');
    await checkAndCreateTables();
    console.log('✅ Banco de dados verificado!');
  } catch (error) {
    console.error('❌ Falha na inicialização do banco:', error);
    process.exit(1); // Encerra o processo em caso de erro crítico
  }
}

// Middlewares
app.use(bodyParser.json({ limit: '50mb' }));
app.set('trust proxy', 1);
app.use(limiter);
app.use(cors({ origin: '*', credentials: true }));
app.use(checkMessageSize);

// Inicialização segura
async function startServer() {
  // 1. Primeiro verifica/cria as tabelas
  await initializeDatabase();

  // 2. Depois registra as rotas
  app.use(statusRoutes);
  app.use(productsRoutes);
  app.use(webhookRoutes);
  app.use('/api', ordersRoutes);
  app.use('/api', pedidosRoutes);

  // 3. Tratamento de erros deve ser o último middleware
  app.use(errorHandler);

  // 4. Inicia o servidor
  app.listen(config.port, () => {
    console.log(`🚀 Servidor rodando na porta ${config.port}`);
  });
}

// Inicia a aplicação de forma segura
startServer().catch(error => {
  console.error('❌ Falha na inicialização:', error);
  process.exit(1);
});