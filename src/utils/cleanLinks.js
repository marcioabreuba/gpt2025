/**
 * Utilitário para corrigir links nas respostas de acordo com regras específicas:
 * - NUNCA usar formatação markdown para links [texto](url)
 * - NUNCA usar www. no início dos links
 * - NUNCA usar https:// nos links
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
  
  // Etapa 0: Remover links com placeholders primeiro
  let result = text.replace(/(Link:\s+)?[^\s]*(CÓDIGO_RASTREIO|NOME_PRODUTO|%[^%\s]+%)[^\s]*/gi, '');
  
  // Etapa 1: Limpar links em formato markdown [texto](url)
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/)?(?:www\.)?([^)]+)\)/g, (match, linkText, protocol, url) => {
    // Se for link da tropicalize, mantém o texto e adiciona o link formatado corretamente
    if (url.includes('tropicalize.com.br')) {
      const cleanUrl = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      return `${linkText}\n${cleanUrl}`;
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
    
    // Verificar se já é parte de um "Link:" antes do URL
    const prefix = result.substring(Math.max(0, startIndex - 6), startIndex);
    const isAlreadyLink = prefix.trim().endsWith('Link:');
    
    // Verificar se contém placeholders (já deve ter sido tratado na etapa 0, mas por segurança)
    const hasPlaceholder = url.match(/(CÓDIGO_RASTREIO|NOME_PRODUTO|%[^%\s]+%)/i);
    
    if (!hasPlaceholder) {
      urlMatches.push({
        fullMatch,
        url,
        startIndex,
        endIndex,
        isAlreadyLink,
        isTropicalize: url.includes('tropicalize.com.br')
      });
    }
  }
  
  // Processar as URLs de trás para frente para não alterar os índices
  urlMatches.reverse().forEach(item => {
    // Se já tiver "Link:" antes, vamos removê-lo
    let adjustedStartIndex = item.startIndex;
    if (item.isAlreadyLink) {
      // Encontrar onde começa o "Link:"
      const beforeUrl = result.substring(Math.max(0, item.startIndex - 20), item.startIndex);
      const linkIndex = beforeUrl.lastIndexOf('Link:');
      if (linkIndex !== -1) {
        adjustedStartIndex = item.startIndex - (beforeUrl.length - linkIndex);
      }
    }
    
    if (item.isTropicalize) {
      // Se for link da tropicalize, formata corretamente
      const cleanUrl = item.url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
      result = result.substring(0, adjustedStartIndex) + 
               cleanUrl + 
               result.substring(item.endIndex);
    } else {
      // Se não for link da tropicalize, remove o protocolo e www
      const plainUrl = item.url;
      result = result.substring(0, adjustedStartIndex) + 
               plainUrl + 
               result.substring(item.endIndex);
    }
  });
  
  return result;
}

export default cleanLinks; 