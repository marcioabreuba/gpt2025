import cron from 'node-cron';
import axios from 'axios';
import logger from '../utils/logger.js';

/**
 * Cronjob para sincronização automática de pedidos do Shopify
 * 
 * Esta implementação é otimizada para o ambiente Render, onde o serviço está hospedado.
 * Executa a cada 12 horas (00:00 e 12:00) e chama o endpoint existente de sincronização
 * sem necessidade de configurações adicionais ou intervenção manual.
 */

// Configuração do ambiente
const PORT = process.env.PORT || 3000;
// No Render, o SERVER_LINK deve ser configurado com a URL completa do serviço
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? (process.env.SERVER_LINK || `https://${process.env.RENDER_SERVICE_NAME || 'seu-servico'}.onrender.com`)
  : `http://localhost:${PORT}`;

// Função para sincronizar pedidos
async function syncOrders() {
  try {
    logger.info('🔄 Iniciando sincronização agendada de pedidos do Shopify...');
    
    // Faz uma requisição para o endpoint existente
    const response = await axios.post(`${BASE_URL}/api/pedidos`, {}, {
      timeout: 300000, // 5 minutos (alguns processos de sincronização podem ser longos)
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CronJob-Shopify-Sync/1.0'
      }
    });
    
    if (response.status === 200) {
      const stats = response.data?.stats || {};
      logger.info('✅ Sincronização agendada concluída com sucesso', {
        total: stats.total || 0,
        success: stats.success || 0,
        skipped: stats.skipped || 0,
        errors: stats.errors || 0
      });
    } else {
      logger.warn(`⚠️ Sincronização agendada retornou status ${response.status}`);
    }
  } catch (error) {
    logger.error('❌ Erro na sincronização agendada de pedidos:', error.message);
    if (error.response) {
      logger.error('Detalhes da resposta:', {
        status: error.response.status,
        data: JSON.stringify(error.response.data).substring(0, 200)
      });
    }
  }
}

// Executa o cronjob apenas em ambiente de produção
if (process.env.NODE_ENV === 'production') {
  // Agenda para executar às 00:00 e 12:00 todos os dias
  // No Render, os cronJobs são executados no fuso horário UTC
  cron.schedule('0 0,12 * * *', () => {
    logger.info('⏰ Executando sincronização agendada de pedidos');
    syncOrders();
  });
  
  logger.info('📅 Cronjob de sincronização de pedidos configurado para executar às 00:00 e 12:00 UTC');
  
  // Executa uma vez ao iniciar o servidor para garantir sincronização recente
  setTimeout(() => {
    logger.info('🚀 Executando sincronização inicial após inicialização do servidor');
    syncOrders();
  }, 60000); // Espera 1 minuto após a inicialização para garantir que tudo esteja pronto
} else {
  logger.info('ℹ️ Cronjob de sincronização de pedidos não ativado em ambiente de desenvolvimento');
}

// Exporta a função para uso em outros módulos se necessário
export { syncOrders }; 