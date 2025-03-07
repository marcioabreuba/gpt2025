// Serviço para enviar mensagens via Z-API (por exemplo, para WhatsApp)

import axios from 'axios';
import config from '../config.js';
import winston from 'winston';

// Configure o logger se não estiver usando o logger global
const logger = winston.createLogger({
  level: config.loggerLevel || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) =>
        `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
    )
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Envia uma mensagem para um número de telefone utilizando a Z-API.
 * @param {string} phone - Número de telefone de destino.
 * @param {string} message - Conteúdo da mensagem.
 */
export async function sendReplyZAPI(phone, message) {
  try {
    // Log detalhado do início da operação
    logger.system(`Iniciando envio de mensagem para ${phone}`, {
      phone,
      messageLength: message.length,
      timestamp: new Date().toISOString()
    });
    
    // Registra a mensagem nos logs de conversação
    logger.iaMessage(phone, message);
    
    // Log para debug
    logger.debug(`Preparando requisição Z-API para ${phone}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
    
    // Constrói a URL e o payload
    const url = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}/send-text`;
    const payload = { phone, message, delayTyping: 15 };
    
    // Faz a requisição
    logger.debug(`Enviando requisição POST para Z-API: ${url}`);
    const response = await axios.post(url, payload, {
      headers: { "Client-Token": config.zapi.clientToken }
    });
    
    // Log de sucesso com dados da resposta
    logger.info(`Resposta enviada via Z-API:`, response.data);
    
    // Log detalhado do sucesso da operação
    logger.system(`Mensagem enviada com sucesso para ${phone}`, {
      phone,
      messageId: response.data?.messageId || 'N/A',
      zaapId: response.data?.zaapId || 'N/A',
      status: 'sucesso',
      timestamp: new Date().toISOString()
    });
    
    return { success: true, data: response.data };
  } catch (error) {
    // Extrai detalhes do erro
    const errMsg = error.response?.data || error.message;
    const statusCode = error.response?.status || 'N/A';
    
    // Log de erro
    logger.error(`Falha ao enviar mensagem para ${phone}`, { 
      error: errMsg,
      statusCode,
      stack: error.stack
    });
    
    // Log detalhado do erro
    logger.system(`Falha no envio de mensagem para ${phone}`, {
      phone,
      error: errMsg,
      statusCode,
      stack: error.stack,
      status: 'erro',
      timestamp: new Date().toISOString()
    });
    
    return { success: false, error: errMsg };
  }
}

/**
 * Envia uma mensagem de confirmação de recebimento de áudio.
 * @param {string} phone - Número de telefone de destino.
 */
export async function sendAudioReceiptConfirmation(phone) {
  try {
    const message = "🎧 Recebi seu áudio e estou processando...";
    logger.info(`IA → ${phone}: "${message}"`);
    
    const url = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}/send-text`;
    const payload = { phone, message };
    await axios.post(url, payload, {
      headers: { "Client-Token": config.zapi.clientToken }
    });
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error("Erro ao enviar confirmação de áudio:", errMsg);
  }
}
