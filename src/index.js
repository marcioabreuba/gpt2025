import 'dotenv/config';
import './utils/logger.js'; // Garante que o logger é carregado primeiro
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import config from './config.js';
import limiter from './middlewares/rateLimiter.js';
import { checkMessageSize } from './middlewares/messageSize.js';
import { errorHandler } from './middlewares/errorHandler.js';
import pkg from '@prisma/client';
import logger from './utils/logger.js';
const { PrismaClient } = pkg;

// Manipulador global para exceções não tratadas
process.on('uncaughtException', (error) => {
  console.error('ERRO NÃO TRATADO:', error);
  logger.error(`Exceção não tratada: ${error.message}`, { 
    stack: error.stack,
    name: error.name
  });
  // Não encerramos o processo para manter o servidor funcionando
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('PROMISE REJEITADA NÃO TRATADA:', reason);
  logger.error(`Promise rejeitada não tratada: ${reason}`, { 
    stack: reason?.stack,
    promise: promise.toString().substring(0, 100) + '...'
  });
});

// Importa os cronjobs (eles rodam automaticamente)
import './services/cronjobTraining.js'
import './services/cronjobOrders.js'
import { forceResetProcessingState } from './services/conversationService.js';

// Rotas
import statusRoutes from './routes/status.js';
import productsRoutes from './routes/products.js';
import webhookRoutes from './routes/webhook.js';
import ordersRoutes from './routes/orders.js';
import pedidosRoutes from './routes/api/pedidos.js';
import produtosRoutes from './routes/api/produtos.js';
import trueRoutes from './routes/api/true.js';
import shopsRoutes from './routes/api/shops.js';

// Inicialização do Express
const app = express();
const prisma = new PrismaClient();

// Inicializa o banco de dados
const startDb = async () => {
  try {
    await prisma.$connect();
    logger.info('Conexão com o banco de dados estabelecida');
  } catch (error) {
    logger.error('Erro ao conectar ao banco: ' + error.message);
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
  logger.info('Iniciando servidor');
  
  await startDb();

  // Registra as rotas corretamente
  app.use(statusRoutes);
  app.use(productsRoutes);
  app.use(webhookRoutes);
  app.use('/api', ordersRoutes);
  app.use('/api', pedidosRoutes);
  app.use('/api', produtosRoutes);
  app.use('/api', trueRoutes);
  app.use('/api/shops', shopsRoutes);
  
  // Endpoint de emergência para reset do estado de processamento
  app.post('/api/reset', (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'];
      
      // Verificação básica de segurança
      if (apiKey !== config.adminApiKey) {
        return res.status(401).json({ error: 'Acesso não autorizado' });
      }
      
      const result = forceResetProcessingState();
      logger.info('Reset forçado do estado de processamento', result);
      
      return res.json({
        success: true,
        message: 'Estado de processamento resetado com sucesso',
        ...result
      });
    } catch (error) {
      logger.error('Erro ao resetar estado de processamento', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  // Tratamento de erros (deve ser o último middleware)
  app.use(errorHandler);

  // Inicia o servidor
  app.listen(config.port, () => {
    logger.info(`Servidor rodando na porta ${config.port}`);
  });
}

// Inicia a aplicação de forma segura
startServer().catch(error => {
  logger.error('Falha na inicialização: ' + error.message);
  process.exit(1);
});
