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
 * Remove citações de fontes das mensagens da OpenAI.
 * @param {string} message - Mensagem original com possíveis citações.
 * @returns {string} - Mensagem limpa sem as citações.
 */
function removeCitations(message) {
  if (!message) return message;
  
  // Padrão 1: Remove citações no formato 【n:n†source】
  let cleanedMessage = message.replace(/【\d+:\d+†source】/g, '');
  
  // Padrão 2: Remove citações no formato 【n†source】
  cleanedMessage = cleanedMessage.replace(/【\d+†source】/g, '');
  
  // Padrão 3: Remove citações no formato [n]
  cleanedMessage = cleanedMessage.replace(/\[\d+\]/g, '');
  
  // Padrão 4: Remove citações no formato (Citation: n)
  cleanedMessage = cleanedMessage.replace(/\(Citation: \d+\)/g, '');
  
  // Remove espaços extras que podem ter ficado após a remoção
  cleanedMessage = cleanedMessage.replace(/\s{2,}/g, ' ').trim();
  
  return cleanedMessage;
}

/**
 * Envia uma mensagem para um número de telefone utilizando a Z-API.
 * @param {string} phone - Número de telefone de destino.
 * @param {string} message - Conteúdo da mensagem.
 */
export async function sendReplyZAPI(phone, message) {
  try {
    // Remove citações de fontes antes de enviar
    const cleanedMessage = removeCitations(message);
    
    // Registra a mensagem limpa nos logs
    logger.info(`IA → ${phone}: ${cleanedMessage}`);
    
    const url = `https://api.z-api.io/instances/${config.zapi.instanceId}/token/${config.zapi.token}/send-text`;
    const payload = { phone, message: cleanedMessage, delayTyping: 15 };
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
