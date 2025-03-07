// services/prismaOrdersService.js
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const cleanNumber = (value) => value ? value.replace(/\D/g, '') : '';

export async function findOrderByUser(phone, orderNumber, cpf) {
  try {
    const cleanPhone = cleanNumber(phone);
    const cleanOrderNumber = orderNumber ? orderNumber.toString().replace(/\D/g, '') : '';
    
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
    if (cpf && !order) {
      order = await prisma.orders.findFirst({
        where: { 
          cpf: cpf
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