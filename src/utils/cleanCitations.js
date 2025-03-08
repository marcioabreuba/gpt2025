/**
 * Utilitário para remover citações do vector store das respostas e limpar logs
 * - Remove citações no formato 【X:Y†source】
 * - Limpa logs e informações técnicas
 * - Ajusta formatação de negrito
 */

/**
 * Remove citações das respostas do assistente e limpa logs
 * @param {string} text - O texto da resposta que pode conter citações e logs
 * @returns {string} - O texto limpo sem citações ou logs
 */
export function cleanCitations(text) {
  if (!text) return text;
  
  // Remove qualquer coisa no formato 【X:Y†source】
  let cleanedText = text.replace(/【\d+:\d+†source】/g, '');
  
  // Extrair apenas o conteúdo da mensagem (o que vem após "IA → [número]:")
  const messagePattern = /IA → \d+:\s*([\s\S]+?)(?=\d{4}-\d{2}-\d{2}|$)/;
  const messageMatch = cleanedText.match(messagePattern);
  
  if (messageMatch) {
    cleanedText = messageMatch[1];
  } else {
    // Se não encontrou o padrão específico, tente extrair apenas o conteúdo principal
    // removendo todas as linhas de log (começando com data/hora ou "info")
    cleanedText = cleanedText.split('\n')
      .filter(line => !line.match(/^Mar \d+ \d+:\d+:\d+ PM(info)?/) && 
                     !line.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) &&
                     !line.match(/^info$/i))
      .join('\n');
  }
  
  // Remover mensagens de sistema como "Resposta enviada via Z-API"
  cleanedText = cleanedText.replace(/Resposta enviada via Z-API:[\s\S]*?}/g, '');
  
  // Substituir negrito com dois asteriscos (**) por negrito com um asterisco (*)
  cleanedText = cleanedText.replace(/\*\*/g, '*');
  
  // Limpar linhas vazias extras e espaços
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim();
  
  return cleanedText;
}

export default cleanCitations; 