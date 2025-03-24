import express from 'express';
import buscarpedidosRouter from './buscarpedidos.js';
import buscarprodutosRouter from './buscarprodutos.js';

const router = express.Router();

// Rota para buscar pedidos
router.use('/buscarpedidos', buscarpedidosRouter);

// Rota para buscar produtos
router.use('/buscarprodutos', buscarprodutosRouter);

export default router; 