import { sendReplyZAPI } from './zapiService.js';

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
  
  // Nenhum comando reconhecido
  return { 
    handled: false 
  };
} 