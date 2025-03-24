import express from 'express';
import { PrismaClient } from '@prisma/client';
import carrinhoAbandonadoService from '../../../services/carrinhoAbandonadoService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Rota para testar a autenticação com a Yampi
router.get('/testar-autenticacao', async (req, res) => {
  try {
    const resultado = await carrinhoAbandonadoService.verificarAutenticacao();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      sugestao: 'Verifique as credenciais da Yampi no arquivo .env e no painel administrativo da Yampi'
    });
  }
});

// Rota para sincronizar carrinhos abandonados com a Yampi (aceita GET e POST)
router.route('/sincronizar-carrinhos')
  .get(async (req, res) => {
    try {
      const resultado = await carrinhoAbandonadoService.buscarCarrinhosAbandonados();
      res.json(resultado);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        sugestao: 'Verifique as credenciais da Yampi no arquivo .env e no painel administrativo da Yampi'
      });
    }
  })
  .post(async (req, res) => {
    try {
      const resultado = await carrinhoAbandonadoService.buscarCarrinhosAbandonados();
      res.json(resultado);
    } catch (error) {
      res.status(500).json({
        error: error.message,
        sugestao: 'Verifique as credenciais da Yampi no arquivo .env e no painel administrativo da Yampi'
      });
    }
  });

// Rota para listar todos os carrinhos abandonados
router.get('/carrinhos', async (req, res) => {
  try {
    const carrinhos = await prisma.carrinhosAbandonados.findMany({
      orderBy: {
        ultimaAtividade: 'desc'
      }
    });
    res.json(carrinhos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para marcar um carrinho como recuperado
router.put('/carrinhos/:cartId/recuperar', async (req, res) => {
  const { cartId } = req.params;
  const { observacoes } = req.body;

  try {
    const carrinho = await prisma.carrinhosAbandonados.update({
      where: { cartId },
      data: {
        recuperado: true,
        observacoes: observacoes || 'Carrinho recuperado pelo callcenter'
      }
    });
    res.json(carrinho);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 