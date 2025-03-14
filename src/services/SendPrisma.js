import express from 'express';
import httpStatus from 'http-status';
import { buscarTodosProdutos } from '../../services/buscar_produtos.js';
import { tratamentoProdutos } from '../../services/tratamentoProdutos.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

router.post('/enqueue-produtos', async (req, res) => {
  try {
    // Busca todos os produtos
    const produtos = await buscarTodosProdutos();
    
    // Processa os produtos para separar em idsName, idsImages e idsDescription
    const { idsName, idsImages, idsDescription } = await tratamentoProdutos(produtos);
    
    // Inserção para idsName (título dos produtos)
    for (const item of idsName) {
      await prisma.queueTraining.create({
        data: {
          status: false,       // Indica que ainda não foi processado
          type: 'text',        // Tipo texto para título
          productId: item.id,
          content: item.title,
        },
      });
    }
    
    // Inserção para idsImages (imagens dos produtos)
    for (const item of idsImages) {
      await prisma.queueTraining.create({
        data: {
          status: false,
          type: 'image',       // Tipo image
          productId: item.id,
          content: item.image, // Armazena o link da imagem
          metadata: item.variants, // Armazena os variants em formato JSON
        },
      });
    }
    
    // Inserção para idsDescription (descrição dos produtos)
    for (const item of idsDescription) {
      await prisma.queueTraining.create({
        data: {
          status: false,
          type: 'text',
          productId: item.id,
          content: item.description,
        },
      });
    }
    
    res.status(httpStatus.OK).json({
      message: 'Produtos enfileirados na tabela QueueTraining com sucesso!',
      total: idsName.length + idsImages.length + idsDescription.length,
    });
  } catch (error) {
    console.error('Erro ao enfileirar produtos:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ error: 'Erro ao enfileirar produtos' });
  }
});

export default router;
