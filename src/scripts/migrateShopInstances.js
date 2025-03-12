/**
 * Script para migrar a configuração atual para o novo modelo de múltiplas lojas
 * 
 * Este script registra a instância atual do ZAPI como "loja1" no banco de dados,
 * permitindo a transição suave para o novo sistema de múltiplas lojas.
 */

import { PrismaClient } from '@prisma/client';
import config from '../config.js';
import { registerShopInstance } from '../utils/shopInstanceResolver.js';

const prisma = new PrismaClient();

async function migrateToMultiShop() {
  try {
    console.log('Iniciando migração para sistema multi-lojas...');
    
    // Verifica se já existe uma instância registrada para o instanceId atual
    const currentInstanceId = config.zapi.instanceId;
    
    if (!currentInstanceId) {
      console.error('Erro: ZAPI_INSTANCE_ID não configurado no .env');
      return;
    }
    
    const existingInstance = await prisma.shopInstances.findUnique({
      where: { instanceId: currentInstanceId }
    });
    
    if (existingInstance) {
      console.log(`Instância ${currentInstanceId} já está registrada como "${existingInstance.name}" (${existingInstance.shopKey})`);
    } else {
      // Registra a instância atual como "loja1"
      const shopInstance = await registerShopInstance(
        currentInstanceId,
        'loja1',
        'Loja Principal'
      );
      
      console.log(`Instância ${currentInstanceId} registrada com sucesso como "Loja Principal" (loja1)`);
      console.log('Detalhes:', shopInstance);
    }
    
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executa a migração
migrateToMultiShop(); 