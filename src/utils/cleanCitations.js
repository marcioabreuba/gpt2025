/**
 * Utilitário para remover citações do vector store das respostas
 * Remove citações no formato 【X:Y†source】
 */

/**
 * Remove citações das respostas do assistente
 * @param {string} text - O texto da resposta que pode conter citações
 * @returns {string} - O texto limpo sem as citações
 */
export function cleanCitations(text) {
  if (!text) return text;
  
  // Remove qualquer coisa no formato 【X:Y†source】
  return text.replace(/【\d+:\d+†source】/g, '');
}

export default cleanCitations; 