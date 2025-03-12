import redisClient from '../redisClient.js';
import { sendReplyZAPI } from './zapiService.js';
import { storeMessageInConversation } from './openaiService.js';
import logger from '../utils/logger.js';

// Chaves Redis para controle de handoff
const HUMAN_MODE_KEY_PREFIX = 'human_mode:';
const TRAINING_DATA_KEY_PREFIX = 'training_priority:';

/**
 * Verifica se um determinado usuário/telefone está no modo de atendimento humano.
 * @param {string} phone - Número de telefone do usuário.
 * @returns {Promise<boolean>} - true se estiver no modo humano, false caso contrário.
 */
export async function isInHumanMode(phone) {
  try {
    const key = `${HUMAN_MODE_KEY_PREFIX}${phone}`;
    const result = await redisClient.get(key);
    
    console.log(`[DEBUG] Verificando modo humano para ${phone}, chave Redis: ${key}, resultado: ${result}`);
    
    return result === 'true';
  } catch (error) {
    logger.error(`Erro ao verificar modo humano para ${phone}:`, error);
    return false;
  }
}

/**
 * Ativa o modo de atendimento humano para um determinado telefone.
 * @param {string} phone - Número de telefone do usuário.
 * @param {string} threadId - ID do thread de conversa.
 * @returns {Promise<boolean>} - true se a operação foi bem-sucedida.
 */
export async function enableHumanMode(phone, threadId) {
  try {
    await redisClient.set(`${HUMAN_MODE_KEY_PREFIX}${phone}`, 'true');
    
    // Registra no histórico que o atendimento passou para o modo humano
    logger.info(`Atendimento passou para o modo humano (Helena) para ${phone}`);
    
    // Adiciona a conversa atual à lista de prioridade para treinamento
    await redisClient.set(`${TRAINING_DATA_KEY_PREFIX}${threadId}`, 'true');
    
    return true;
  } catch (error) {
    logger.error(`Erro ao ativar modo humano para ${phone}:`, error);
    return false;
  }
}

/**
 * Desativa o modo de atendimento humano para um determinado telefone.
 * @param {string} phone - Número de telefone do usuário.
 * @returns {Promise<boolean>} - true se a operação foi bem-sucedida.
 */
export async function disableHumanMode(phone) {
  try {
    await redisClient.del(`${HUMAN_MODE_KEY_PREFIX}${phone}`);
    
    // Registra no histórico que o atendimento voltou para o modo IA
    logger.info(`Atendimento voltou para o modo IA (Sofia) para ${phone}`);
    
    return true;
  } catch (error) {
    logger.error(`Erro ao desativar modo humano para ${phone}:`, error);
    return false;
  }
}

/**
 * Processa as mensagens de comando para alternar entre atendimento humano e IA.
 * @param {string} message - Mensagem recebida.
 * @param {string} phone - Número de telefone do usuário.
 * @param {string} threadId - ID do thread de conversa.
 * @returns {Promise<boolean>} - true se era um comando de handoff, false caso contrário.
 */
export async function processHandoffCommand(message, phone, threadId) {
  if (!message) return false;
  
  // Normaliza removendo acentos, espaços extras e convertendo para minúsculas
  const normalizedMessage = message.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  console.log(`[DEBUG] Processando comando: "${message}" -> normalizado: "${normalizedMessage}" (phone: ${phone})`);
  
  // Comando para ativar o modo humano - mais flexível com várias opções
  if (
    normalizedMessage === 'ola aqui e a helena' || 
    normalizedMessage === 'olá aqui é a helena' ||
    normalizedMessage.includes('aqui e a helena') ||
    normalizedMessage.includes('aqui é a helena') ||
    normalizedMessage.includes('helena assumindo')
  ) {
    console.log(`[DEBUG] Comando de ativação do modo humano detectado para ${phone}`);
    await enableHumanMode(phone, threadId);
    // Adicionamos confirmação apenas nos logs, não para o usuário
    console.log(`[SUCESSO] Modo humano ATIVADO para ${phone}`);
    return true;
  }
  
  // Comando para desativar o modo humano - mais flexível com várias opções
  if (
    normalizedMessage === 'vou passar pra sofia' ||
    normalizedMessage === 'vou passar para sofia' ||
    normalizedMessage === 'passando para sofia' ||
    normalizedMessage.includes('volta para sofia') ||
    normalizedMessage.includes('volta pra sofia') ||
    normalizedMessage.includes('desativar modo humano')
  ) {
    console.log(`[DEBUG] Comando de desativação do modo humano detectado para ${phone}`);
    await disableHumanMode(phone);
    // Adicionamos confirmação apenas nos logs, não para o usuário
    console.log(`[SUCESSO] Modo humano DESATIVADO para ${phone}`);
    return true;
  }
  
  return false;
}

/**
 * Envia uma mensagem humana diretamente, sem processamento pela IA.
 * @param {string} userId - ID do usuário.
 * @param {string} phone - Número de telefone do usuário.
 * @param {string} message - Mensagem a ser enviada.
 * @param {string} threadId - ID do thread da conversa.
 * @returns {Promise<object>} - Status da operação.
 */
export async function sendHumanMessage(userId, phone, message, threadId) {
  try {
    // Envia a mensagem diretamente via Z-API (sem processamento pela IA)
    await sendReplyZAPI(phone, message);
    
    // Guarda a mensagem na thread para manter o histórico completo
    if (threadId) {
      await storeMessageInConversation(userId, threadId, { 
        role: 'assistant',  // Usamos 'assistant' para manter consistência com mensagens da IA
        content: message,
        timestamp: Date.now(),
        isHuman: true  // Marcador para identificar que é uma mensagem de operador humano
      });
      
      logger.info(`Mensagem humana (Helena) armazenada no histórico para ${phone}`);
    }
    
    return { status: 'human_message_sent' };
  } catch (error) {
    logger.error(`Erro ao enviar mensagem humana para ${phone}:`, error);
    throw error;
  }
} 