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
    // Registra a mensagem nos logs
    logger.info(`IA → ${phone}: ${message}`);
    
    const url = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}/send-text`;
    const payload = { phone, message };
    const response = await axios.post(url, payload, {
      headers: { "Client-Token": config.zapi.clientToken }
    });
    console.log("Resposta enviada via Z-API:", response.data);
  } catch (error) {
    const errMsg = error.response?.data || error.message;
    console.error("Erro ao enviar mensagem via Z-API:", errMsg);
    logger.error(`Falha ao enviar mensagem para ${phone}`, { error: errMsg });
  }
}
