import { sendReplyZAPI } from './zapiService.js';
import redisClient from '../redisClient.js';
import moment from 'moment-timezone';
import config from '../config.js';
import { storeMessageInConversation, addMessageWithRetry } from './openaiService.js';

// Mapa para controlar quais usuários têm o assistente pausado
const pausedAssistants = new Map();

/**
 * Verifica se um número está com o assistente pausado
 * @param {string} phone - Número de telefone do usuário
 * @returns {boolean} - True se o assistente estiver pausado para este número
 */
export function isAssistantPaused(phone) {
  return pausedAssistants.has(phone);
}

/**
 * Processa comandos enviados pelo próprio número da IA
 * @param {string} phone - Número de telefone do usuário
 * @param {string} message - Mensagem enviada pelo número da IA
 * @returns {Object} - Resultado do processamento do comando
 */
export async function handleAssistantCommand(phone, message) {
  const lowerMessage = message.toLowerCase();
  
  // Comando para pausar o assistente (Helena passa a responder)
  if (lowerMessage.includes('aqui é helena')) {
    pausedAssistants.set(phone, true);
    console.log(`Assistente pausado para ${phone} (comando enviado pela própria IA)`);
    return { 
      handled: true, 
      status: "assistant_paused" 
    };
  }
  
  // Comando para retomar o assistente (Sofia volta a responder)
  if (lowerMessage.includes('vou passar pra sofia')) {
    pausedAssistants.delete(phone);
    console.log(`Assistente reativado para ${phone} (comando enviado pela própria IA)`);
    return { 
      handled: true, 
      status: "assistant_resumed" 
    };
  }
  
  // Se o assistente estiver pausado e não for um dos comandos acima,
  // significa que é uma resposta manual (Helena) que deve ser armazenada na thread
  if (isAssistantPaused(phone)) {
    // Tenta encontrar o userId associado a este número na thread
    try {
      // Para o caso onde o chatId/userId é o próprio telefone (prática comum)
      const userId = phone;
      const threadId = await redisClient.get(`threadId:${userId}`);
      
      if (threadId) {
        const currentDate = moment().tz(config.timezone).format('DD/MM/YYYY');
        const formattedMessage = `[Resposta manual (Helena)]: ${message} [Data: ${currentDate}]`;
        
        // Armazena mensagem na conversa
        await storeMessageInConversation(userId, threadId, {
          role: 'assistant',
          content: formattedMessage,
          timestamp: Date.now()
        });
        
        // Adiciona mensagem ao thread
        await addMessageWithRetry(threadId, formattedMessage, 'assistant');
        
        console.log(`Resposta manual de Helena armazenada na thread ${threadId} para o usuário ${userId}`);
        
        return {
          handled: true,
          status: "operator_response_stored"
        };
      } else {
        console.log(`Nenhuma thread encontrada para ${phone}. Não foi possível armazenar resposta manual.`);
      }
    } catch (error) {
      console.error(`Erro ao armazenar resposta manual para ${phone}:`, error);
    }
    
    // Mesmo se falhar em armazenar, consideramos tratado para não processar mais
    return {
      handled: true,
      status: "assistant_paused_message"
    };
  }
  
  // Nenhum comando reconhecido
  return { 
    handled: false 
  };
} 