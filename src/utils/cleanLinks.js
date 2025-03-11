/**
 * Utilitário para corrigir links nas respostas de acordo com regras específicas:
 * - NUNCA usar formatação markdown para links [texto](url)
 * - NUNCA usar www. no início dos links
 * - NUNCA usar https:// nos links
 * - SEMPRE colocar "Link:" antes do endereço
 * - NUNCA incluir links para sites externos (correios, transportadoras, etc.)
 * - NUNCA enviar links com placeholders (CÓDIGO_RASTREIO, NOME_PRODUTO, etc.)
 */

/**
 * Corrige os links na mensagem de acordo com as regras estabelecidas
 * @param {string} text - O texto da resposta que pode conter links
 * @returns {string} - O texto com links corrigidos
 */
export function cleanLinks(text) {
  if (!text) return text;
  
  // Etapa 1: Limpar links em formato markdown [texto](url)
  let result = text.replace(/\[([^\]]+)\]\((https?:\/\/)?(?:www\.)?([^)]+)\)/g, (match, linkText, protocol, url) => {
    // Se for link da tropicalize, mantém o texto e adiciona o link formatado corretamente
    if (url.includes('tropicalize.com.br')) {
      const cleanUrl = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      return `${linkText}\nLink: ${cleanUrl}`;
    }
    // Se não for link da tropicalize, mantém só o texto
    return linkText;
  });
  
  // Etapa 2: Limpar URLs diretas (https://...)
  const urlRegex = /(https?:\/\/)?(?:www\.)?([^\s]+\.[^\s]+)/gi;
  let urlMatches = [];
  let match;
  
  // Coletar todos os matches para processamento posterior
  while ((match = urlRegex.exec(result)) !== null) {
    const fullMatch = match[0];
    const url = match[2];
    const startIndex = match.index;
    const endIndex = startIndex + fullMatch.length;
    
    // Verificar se já é parte de um "Link:" (até 6 caracteres antes)
    const prefix = result.substring(Math.max(0, startIndex - 6), startIndex);
    const isAlreadyLink = prefix.includes('Link:');
    
    urlMatches.push({
      fullMatch,
      url,
      startIndex,
      endIndex,
      isAlreadyLink,
      isTropicalize: url.includes('tropicalize.com.br')
    });
  }
  
  // Processar as URLs de trás para frente para não alterar os índices
  urlMatches.reverse().forEach(item => {
    // Pular se já for parte de um Link:
    if (item.isAlreadyLink) return;
    
    if (item.isTropicalize) {
      // Se for link da tropicalize, formata corretamente
      const cleanUrl = item.url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      result = result.substring(0, item.startIndex) + 
               `Link: ${cleanUrl}` + 
               result.substring(item.endIndex);
    } else {
      // Se não for link da tropicalize, remove o protocolo e www
      const plainUrl = item.url;
      result = result.substring(0, item.startIndex) + 
               plainUrl + 
               result.substring(item.endIndex);
    }
  });
  
  // Etapa 3: Remover links com placeholders
  result = result.replace(/Link:\s+[^\s]*(CÓDIGO_RASTREIO|NOME_PRODUTO|%[^%\s]+%)[^\s]*/gi, '');
  
  // Etapa 4: Verificar e corrigir duplicações de "Link:"
  result = result.replace(/Link:\s+Link:/gi, 'Link:');
  
  return result;
}

export default cleanLinks; 