import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndCreateTables() {
  try {
    // Verifica se a tabela orders existe
    await prisma.$queryRaw`SELECT 1 FROM orders LIMIT 1`;
    console.log('✅ Tabela orders existe');
  } catch (error) {
    if (error.code === 'P2021') {
      console.log('⚠️ Criando tabela orders...');
      await prisma.$executeRaw`
        CREATE TABLE orders (
          id SERIAL PRIMARY KEY,
          order_id TEXT UNIQUE NOT NULL,
          status TEXT NOT NULL,
          status_description TEXT,
          origin TEXT NOT NULL,
          external_id TEXT,
          value TEXT NOT NULL,
          discount TEXT,
          currency TEXT,
          link_status TEXT,
          form_payment TEXT,
          form_send TEXT,
          date_purchase TEXT,
          forecast INTEGER DEFAULT 0,
          coupon JSONB,
          address JSONB,
          items JSONB NOT NULL,
          recovery JSONB,
          tracking JSONB,
          shopify_id JSONB,
          yampi_id JSONB DEFAULT '{}'::JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          customer_name TEXT,
          customer_email TEXT,
          customer_phone TEXT,
          tracking_code TEXT,
          tracking_status TEXT,
          tracking_updated_at TIMESTAMP
        );
      `;
      console.log('✅ Tabela orders criada');
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

export { checkAndCreateTables };