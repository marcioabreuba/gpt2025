import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export const updateQueueTraining = async () => {
  try {
    await prisma.queueTraining.updateMany({
      data: {
        status: false,
      },
    });
  } catch (error) {
    throw new Error("");
  }
};