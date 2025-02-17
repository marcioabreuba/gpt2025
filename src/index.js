// Arquivo principal que configura o servidor Express, registra middlewares e rotas

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import config from './config.js';
import limiter from './middlewares/rateLimiter.js';
import { checkMessageSize } from './middlewares/messageSize.js';
import { errorHandler } from './middlewares/errorHandler.js';
import statusRoutes from './routes/status.js';
import productsRoutes from './routes/products.js';
import webhookRoutes from './routes/webhook.js';

const app = express();

// Configura o bodyParser para lidar com requisições JSON de até 50MB
app.use(bodyParser.json({ limit: '50mb' }));

// Confia em proxies (útil em ambientes de produção com balanceadores de carga)
app.set('trust proxy', 1);

// Aplica o rate limiter para limitar o número de requisições
app.use(limiter);

// Configura o CORS para aceitar requisições de qualquer origem
app.use(cors({ origin: '*', credentials: true }));

// Middleware para verificar o tamanho das mensagens
app.use(checkMessageSize);

// Registra as rotas da aplicação
app.use(statusRoutes);
app.use(productsRoutes);
app.use(webhookRoutes);

// Middleware centralizado para tratamento de erros (sempre deve vir após as rotas)
app.use(errorHandler);

// Inicia o servidor na porta configurada
app.listen(config.port, () => {
  console.log(`Servidor rodando na porta ${config.port}`);
});
