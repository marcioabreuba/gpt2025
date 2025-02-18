// src/index.js
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

// Importa a nova rota de pedidos
import ordersRoutes from './routes/orders.js';

const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.set('trust proxy', 1);
app.use(limiter);
app.use(cors({ origin: '*', credentials: true }));
app.use(checkMessageSize);

// Registra as rotas da aplicação
app.use(statusRoutes);
app.use(productsRoutes);
app.use(webhookRoutes);

// Aqui registra a rota de pedidos
app.use(ordersRoutes);

// Middleware centralizado para tratamento de erros
app.use(errorHandler);

// Inicia o servidor
app.listen(config.port, () => {
  console.log(`Servidor rodando na porta ${config.port}`);
});
