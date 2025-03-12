import { sendReplyZAPI } from './zapiService.js';
import redisClient from '../redisClient.js';
import moment from 'moment-timezone';
import config from '../config.js';
import { storeMessageInConversation, addMessageWithRetry } from './openaiService.js';

// Mapa para controlar quais usuários têm o assistente pausado
// Agora armazena {phone: {paused: true, lastChatLid: 'id'}}
const pausedAssistants = new Map();

/**
 * Verifica se um número está com o assistente pausado
 * @param {string} phone - Número de telefone do usuário
 * @returns {boolean} - True se o assistente estiver pausado para este número
 */
export function isAssistantPaused(phone) {
  return pausedAssistants.has(phone) && pausedAssistants.get(phone).paused === true;
}

/**
 * Mapeia um chatLid para um número de telefone quando o assistente é pausado
 * @param {string} phone - Número de telefone 
 * @param {string} chatLid - ID do chat
 */
export function storeChatLidForPhone(phone, chatLid) {
  if (pausedAssistants.has(phone)) {
    const data = pausedAssistants.get(phone);
    data.lastChatLid = chatLid;
    pausedAssistants.set(phone, data);
  }
}

/**
 * Processa comandos enviados pelo próprio número da IA
 * @param {string} phone - Número de telefone do usuário
 * @param {string} message - Mensagem enviada pelo número da IA
 * @param {string|null} chatLid - ID do chat associado ao telefone (pode ser null)
 * @returns {Object} - Resultado do processamento do comando
 */
export async function handleAssistantCommand(phone, message, chatLid = null) {
  const lowerMessage = message.toLowerCase();
  
  // Comando para pausar o assistente (Helena passa a responder)
  if (lowerMessage.includes('aqui é helena')) {
    pausedAssistants.set(phone, { paused: true, lastChatLid: chatLid });
    console.log(`Assistente pausado para ${phone} (comando enviado pela própria IA)`);
    if (chatLid) {
      console.log(`ChatLid ${chatLid} associado ao telefone ${phone}`);
    }
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
    // Tenta encontrar o userId (chatLid) associado a este número na thread
    try {
      // Busca o chatLid armazenado para este número
      const phoneData = pausedAssistants.get(phone);
      let userChatLid = phoneData.lastChatLid;
      
      // Se temos um chatLid passado como parâmetro e não temos um armazenado, usamos o passado
      if (!userChatLid && chatLid) {
        userChatLid = chatLid;
        // Atualiza o registro para uso futuro
        phoneData.lastChatLid = chatLid;
        pausedAssistants.set(phone, phoneData);
        console.log(`Atualizado chatLid para ${phone}: ${chatLid}`);
      }
      
      if (!userChatLid) {
        console.log(`Não há chatLid associado ao telefone ${phone}. Procurando thread diretamente...`);
        
        // Se não temos o chatLid, tentamos buscar o thread pelo telefone (última alternativa)
        const threadId = await redisClient.get(`threadId:${phone}`);
        
        if (threadId) {
          // Armazena a mensagem usando o telefone como userId (menos ideal)
          await storeManualResponse(phone, threadId, message);
          return { handled: true, status: "operator_response_stored_by_phone" };
        } else {
          // Busca em todas as chaves do Redis que começam com threadId:
          const keys = await redisClient.keys('threadId:*');
          console.log(`Procurando thread em ${keys.length} chaves Redis...`);
          
          // Busca no armazenamento de conversas qualquer referência a este número
          let threadFound = false;
          
          for (const key of keys) {
            const threadId = await redisClient.get(key);
            if (threadId) {
              // Verifica se há conversas armazenadas com este número
              const convKey = `conversation:${key.replace('threadId:', '')}:${threadId}`;
              const convData = await redisClient.lRange(convKey, 0, -1);
              
              // Procura por menções ao número de telefone nas mensagens
              for (const msgData of convData) {
                try {
                  const msg = JSON.parse(msgData);
                  if (msg.content && msg.content.includes(`[Phone: ${phone}]`)) {
                    // Encontramos uma thread que menciona este número!
                    console.log(`Encontrada thread ${threadId} que menciona ${phone}`);
                    const userId = key.replace('threadId:', '');
                    
                    // Armazena para uso futuro
                    if (pausedAssistants.has(phone)) {
                      const data = pausedAssistants.get(phone);
                      data.lastChatLid = userId;
                      pausedAssistants.set(phone, data);
                    }
                    
                    await storeManualResponse(userId, threadId, message);
                    threadFound = true;
                    break;
                  }
                } catch (e) {
                  // Ignora erros de parsing
                  console.error(`Erro ao parsear mensagem: ${e.message}`);
                }
              }
              
              if (threadFound) break;
            }
          }
          
          if (!threadFound) {
            console.log(`Nenhuma thread encontrada para ${phone}. Não foi possível armazenar resposta manual.`);
          } else {
            return { handled: true, status: "operator_response_stored_by_search" };
          }
        }
      } else {
        // Temos o chatLid, usamos ele para buscar a thread
        const threadId = await redisClient.get(`threadId:${userChatLid}`);
        
        if (threadId) {
          await storeManualResponse(userChatLid, threadId, message);
          return { handled: true, status: "operator_response_stored" };
        } else {
          console.log(`Thread não encontrada para chatLid ${userChatLid}.`);
        }
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

// Função auxiliar para armazenar respostas manuais
async function storeManualResponse(userId, threadId, message) {
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
} 