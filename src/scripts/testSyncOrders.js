import 'dotenv/config';
import { syncOrders } from '../services/cronjobOrders.js';
import logger from '../utils/logger.js';

/**
 * Script para testar a sincronização de pedidos manualmente
 * Executa a função syncOrders() e exibe os resultados
 */

async function runTest() {
  logger.info('🧪 Iniciando teste de sincronização de pedidos');
  
  try {
    // Executa a sincronização
    await syncOrders();
    
    logger.info('✅ Teste concluído');
  } catch (error) {
    logger.error('❌ Erro no teste de sincronização:', error);
  }
}

// Executa o teste
runTest()
  .then(() => {
    logger.info('📋 Teste finalizado, verificando logs acima para resultados');
    // Mantém o script em execução por alguns segundos para garantir que todos os logs sejam exibidos
    setTimeout(() => process.exit(0), 2000);
  })
  .catch(error => {
    logger.error('🚨 Falha ao executar o teste:', error);
    process.exit(1);
  }); 