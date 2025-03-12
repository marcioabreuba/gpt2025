import express from 'express';
import { getShopifyConfigByInstanceId, registerShopInstance } from '../../utils/shopInstanceResolver.js';
import { PrismaClient } from '@prisma/client';
import config from '../../config.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/shops
 * Lista todas as instâncias de lojas registradas
 */
router.get('/', async (req, res) => {
  try {
    // Verifica autenticação com API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== config.adminApiKey) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const shopInstances = await prisma.shopInstances.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return res.json(shopInstances);
  } catch (error) {
    console.error('Erro ao listar lojas:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/shops
 * Registra uma nova associação entre instanceId e loja
 */
router.post('/', async (req, res) => {
  try {
    // Verifica autenticação com API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== config.adminApiKey) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { instanceId, shopKey, name } = req.body;
    
    if (!instanceId || !shopKey || !name) {
      return res.status(400).json({ error: 'Parâmetros incompletos. Necessário: instanceId, shopKey, name' });
    }
    
    // Verifica se a shopKey existe na configuração
    if (!config.shopify[shopKey]) {
      return res.status(400).json({ error: `Loja com chave "${shopKey}" não encontrada na configuração` });
    }
    
    const shopInstance = await registerShopInstance(instanceId, shopKey, name);
    return res.status(201).json(shopInstance);
  } catch (error) {
    console.error('Erro ao registrar loja:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shops/:instanceId
 * Obtém a configuração da loja para um instanceId específico
 */
router.get('/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    
    if (!instanceId) {
      return res.status(400).json({ error: 'instanceId é obrigatório' });
    }
    
    const shopConfig = await getShopifyConfigByInstanceId(instanceId);
    return res.json(shopConfig);
  } catch (error) {
    console.error('Erro ao obter configuração da loja:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/shops/:instanceId
 * Remove uma associação entre instanceId e loja
 */
router.delete('/:instanceId', async (req, res) => {
  try {
    // Verifica autenticação com API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== config.adminApiKey) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { instanceId } = req.params;
    
    if (!instanceId) {
      return res.status(400).json({ error: 'instanceId é obrigatório' });
    }
    
    // Verifica se existe
    const existing = await prisma.shopInstances.findUnique({
      where: { instanceId }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Associação não encontrada' });
    }
    
    // Remove a associação
    await prisma.shopInstances.delete({
      where: { instanceId }
    });
    
    return res.json({ success: true, message: 'Associação removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover associação de loja:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router; 