// services/prismaOrdersService.js
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const cleanNumber = (value) => value ? value.replace(/\D/g, '') : '';

export async function findOrderByUser(phone, externalId, cpf) {
  try {
    const cleanPhone = cleanNumber(phone);
    const cleanCpf = cleanNumber(cpf);
    const cleanExternalId = externalId ? externalId.toString().replace(/\D/g, '') : '';

    const whereClause = {
      OR: [
        ...(cleanPhone ? [{ phone: { contains: cleanPhone } }] : []),
        ...(cleanExternalId ? [{ externalId: cleanExternalId }] : []),
        ...(cleanCpf ? [{ cpf: cleanCpf }] : [])
      ]
    };

    if (!whereClause.OR.length) return null;

    return await prisma.orders.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        orderId: true,
        externalId: true,
        cpf: true,
        phone: true,
        createdAt: true
      }
    });
  } catch (error) {
    console.error('Erro no Prisma:', error);
    throw new Error('Erro ao buscar pedido');
  } finally {
    await prisma.$disconnect();
  }
}