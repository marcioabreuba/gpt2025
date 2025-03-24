import carrinhoAbandonadoService from './carrinhoAbandonadoService.js';
import carrinhoNaoPagoService from './carrinhoNaoPagoService.js';
import logger from '../utils/logger.js';

class CarrinhoService {
  async sincronizarTodos() {
    try {
      logger.info('Iniciando sincronização de todos os carrinhos');

      // Primeiro sincroniza carrinhos abandonados
      logger.info('Iniciando sincronização de carrinhos abandonados');
      const resultadoAbandonados = await carrinhoAbandonadoService.buscarCarrinhosAbandonados();
      
      // Depois sincroniza carrinhos não pagos
      logger.info('Iniciando sincronização de carrinhos não pagos');
      const resultadoNaoPagos = await carrinhoNaoPagoService.buscarCarrinhosNaoPagos();

      // Calcula totais
      const totalAbandonados = resultadoAbandonados.success ? resultadoAbandonados.data.total : 0;
      const totalNaoPagos = resultadoNaoPagos.success ? resultadoNaoPagos.data.total : 0;
      const sucessosAbandonados = resultadoAbandonados.success ? resultadoAbandonados.data.sucessos : 0;
      const sucessosNaoPagos = resultadoNaoPagos.success ? resultadoNaoPagos.data.sucessos : 0;
      const falhasAbandonados = resultadoAbandonados.success ? resultadoAbandonados.data.falhas : 0;
      const falhasNaoPagos = resultadoNaoPagos.success ? resultadoNaoPagos.data.falhas : 0;

      // Log do resultado
      logger.info('Resultado da sincronização:', {
        carrinhosAbandonados: {
          total: totalAbandonados,
          sucessos: sucessosAbandonados,
          falhas: falhasAbandonados
        },
        carrinhosNaoPagos: {
          total: totalNaoPagos,
          sucessos: sucessosNaoPagos,
          falhas: falhasNaoPagos
        }
      });

      return {
        success: true,
        message: 'Sincronização concluída com sucesso',
        data: {
          carrinhosAbandonados: {
            total: totalAbandonados,
            sucessos: sucessosAbandonados,
            falhas: falhasAbandonados,
            carrinhos: resultadoAbandonados.success ? resultadoAbandonados.data.carrinhos : []
          },
          carrinhosNaoPagos: {
            total: totalNaoPagos,
            sucessos: sucessosNaoPagos,
            falhas: falhasNaoPagos,
            carrinhos: resultadoNaoPagos.success ? resultadoNaoPagos.data.carrinhos : []
          },
          total: {
            carrinhos: totalAbandonados + totalNaoPagos,
            sucessos: sucessosAbandonados + sucessosNaoPagos,
            falhas: falhasAbandonados + falhasNaoPagos
          }
        }
      };
    } catch (error) {
      logger.error('Erro na sincronização unificada:', {
        error: error.message,
        stack: error.stack
      });

      return {
        success: false,
        error: error.message,
        details: error.stack
      };
    }
  }
}

export default new CarrinhoService(); 