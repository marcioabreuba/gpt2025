import express from 'express';
import { PrismaClient } from '@prisma/client';
import carrinhoNaoPagoService from '../../../services/carrinhoNaoPagoService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Rota para buscar carrinhos não pagos
router.get('/carrinhos', async (req, res) => {
  try {
    const carrinhos = await prisma.carrinhosAbandonados.findMany({
      where: {
        tipoCarrinho: "nao_pago"
      },
      orderBy: {
        ultimaAtividade: 'desc'
      }
    });
    res.json(carrinhos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para sincronizar carrinhos não pagos com a Yampi
router.post('/sincronizar', async (req, res) => {
  try {
    const resultado = await carrinhoNaoPagoService.buscarCarrinhosNaoPagos();
    res.json(resultado);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      sugestao: 'Verifique as credenciais da Yampi no arquivo .env e no painel administrativo da Yampi'
    });
  }
});

// Rota para atualizar status de um carrinho
router.put('/carrinhos/:cartId/status', async (req, res) => {
  try {
    const { cartId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório' });
    }

    const carrinho = await carrinhoNaoPagoService.atualizarStatusCarrinho(cartId, status);
    res.json(carrinho);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota para exportar carrinhos não pagos em CSV
router.get('/exportar-csv', async (req, res) => {
  try {
    const carrinhos = await prisma.carrinhosAbandonados.findMany({
      where: {
        tipoCarrinho: "nao_pago"
      },
      orderBy: {
        ultimaAtividade: 'desc'
      }
    });

    // Cabeçalho do CSV
    const headers = [
      'ID do Carrinho',
      'Data de Criação',
      'Última Atividade',
      'Nome do Cliente',
      'Email do Cliente',
      'Telefone do Cliente',
      'Valor Total',
      'Valor Subtotal',
      'Valor do Frete',
      'Valor do Desconto',
      'Quantidade de Itens',
      'Origem do Tráfego',
      'Meio de Aquisição',
      'Campanha',
      'Status',
      'Data de Expiração'
    ];

    // Converte os dados para linhas CSV
    const rows = carrinhos.map(carrinho => [
      carrinho.cartId,
      new Date(carrinho.createdAt).toLocaleString('pt-BR'),
      new Date(carrinho.ultimaAtividade).toLocaleString('pt-BR'),
      carrinho.clienteNome || 'Não informado',
      carrinho.clienteEmail || 'Não informado',
      carrinho.clienteTelefone || 'Não informado',
      carrinho.valorTotal.toFixed(2),
      carrinho.valorSubtotal.toFixed(2),
      carrinho.valorFrete.toFixed(2),
      carrinho.valorDesconto.toFixed(2),
      carrinho.quantidadeItens,
      carrinho.utm_source || 'Não informado',
      carrinho.utm_medium || 'Não informado',
      carrinho.utm_campaign || 'Não informado',
      carrinho.status || 'pendente',
      carrinho.dataExpiracao ? new Date(carrinho.dataExpiracao).toLocaleString('pt-BR') : 'Não definida'
    ]);

    // Cria o conteúdo CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Configura o cabeçalho da resposta para download do arquivo
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=carrinhos_nao_pagos.csv');
    res.send(csvContent);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 