/**
 * Utilitário para resolver o instanceId do ZAPI para a loja Shopify correspondente
 */

import { PrismaClient } from '@prisma/client';
import config from '../config.js';

const prisma = new PrismaClient();

/**
 * Obtém a configuração da loja Shopify com base no instanceId do ZAPI
 * @param {string} instanceId - ID da instância do ZAPI
 * @returns {Object} - Configuração da loja Shopify ou configuração padrão se não encontrada
 */
export async function getShopifyConfigByInstanceId(instanceId) {
  try {
    // Se não for fornecido instanceId, retorna a configuração padrão (loja1)
    if (!instanceId) {
      console.warn('instanceId não fornecido, usando loja padrão');
      return {
        shopDomain: config.shopify.loja1.shopDomain,
        accessToken: config.shopify.loja1.accessToken,
        shopKey: 'loja1',
        name: 'Loja Padrão'
      };
    }

    // Procura o mapeamento no banco de dados
    const shopInstance = await prisma.shopInstances.findUnique({
      where: { instanceId }
    });

    // Se encontrado, retorna a configuração correspondente
    if (shopInstance) {
      const { shopKey, name } = shopInstance;
      
      // Verifica se a chave existe nas configurações
      if (config.shopify[shopKey]) {
        return {
          shopDomain: config.shopify[shopKey].shopDomain,
          accessToken: config.shopify[shopKey].accessToken,
          shopKey,
          name
        };
      }
    }

    // Caso não encontre no banco ou a configuração não exista, usa loja padrão
    console.warn(`Configuração para instanceId ${instanceId} não encontrada, usando loja padrão`);
    return {
      shopDomain: config.shopify.loja1.shopDomain,
      accessToken: config.shopify.loja1.accessToken,
      shopKey: 'loja1',
      name: 'Loja Padrão'
    };
  } catch (error) {
    console.error('Erro ao resolver shopify config:', error);
    // Em caso de erro, retorna a configuração padrão
    return {
      shopDomain: config.shopify.loja1.shopDomain,
      accessToken: config.shopify.loja1.accessToken,
      shopKey: 'loja1',
      name: 'Loja Padrão'
    };
  }
}

/**
 * Registra uma nova associação entre instanceId e loja
 * @param {string} instanceId - ID da instância do ZAPI
 * @param {string} shopKey - Chave da loja no config.js
 * @param {string} name - Nome da loja para exibição
 * @returns {Object} - Objeto shopInstance criado ou atualizado
 */
export async function registerShopInstance(instanceId, shopKey, name) {
  try {
    // Verifica se a chave da loja existe nas configurações
    if (!config.shopify[shopKey]) {
      throw new Error(`Configuração para shopKey ${shopKey} não encontrada`);
    }

    // Tenta encontrar primeiro para verificar se já existe
    const existing = await prisma.shopInstances.findUnique({
      where: { instanceId }
    });

    if (existing) {
      // Atualiza o registro existente
      return await prisma.shopInstances.update({
        where: { instanceId },
        data: { shopKey, name, updatedAt: new Date() }
      });
    } else {
      // Cria um novo registro
      return await prisma.shopInstances.create({
        data: { instanceId, shopKey, name }
      });
    }
  } catch (error) {
    console.error('Erro ao registrar shop instance:', error);
    throw error;
  }
} 