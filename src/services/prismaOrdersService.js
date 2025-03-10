// services/prismaOrdersService.js
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const cleanNumber = (value) => value ? value.replace(/\D/g, '') : '';

/**
 * Verifica se um valor é mais provavelmente um número de pedido ou um CPF
 * @param {string} value - O valor a ser verificado
 * @returns {object} - Objeto indicando o tipo mais provável e o valor limpo
 */
const identifyNumberType = (value) => {
  if (!value) return { type: null, value: null };
  
  const cleanValue = value.toString().replace(/\D/g, '');
  
  // Se é um número muito curto (menos de 5 dígitos), provavelmente é um número de pedido
  if (cleanValue.length <= 6) {
    return { type: 'order', value: cleanValue };
  }
  
  // Se tem 11 dígitos, é mais provável que seja um CPF
  if (cleanValue.length === 11) {
    return { type: 'cpf', value: cleanValue };
  }
  
  // Para outros casos, vamos considerar como número de pedido
  return { type: 'order', value: cleanValue };
};

export async function findOrderByUser(phone, orderNumber, cpf) {
  try {
    const cleanPhone = cleanNumber(phone);
    let cleanOrderNumber = null;
    let cleanCpf = null;
    
    // Verifica se o orderNumber fornecido é realmente um número de pedido ou CPF
    if (orderNumber) {
      const identified = identifyNumberType(orderNumber);
      if (identified.type === 'order') {
        cleanOrderNumber = identified.value;
      } else if (identified.type === 'cpf' && !cpf) {
        cleanCpf = identified.value;
        console.log(`Valor '${orderNumber}' parece ser um CPF. Tratando como CPF.`);
      }
    }
    
    // Verifica se o CPF fornecido é realmente um CPF ou número de pedido
    if (cpf) {
      const identified = identifyNumberType(cpf);
      if (identified.type === 'cpf') {
        cleanCpf = identified.value;
      } else if (identified.type === 'order' && !cleanOrderNumber) {
        cleanOrderNumber = identified.value;
        console.log(`Valor '${cpf}' parece ser um número de pedido. Tratando como número de pedido.`);
      }
    }
    
    let order = null;
    
    // 1. Primeira prioridade: buscar por telefone
    if (cleanPhone) {
      order = await prisma.orders.findFirst({
        where: { 
          phone: { contains: cleanPhone } 
        },
        orderBy: { createdAt: 'desc' },
        select: {
          orderId: true,
          externalId: true,
          cpf: true,
          phone: true,
          createdAt: true
        }
      });
      
      if (order) {
        console.log('Pedido encontrado pelo número de telefone:', order.externalId);
        return order;
      }
    }
    
    // 2. Segunda prioridade: buscar por número do pedido
    if (cleanOrderNumber && !order) {
      order = await prisma.orders.findFirst({
        where: { 
          externalId: cleanOrderNumber 
        },
        orderBy: { createdAt: 'desc' },
        select: {
          orderId: true,
          externalId: true,
          cpf: true,
          phone: true,
          createdAt: true
        }
      });
      
      if (order) {
        console.log('Pedido encontrado pelo número do pedido:', order.externalId);
        return order;
      }
    }
    
    // 3. Terceira prioridade: buscar por CPF
    if (cleanCpf && !order) {
      order = await prisma.orders.findFirst({
        where: { 
          cpf: cleanCpf
        },
        orderBy: { createdAt: 'desc' },
        select: {
          orderId: true,
          externalId: true,
          cpf: true,
          phone: true,
          createdAt: true
        }
      });
      
      if (order) {
        console.log('Pedido encontrado pelo CPF:', order.externalId);
      }
    }
    
    return order;
  } catch (error) {
    console.error('Erro no Prisma:', error);
    throw new Error('Erro ao buscar pedido');
  } finally {
    await prisma.$disconnect();
  }
}