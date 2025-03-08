/**
 * Utilitários para manipulação de texto
 */

/**
 * Remove citações e referências a fontes das mensagens da OpenAI.
 * @param {string} message - Mensagem original com possíveis citações.
 * @returns {string} - Mensagem limpa sem as citações.
 */
export function removeCitations(message) {
  if (!message) return message;
  
  // Padrão 1: Remove citações no formato 【n:n†source】
  let cleanedMessage = message.replace(/【\d+:\d+†source】/g, '');
  
  // Padrão 2: Remove citações no formato 【n†source】
  cleanedMessage = cleanedMessage.replace(/【\d+†source】/g, '');
  
  // Padrão 3: Remove citações no formato [n]
  cleanedMessage = cleanedMessage.replace(/\[\d+\]/g, '');
  
  // Padrão 4: Remove citações no formato (Citation: n)
  cleanedMessage = cleanedMessage.replace(/\(Citation: \d+\)/g, '');
  
  // Padrão 5: Remove citações no formato {"citation": [{"type": "document", "document_id": "abc123", "quote": "texto"}]}
  cleanedMessage = cleanedMessage.replace(/\{"citation":.*?\}/g, '');
  
  // Remove espaços extras que podem ter ficado após a remoção
  cleanedMessage = cleanedMessage.replace(/\s{2,}/g, ' ').trim();
  
  return cleanedMessage;
}

/**
 * Formata uma mensagem para exibição no WhatsApp.
 * @param {string} message - Mensagem a ser formatada.
 * @returns {string} - Mensagem formatada.
 */
export function formatWhatsAppMessage(message) {
  if (!message) return message;
  
  // Remove citações
  let formattedMessage = removeCitations(message);
  
  // Converte destaque duplo para simples (** -> *)
  formattedMessage = formattedMessage.replace(/\*\*/g, '*');
  
  // Remove marcadores específicos do sistema
  formattedMessage = formattedMessage.replace(/\[links protegidos\]/g, '');
  
  return formattedMessage;
} 